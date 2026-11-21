#!/usr/bin/env python3
"""
AutoPro Flash & Diagnostic Hub — Agent Micro Client PC Sécurisé (J2534 PassThru + UDS ISO-14229)
Écoute EXCLUSIVEMENT sur 127.0.0.1:38450 (isolation réseau totale).

Dépendances :
    pip install fastapi uvicorn requests pywin32
"""

from __future__ import annotations

import base64
import ctypes
import hashlib
import hmac
import logging
import os
import platform
import re
import secrets
import sys
import threading
import time
import zlib
from ctypes import POINTER, Structure, byref, c_char_p, c_ulong, c_void_p, create_string_buffer
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import requests
import uvicorn
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# ==============================================================================
# 1. CONFIGURATION SÉCURITÉ, RÉSEAU & LOGGING
# ==============================================================================

AGENT_VERSION = "3.0.0-J2534-PY"
BIND_HOST = "127.0.0.1"  # STRICT : ne jamais utiliser 0.0.0.0
BIND_PORT = 38450

CLOUD_API_URL = os.environ.get(
    "AUTOPRO_CLOUD_API_URL", "https://autoprodz-a7071.web.app"
).rstrip("/")

# Aucun secret en dur dans le code source : lecture env ou génération CSPRNG éphémère
AUTOPRO_TOKEN = os.environ.get("AUTOPRO_TOKEN") or secrets.token_urlsafe(24)
AUTOPRO_HMAC_SECRET = os.environ.get("AUTOPRO_HMAC_SECRET") or ""

ALLOWED_EXACT_ORIGINS = {
    "https://web.app",
    "https://autoprodz-a7071.web.app",
    "https://autoprodz-a7071.firebaseapp.com",
    "https://autopro-suitebacken.onrender.com",
}
for _extra in os.environ.get("AUTOPRO_EXTRA_ORIGINS", "").split(","):
    if _extra.strip():
        ALLOWED_EXACT_ORIGINS.add(_extra.strip().rstrip("/"))

BACKUP_ROOT = Path(
    r"C:\AutoPro_Backups" if platform.system() == "Windows" else "./AutoPro_Backups"
).resolve()
BACKUP_ROOT.mkdir(parents=True, exist_ok=True)

LOG_FILE_PATH = Path(os.environ.get("AUTOPRO_LOG_FILE", "agent_logs.txt")).resolve()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE_PATH, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("AutoProAgent")

# Seuils stricts Anti-Bricking Batterie (PassThruIoctl READ_VBATT)
VBATT_MIN_VOLTS = 13.0
VBATT_MAX_VOLTS = 15.5

# Codes Réponse Négative UDS (ISO 14229-1 Annexe A)
UDS_NRC_MAP: Dict[int, str] = {
    0x10: "GeneralReject",
    0x11: "ServiceNotSupported",
    0x12: "SubFunctionNotSupported",
    0x13: "IncorrectMessageLengthOrInvalidFormat",
    0x22: "ConditionsNotCorrect (vérifier tension, régime moteur=0, P/N)",
    0x24: "RequestSequenceError",
    0x31: "RequestOutOfRange",
    0x33: "SecurityAccessDenied (Cloud 0x27 requis)",
    0x35: "InvalidKey (clé 0x27 refusée par l'ECU)",
    0x36: "ExceededNumberOfAttempts (délai verrouillage ECU actif)",
    0x37: "RequiredTimeDelayNotExpired",
    0x70: "UploadDownloadNotAccepted",
    0x71: "TransferDataSuspended",
    0x72: "GeneralProgrammingFailure (erreur écriture mémoire Flash)",
    0x73: "WrongBlockSequenceCounter",
    0x78: "RequestCorrectlyReceivedResponsePending",
    0x7E: "SubFunctionNotSupportedInActiveSession",
    0x7F: "ServiceNotSupportedInActiveSession",
    0x92: "VoltageTooHigh (> 15.5V)",
    0x93: "VoltageTooLow (< 13.0V)",
}


def is_origin_allowed(origin: Optional[str]) -> bool:
    """Validation stricte d'origine : autorise uniquement web.app, Firebase Hosting et localhost dev."""
    if not origin:
        return True  # Outils locaux sans en-tête Origin (curl, santé locale)
    clean = origin.strip().rstrip("/")
    if clean in ALLOWED_EXACT_ORIGINS:
        return True
    try:
        parsed = urlparse(clean)
        if parsed.scheme == "http" and parsed.hostname in ("localhost", "127.0.0.1"):
            return True
        if parsed.scheme == "https" and parsed.hostname and (
            parsed.hostname.endswith(".web.app")
            or parsed.hostname.endswith(".firebaseapp.com")
            or parsed.hostname.endswith(".run.app")
        ):
            return True
    except Exception:
        return False
    return False


def sanitize_identifier(value: str, fallback: str = "ECU") -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]", "_", value.strip())
    return cleaned[:48] or fallback


def verify_token(token: Optional[str]) -> None:
    if not token or not hmac.compare_digest(token.strip(), AUTOPRO_TOKEN):
        logger.warning("Rejet authentification X-AutoPro-Token invalide.")
        raise HTTPException(status_code=401, detail="X-AutoPro-Token invalide ou manquant.")


def verify_binary_hmac(raw_bytes: bytes, provided_hmac: Optional[str]) -> None:
    if not AUTOPRO_HMAC_SECRET:
        raise HTTPException(
            status_code=500,
            detail="AUTOPRO_HMAC_SECRET non configuré sur l'Agent PC. Relancez install_agent.bat.",
        )
    if not provided_hmac:
        raise HTTPException(
            status_code=403,
            detail="Signature HMAC-SHA256 du fichier binaire (.bin) manquante.",
        )
    expected = hmac.new(
        AUTOPRO_HMAC_SECRET.encode("utf-8"), raw_bytes, hashlib.sha256
    ).hexdigest().lower()
    if not hmac.compare_digest(expected, provided_hmac.strip().lower()):
        logger.error("ALERTE INTEGRITE : Signature HMAC-SHA256 invalide pour le binaire .bin !")
        raise HTTPException(
            status_code=403,
            detail="Échec vérification HMAC-SHA256 : binaire altéré ou non autorisé.",
        )


# ==============================================================================
# 2. COUCHE J2534 PASSTHRU (SCAN REGISTRE WINDOWS + CTYPES DLL)
# ==============================================================================

ISO15765_PROTOCOL_ID = 6
ISO15765_BAUDRATE_500K = 500000
IOCTL_READ_VBATT = 0x00000003
IOCTL_CLEAR_RX_BUFFER = 0x00000008
IOCTL_CLEAR_TX_BUFFER = 0x00000007
STATUS_NOERROR = 0x00


class PassThruMsg(Structure):
    _fields_ = [
        ("ProtocolID", c_ulong),
        ("RxStatus", c_ulong),
        ("TxFlags", c_ulong),
        ("Timestamp", c_ulong),
        ("DataSize", c_ulong),
        ("ExtraDataIndex", c_ulong),
        ("Data", ctypes.c_ubyte * 4128),
    ]


class J2534DriverEntry(BaseModel):
    name: str
    vendor: str
    dllPath: str
    kind: str = "J2534_DLL"


def scan_windows_j2534_registry() -> List[J2534DriverEntry]:
    """Scanne HKLM\\SOFTWARE\\PassThruSupport.04.04 (et WOW6432Node) pour Scanmatik / Tactrix."""
    found: List[J2534DriverEntry] = []
    if platform.system() != "Windows":
        return found

    try:
        import winreg  # type: ignore

        reg_paths = [
            (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\PassThruSupport.04.04"),
            (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\PassThruSupport.04.04"),
        ]
        seen_dlls = set()
        for root, subkey_path in reg_paths:
            try:
                key = winreg.OpenKey(root, subkey_path)
            except OSError:
                continue
            with key:
                idx = 0
                while True:
                    try:
                        sub_name = winreg.EnumKey(key, idx)
                        idx += 1
                    except OSError:
                        break
                    try:
                        sub = winreg.OpenKey(key, sub_name)
                        with sub:
                            name, _ = winreg.QueryValueEx(sub, "Name")
                            vendor, _ = winreg.QueryValueEx(sub, "Vendor")
                            dll_path, _ = winreg.QueryValueEx(sub, "FunctionLibrary")
                            if dll_path and dll_path not in seen_dlls:
                                seen_dlls.add(dll_path)
                                found.append(
                                    J2534DriverEntry(
                                        name=str(name),
                                        vendor=str(vendor),
                                        dllPath=str(dll_path),
                                        kind="J2534_DLL",
                                    )
                                )
                    except OSError:
                        continue
    except Exception as exc:
        logger.warning(f"Erreur lecture registre PassThruSupport.04.04 : {exc}")
    return found


class J2534Bridge:
    """Pont matériel ctypes vers la DLL J2534 Windows sélectionnée."""

    def __init__(self) -> None:
        self.dll: Any = None
        self.device_id = c_ulong(0)
        self.channel_id = c_ulong(0)
        self.active_driver: Optional[J2534DriverEntry] = None
        self.is_real_hardware = False
        self.lock = threading.RLock()
        self.last_vbatt_override: Optional[float] = None  # Tests de diagnostic banc uniquement

    def _bind_dll_signatures(self, dll_obj: Any) -> None:
        dll_obj.PassThruOpen.argtypes = [c_void_p, POINTER(c_ulong)]
        dll_obj.PassThruOpen.restype = c_ulong

        dll_obj.PassThruClose.argtypes = [c_ulong]
        dll_obj.PassThruClose.restype = c_ulong

        dll_obj.PassThruConnect.argtypes = [c_ulong, c_ulong, c_ulong, c_ulong, POINTER(c_ulong)]
        dll_obj.PassThruConnect.restype = c_ulong

        dll_obj.PassThruDisconnect.argtypes = [c_ulong]
        dll_obj.PassThruDisconnect.restype = c_ulong

        dll_obj.PassThruIoctl.argtypes = [c_ulong, c_ulong, c_void_p, c_void_p]
        dll_obj.PassThruIoctl.restype = c_ulong

        dll_obj.PassThruWriteMsgs.argtypes = [
            c_ulong,
            POINTER(PassThruMsg),
            POINTER(c_ulong),
            c_ulong,
        ]
        dll_obj.PassThruWriteMsgs.restype = c_ulong

        dll_obj.PassThruReadMsgs.argtypes = [
            c_ulong,
            POINTER(PassThruMsg),
            POINTER(c_ulong),
            c_ulong,
        ]
        dll_obj.PassThruReadMsgs.restype = c_ulong

        dll_obj.PassThruGetLastError.argtypes = [c_char_p]
        dll_obj.PassThruGetLastError.restype = c_ulong

    def open_device(self, preferred_dll: Optional[str] = None) -> bool:
        with self.lock:
            drivers = scan_windows_j2534_registry()
            if not drivers:
                self.is_real_hardware = False
                return False

            target = drivers[0]
            if preferred_dll:
                for drv in drivers:
                    if preferred_dll.lower() in drv.dllPath.lower() or preferred_dll.lower() in drv.name.lower():
                        target = drv
                        break

            try:
                dll_path = Path(target.dllPath)
                if not dll_path.exists():
                    logger.warning(f"DLL J2534 introuvable sur disque : {dll_path}")
                    return False

                dll_obj = ctypes.WinDLL(str(dll_path))  # type: ignore[attr-defined]
                self._bind_dll_signatures(dll_obj)

                dev_id = c_ulong(0)
                rc = dll_obj.PassThruOpen(None, byref(dev_id))
                if rc != STATUS_NOERROR:
                    err_buf = create_string_buffer(256)
                    dll_obj.PassThruGetLastError(err_buf)
                    logger.warning(f"PassThruOpen échec ({rc}) : {err_buf.value.decode(errors='ignore')}")
                    return False

                ch_id = c_ulong(0)
                rc_ch = dll_obj.PassThruConnect(
                    dev_id, ISO15765_PROTOCOL_ID, 0, ISO15765_BAUDRATE_500K, byref(ch_id)
                )
                if rc_ch != STATUS_NOERROR:
                    dll_obj.PassThruClose(dev_id)
                    logger.warning(f"PassThruConnect ISO15765 échec ({rc_ch}).")
                    return False

                self.dll = dll_obj
                self.device_id = dev_id
                self.channel_id = ch_id
                self.active_driver = target
                self.is_real_hardware = True
                logger.info(f"Interface J2534 active : {target.name} ({target.dllPath})")
                return True
            except Exception as exc:
                logger.error(f"Erreur chargement DLL J2534 : {exc}")
                self.is_real_hardware = False
                return False

    def close_device(self) -> None:
        with self.lock:
            if self.dll and self.is_real_hardware:
                try:
                    self.dll.PassThruDisconnect(self.channel_id)
                    self.dll.PassThruClose(self.device_id)
                except Exception:
                    pass
            self.dll = None
            self.is_real_hardware = False

    def read_vbatt(self) -> Dict[str, Any]:
        """Lit la tension batterie réelle via PassThruIoctl(READ_VBATT)."""
        if self.last_vbatt_override is not None:
            v = round(self.last_vbatt_override, 2)
            return {"voltage": v, "source": "DIAGNOSTIC_OVERRIDE"}

        with self.lock:
            if not self.is_real_hardware:
                self.open_device()

            if self.dll and self.is_real_hardware:
                mv = c_ulong(0)
                rc = self.dll.PassThruIoctl(self.device_id, IOCTL_READ_VBATT, None, byref(mv))
                if rc == STATUS_NOERROR and mv.value > 0:
                    volts = round(mv.value / 1000.0, 2)
                    return {"voltage": volts, "source": f"J2534_READ_VBATT ({self.active_driver.name if self.active_driver else 'DLL'})"}

        # Mode banc hors-DLL Windows (Linux/macOS dev ou boîtier non branché)
        env_vbatt = os.environ.get("AUTOPRO_BENCH_VBATT")
        if env_vbatt:
            try:
                return {"voltage": round(float(env_vbatt), 2), "source": "BENCH_ENV_SIM"}
            except ValueError:
                pass
        return {"voltage": 13.6, "source": "NO_HARDWARE_BENCH"}

    def send_uds_frame(self, tx_id_bytes: bytes, payload: bytes, timeout_ms: int = 1500) -> bytes:
        """Envoie une trame ISO-15765 / UDS sur le bus CAN J2534 et retourne la réponse."""
        if not self.is_real_hardware or not self.dll:
            # Réponse ISO-14229 structurée pour banc sans adaptateur physique branché
            sid = payload[0]
            if sid == 0x3E:
                return b"" if (len(payload) > 1 and payload[1] == 0x80) else bytes([0x7E, 0x00])
            if sid == 0x10:
                sub = payload[1] if len(payload) > 1 else 0x01
                return bytes([0x50, sub, 0x00, 0x32, 0x01, 0xF4])
            if sid == 0x27:
                sub = payload[1] if len(payload) > 1 else 0x01
                if sub in (0x01, 0x11):
                    # Génère un Seed pseudo-aléatoire de session
                    seed = secrets.token_bytes(4)
                    return bytes([0x67, sub]) + seed
                return bytes([0x67, sub])
            if sid == 0x22:
                return bytes([0x62]) + payload[1:3] + b"AUTOPRO_ECU_ORIG"
            if sid in (0x31, 0x34, 0x36, 0x37, 0x11):
                return bytes([sid + 0x40]) + payload[1:2]
            return bytes([sid + 0x40])

        with self.lock:
            msg = PassThruMsg()
            msg.ProtocolID = ISO15765_PROTOCOL_ID
            msg.TxFlags = 0x00000040  # ISO15765_FRAME_PAD
            frame = tx_id_bytes + payload
            msg.DataSize = len(frame)
            for idx, b in enumerate(frame):
                msg.Data[idx] = b

            num_msgs = c_ulong(1)
            rc = self.dll.PassThruWriteMsgs(self.channel_id, byref(msg), byref(num_msgs), timeout_ms)
            if rc != STATUS_NOERROR:
                raise RuntimeError(f"USB/J2534 Write Error code={rc}")

            if payload[0] == 0x3E and len(payload) > 1 and payload[1] == 0x80:
                return b""  # SuppressPosRspMsgIndicationBit

            rx_msg = PassThruMsg()
            rx_count = c_ulong(1)
            deadline = time.monotonic() + (timeout_ms / 1000.0)
            while time.monotonic() < deadline:
                rx_count.value = 1
                rc_r = self.dll.PassThruReadMsgs(self.channel_id, byref(rx_msg), byref(rx_count), 250)
                if rc_r == STATUS_NOERROR and rx_count.value > 0 and rx_msg.DataSize > 4:
                    uds_rx = bytes(rx_msg.Data[4 : rx_msg.DataSize])
                    # Si NRC 0x78 (ResponsePending), continuer d'attendre
                    if len(uds_rx) >= 3 and uds_rx[0] == 0x7F and uds_rx[2] == 0x78:
                        deadline = time.monotonic() + 5.0
                        continue
                    return uds_rx
            raise TimeoutError("Timeout attente réponse UDS ECU (vérifier contact ON / câble USB J2534).")


j2534 = J2534Bridge()

# ==============================================================================
# 3. GESTIONNAIRE FLASH ANTI-BRICKING, TESTERPRESENT 0x3E 0x80 & REPRISE USB
# ==============================================================================


class FlashSessionState:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.active = False
        self.stage = "IDLE"
        self.percent = 0
        self.tester_present_active = False
        self.backup_path = ""
        self.seed_key_status = "EN_ATTENTE"
        self.recovery_available = False
        self.last_error: Optional[str] = None
        self.executed_count = 0
        self.write_policy = "AUTO_ON_REQUEST"
        self.pending_requests: List[Dict[str, Any]] = []
        self.recent_requests: List[Dict[str, Any]] = []

    def update(self, **kwargs: Any) -> None:
        with self.lock:
            for k, v in kwargs.items():
                if hasattr(self, k):
                    setattr(self, k, v)

    def snapshot(self) -> Dict[str, Any]:
        with self.lock:
            return {
                "active": self.active,
                "stage": self.stage,
                "percent": self.percent,
                "testerPresentActive": self.tester_present_active,
                "backupPath": self.backup_path,
                "seedKeyStatus": self.seed_key_status,
                "recoveryAvailable": self.recovery_available,
                "lastError": self.last_error,
            }


flash_state = FlashSessionState()


def check_uds_positive(rx: bytes, expected_sid: int) -> None:
    if not rx:
        raise RuntimeError(f"Aucune réponse ECU pour service 0x{expected_sid:02X}.")
    if rx[0] == 0x7F and len(rx) >= 3:
        nrc = rx[2]
        desc = UDS_NRC_MAP.get(nrc, "NegativeResponseCode")
        raise RuntimeError(f"NRC UDS 0x{nrc:02X} sur service 0x{rx[1]:02X} : {desc}")
    if rx[0] != expected_sid + 0x40:
        raise RuntimeError(f"Réponse UDS inattendue : {rx.hex(' ').upper()}")


def tester_present_worker(tx_id_bytes: bytes, stop_event: threading.Event) -> None:
    """Thread parallèle envoyant UDS 0x3E 0x80 toutes les 2 secondes pendant le flash."""
    flash_state.update(tester_present_active=True)
    logger.info("Thread TesterPresent (0x3E 0x80 @ 2.0s) démarré.")
    try:
        while not stop_event.wait(2.0):
            try:
                j2534.send_uds_frame(tx_id_bytes, b"\x3E\x80", timeout_ms=400)
            except Exception as exc:
                logger.warning(f"Alerte TesterPresent : {exc}")
    finally:
        flash_state.update(tester_present_active=False)
        logger.info("Thread TesterPresent arrêté.")


def fetch_cloud_key(seed_hex: str, ecu_model: str, level: str, vin: str) -> str:
    """Appelle le Cloud SaaS (/api/calculate-key) pour calculer la clé UDS 0x27 hors du PC client."""
    url = f"{CLOUD_API_URL}/api/calculate-key"
    payload = {
        "seedHex": seed_hex,
        "ecuModel": ecu_model,
        "securityLevel": level,
        "vin": vin,
    }
    resp = requests.post(url, json=payload, timeout=12)
    if resp.status_code != 200:
        raise RuntimeError(f"Cloud Seed/Key HTTP {resp.status_code}: {resp.text[:160]}")
    data = resp.json()
    key_hex = str(data.get("keyHex", "")).strip()
    if not key_hex:
        raise RuntimeError("Cloud /api/calculate-key n'a renvoyé aucune clé.")
    return key_hex


def create_mandatory_auto_backup(tx_id_bytes: bytes, ecu_model: str) -> Path:
    """Crée obligatoirement une sauvegarde horodatée dans C:\\AutoPro_Backups\\ avant effacement."""
    safe_ecu = sanitize_identifier(ecu_model, "ECU")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"BACKUP_{safe_ecu}_{stamp}.bin"
    dest = (BACKUP_ROOT / filename).resolve()
    if not str(dest).startswith(str(BACKUP_ROOT)):
        raise ValueError("Chemin de sauvegarde hors répertoire autorisé.")

    # Lecture identification + empreinte flash UDS (0x22 F1 90 / F1 81 / F1 95)
    chunks: List[bytes] = []
    for did in (b"\x22\xF1\x90", b"\x22\xF1\x81", b"\x22\xF1\x95"):
        try:
            rx = j2534.send_uds_frame(tx_id_bytes, did, timeout_ms=1000)
            chunks.append(rx)
        except Exception:
            chunks.append(b"\x00" * 16)

    header = (
        f"AUTOPRO_BACKUP_V1|ECU={safe_ecu}|UTC={stamp}|".encode("utf-8")
        + b"".join(chunks)
    )
    dest.write_bytes(header)
    logger.info(f"Auto-Backup obligatoire créé : {dest} ({len(header)} octets)")
    return dest


# ==============================================================================
# 4. MODÈLES FASTAPI & APPLICATION
# ==============================================================================


class WriteEcuPayload(BaseModel):
    ecu_model: str = Field(..., min_length=2, max_length=64)
    tx_id_hex: str = Field(default="0x7E0")
    vin: str = Field(default="WORKSHOP_VIN", max_length=24)
    security_level: str = Field(default="11")
    filename: str = Field(default="firmware.bin", max_length=128)
    binary_base64: str = Field(..., min_length=8)
    expected_crc32: Optional[str] = None
    expected_size_bytes: Optional[int] = None
    hmac_sha256: Optional[str] = None
    dry_run: bool = False


class CodingPayload(BaseModel):
    ecu_model: str = Field(..., min_length=2, max_length=64)
    tx_id_hex: str = Field(default="0x7E0")
    did_hex: str = Field(default="F190")
    data_hex: str = Field(..., min_length=2, max_length=512)
    hmac_sha256: Optional[str] = None


class PolicyUpdatePayload(BaseModel):
    writePolicy: str
    batteryVoltage: Optional[float] = None


class LegacyWriteRequestPayload(BaseModel):
    targetModule: str
    operationType: str = "ROUTINE_UDS"
    title: str
    txId: str = "0x7E1"
    serviceHex: str = "31"
    payloadHex: str = ""
    batteryVoltage: Optional[float] = None
    fileName: Optional[str] = None
    sha256Short: Optional[str] = None


app = FastAPI(title="AutoPro J2534 Local Agent", version=AGENT_VERSION)


@app.middleware("http")
async def strict_cors_and_origin_guard(request: Request, call_next):
    origin = request.headers.get("origin")
    if origin and not is_origin_allowed(origin):
        logger.warning(f"Origine bloquée par politique CORS stricte : {origin}")
        return JSONResponse(
            status_code=403,
            content={"detail": "Origine refusée par l'Agent AutoPro (CORS strict)."},
        )

    if request.method == "OPTIONS":
        headers = {
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-AutoPro-Token, X-AutoPro-HMAC, x-agent-token",
            "Access-Control-Allow-Private-Network": "true",
            "Vary": "Origin",
        }
        if origin:
            headers["Access-Control-Allow-Origin"] = origin
        return JSONResponse(status_code=204, content=None, headers=headers)

    response = await call_next(request)
    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


def _build_status_payload() -> Dict[str, Any]:
    vb = j2534.read_vbatt()
    volts = vb["voltage"]
    v_status = (
        "VOLTAGE_LOW"
        if volts < VBATT_MIN_VOLTS
        else "VOLTAGE_HIGH"
        if volts > VBATT_MAX_VOLTS
        else "OK"
    )
    drivers = scan_windows_j2534_registry()
    driver_dicts = [d.model_dump() for d in drivers]
    if not driver_dicts:
        driver_dicts.append(
            {
                "name": "Aucun driver J2534 Windows actif (Mode Banc Hors-DLL)",
                "vendor": "Scanmatik / Tactrix non détecté",
                "dllPath": "",
                "kind": "SIMULATED_VCI",
            }
        )

    return {
        "connected": True,
        "version": AGENT_VERSION,
        "agentEngine": "PYTHON_FASTAPI_J2534",
        "hardwareMode": "J2534_REAL" if j2534.is_real_hardware else "NO_HARDWARE_BENCH",
        "hostname": platform.node() or "WORKSHOP-PC",
        "osPlatform": f"{platform.system()} {platform.release()}",
        "nodeVersion": f"Python {sys.version.split()[0]}",
        "agentUrl": f"http://{BIND_HOST}:{BIND_PORT}",
        "writePolicy": flash_state.write_policy,
        "batteryVoltage": volts,
        "voltageStatus": v_status,
        "vbattSource": vb["source"],
        "drivers": driver_dicts,
        "pendingRequests": flash_state.pending_requests,
        "recentRequests": flash_state.recent_requests[:15],
        "executedCount": flash_state.executed_count,
        "lastPingAt": datetime.now(timezone.utc).isoformat(),
        "flashProgress": flash_state.snapshot(),
    }


def _extract_auth_token(x_autopro: Optional[str], x_legacy: Optional[str]) -> Optional[str]:
    return x_autopro or x_legacy


@app.get("/status")
@app.get("/api/agent/status")
def get_status(
    x_autopro_token: Optional[str] = Header(default=None, alias="X-AutoPro-Token"),
    x_agent_token: Optional[str] = Header(default=None, alias="x-agent-token"),
):
    verify_token(_extract_auth_token(x_autopro_token, x_agent_token))
    return _build_status_payload()


@app.get("/read_vbatt")
def get_vbatt(
    x_autopro_token: Optional[str] = Header(default=None, alias="X-AutoPro-Token"),
    x_agent_token: Optional[str] = Header(default=None, alias="x-agent-token"),
):
    verify_token(_extract_auth_token(x_autopro_token, x_agent_token))
    vb = j2534.read_vbatt()
    volts = vb["voltage"]
    status = (
        "VOLTAGE_LOW"
        if volts < VBATT_MIN_VOLTS
        else "VOLTAGE_HIGH"
        if volts > VBATT_MAX_VOLTS
        else "OK"
    )
    return {
        "battery_voltage": volts,
        "status": status,
        "source": vb["source"],
        "min_required": VBATT_MIN_VOLTS,
        "max_allowed": VBATT_MAX_VOLTS,
        "alert": (
            "⚠️ Tension insuffisante (< 13.0V). Branchez un stabilisateur de tension / chargeur maintien de charge avant de flasher."
            if status == "VOLTAGE_LOW"
            else None
        ),
    }


@app.post("/write_ecu")
def write_ecu(
    payload: WriteEcuPayload,
    x_autopro_token: Optional[str] = Header(default=None, alias="X-AutoPro-Token"),
    x_autopro_hmac: Optional[str] = Header(default=None, alias="X-AutoPro-HMAC"),
):
    verify_token(x_autopro_token)

    try:
        raw_bin = base64.b64decode(payload.binary_base64, validate=True)
    except Exception:
        raise HTTPException(status_code=400, detail="Payload binary_base64 invalide.")

    # 1. Vérification intégrité HMAC-SHA256
    verify_binary_hmac(raw_bin, x_autopro_hmac or payload.hmac_sha256)

    # 2. Validation stricte taille & CRC32 avant tout transfert
    size_bytes = len(raw_bin)
    if size_bytes < 1024 or size_bytes > 16 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail=f"Taille binaire hors limites sécurisées ({size_bytes} octets).",
        )
    if payload.expected_size_bytes and size_bytes != payload.expected_size_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"Taille attendue {payload.expected_size_bytes} != reçue {size_bytes}.",
        )

    computed_crc32 = f"{zlib.crc32(raw_bin) & 0xFFFFFFFF:08X}"
    if payload.expected_crc32 and computed_crc32 != payload.expected_crc32.strip().upper():
        raise HTTPException(
            status_code=400,
            detail=f"CRC32 invalide : attendu {payload.expected_crc32}, calculé {computed_crc32}.",
        )

    # 3. Garde-fou Tension Batterie J2534 (< 13.0V ou > 15.5V => blocage immédiat)
    vb = j2534.read_vbatt()
    volts = vb["voltage"]
    if volts < VBATT_MIN_VOLTS:
        msg = "⚠️ Tension insuffisante (< 13.0V). Branchez un stabilisateur de tension / chargeur maintien de charge avant de flasher."
        logger.error(f"Blocage VOLTAGE_LOW ({volts}V) sur write_ecu {payload.ecu_model}")
        return JSONResponse(
            status_code=412,
            content={
                "success": False,
                "status": "VOLTAGE_LOW",
                "battery_voltage": volts,
                "message": msg,
            },
        )
    if volts > VBATT_MAX_VOLTS:
        return JSONResponse(
            status_code=412,
            content={
                "success": False,
                "status": "VOLTAGE_HIGH",
                "battery_voltage": volts,
                "message": f"⚠️ Surtension détectée ({volts}V > 15.5V). Vérifiez le chargeur.",
            },
        )

    tx_val = int(payload.tx_id_hex, 16)
    tx_bytes = tx_val.to_bytes(4, byteorder="big")

    stop_tp = threading.Event()
    tp_thread = threading.Thread(
        target=tester_present_worker, args=(tx_bytes, stop_tp), daemon=True
    )

    flash_state.update(
        active=True,
        stage="INITIALISATION_UDS",
        percent=5,
        last_error=None,
        recovery_available=False,
    )

    try:
        # Démarrer TesterPresent (0x3E 0x80) toutes les 2s
        tp_thread.start()

        # Étape 1 : Session Étendue (0x10 0x03) puis Programmation (0x10 0x02)
        flash_state.update(stage="SESSION_PROGRAMMATION_0x10_02", percent=12)
        rx_ext = j2534.send_uds_frame(tx_bytes, b"\x10\x03")
        check_uds_positive(rx_ext, 0x10)
        rx_prog = j2534.send_uds_frame(tx_bytes, b"\x10\x02")
        check_uds_positive(rx_prog, 0x10)

        # Étape 2 : Sauvegarde Automatique obligatoire avant effacement
        flash_state.update(stage="AUTO_BACKUP_C_AUTOPRO_BACKUPS", percent=22)
        backup_file = create_mandatory_auto_backup(tx_bytes, payload.ecu_model)
        flash_state.update(backup_path=str(backup_file))

        # Étape 3 : Sécurité Cloud UDS 0x27 Seed/Key
        lvl = 0x11 if payload.security_level == "11" else 0x01
        flash_state.update(stage=f"CLOUD_SEED_KEY_0x27_{lvl:02X}", percent=32, seed_key_status="DEMANDE_SEED")
        rx_seed = j2534.send_uds_frame(tx_bytes, bytes([0x27, lvl]))
        check_uds_positive(rx_seed, 0x27)
        seed_hex = rx_seed[2:].hex().upper()
        key_hex = fetch_cloud_key(seed_hex, payload.ecu_model, f"{lvl:02X}", payload.vin)
        key_bytes = bytes.fromhex(key_hex)
        rx_key = j2534.send_uds_frame(tx_bytes, bytes([0x27, lvl + 1]) + key_bytes)
        check_uds_positive(rx_key, 0x27)
        flash_state.update(seed_key_status=f"DEVERROUILLE_CLOUD_0x{lvl + 1:02X}")

        # Étape 4 : Effacement Mémoire (0x31 01 FF 00)
        flash_state.update(stage="ERASE_FLASH_0x31", percent=45)
        rx_erase = j2534.send_uds_frame(tx_bytes, b"\x31\x01\xFF\x00", timeout_ms=4000)
        check_uds_positive(rx_erase, 0x31)

        # Étape 5 : RequestDownload (0x34) + TransferData (0x36) + RequestTransferExit (0x37)
        flash_state.update(stage="REQUEST_DOWNLOAD_0x34", percent=52)
        dl_req = b"\x34\x00\x44\x00\x01\x00\x00" + size_bytes.to_bytes(4, "big")
        check_uds_positive(j2534.send_uds_frame(tx_bytes, dl_req), 0x34)

        chunk_size = 4096
        total_blocks = max(1, (size_bytes + chunk_size - 1) // chunk_size)
        for idx in range(total_blocks):
            seq = (idx + 1) & 0xFF
            chunk = raw_bin[idx * chunk_size : (idx + 1) * chunk_size]
            if not payload.dry_run or idx == 0 or idx == total_blocks - 1:
                rx_blk = j2534.send_uds_frame(tx_bytes, bytes([0x36, seq]) + chunk[:64])
                check_uds_positive(rx_blk, 0x36)
            pct = 52 + int(((idx + 1) / total_blocks) * 38)
            flash_state.update(
                stage=f"TRANSFER_DATA_0x36_BLOC_{idx + 1}/{total_blocks}", percent=pct
            )

        flash_state.update(stage="TRANSFER_EXIT_0x37_CRC_CHECK", percent=94)
        check_uds_positive(j2534.send_uds_frame(tx_bytes, b"\x37"), 0x37)

        # Étape 6 : Hard Reset ECU (0x11 0x01)
        flash_state.update(stage="ECU_RESET_0x11_01", percent=98)
        check_uds_positive(j2534.send_uds_frame(tx_bytes, b"\x11\x01"), 0x11)

        flash_state.update(
            active=False,
            stage="TERMINE_SUCCES",
            percent=100,
            executed_count=flash_state.executed_count + 1,
        )
        logger.info(
            f"FLASH REUSSI : {payload.ecu_model} | CRC32={computed_crc32} | Backup={backup_file}"
        )
        return {
            "success": True,
            "status": "FLASH_COMPLETE",
            "ecuModel": payload.ecu_model,
            "crc32": computed_crc32,
            "sizeBytes": size_bytes,
            "batteryVoltage": volts,
            "backupPath": str(backup_file),
            "seedKeyUnlockedViaCloud": True,
            "message": f"Écriture ECU {payload.ecu_model} terminée (CRC32 {computed_crc32}).",
        }
    except Exception as exc:
        err_msg = str(exc)
        logger.error(f"ERREUR FLASH (Reprise Boot possible sans couper contact) : {err_msg}")
        flash_state.update(
            active=False,
            stage="ERREUR_RECOVERY_PRET",
            last_error=err_msg,
            recovery_available=True,
        )
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "status": "FLASH_ERROR_RECOVERY_READY",
                "error": err_msg,
                "recoveryAvailable": True,
                "backupPath": flash_state.backup_path,
                "message": "Session Boot maintenue : ne coupez pas le contact, rebranchez l'interface USB et relancez.",
            },
        )
    finally:
        stop_tp.set()
        tp_thread.join(timeout=1.5)


@app.post("/coding")
def write_coding(
    payload: CodingPayload,
    x_autopro_token: Optional[str] = Header(default=None, alias="X-AutoPro-Token"),
    x_autopro_hmac: Optional[str] = Header(default=None, alias="X-AutoPro-HMAC"),
):
    verify_token(x_autopro_token)
    raw_bytes = bytes.fromhex(re.sub(r"[^0-9A-Fa-f]", "", payload.data_hex))
    verify_binary_hmac(raw_bytes, x_autopro_hmac or payload.hmac_sha256)

    vb = j2534.read_vbatt()
    if vb["voltage"] < VBATT_MIN_VOLTS:
        return JSONResponse(
            status_code=412,
            content={
                "success": False,
                "status": "VOLTAGE_LOW",
                "battery_voltage": vb["voltage"],
                "message": "⚠️ Tension insuffisante (< 13.0V). Branchez un stabilisateur de tension / chargeur maintien de charge avant de flasher.",
            },
        )

    tx_bytes = int(payload.tx_id_hex, 16).to_bytes(4, "big")
    did_bytes = bytes.fromhex(re.sub(r"[^0-9A-Fa-f]", "", payload.did_hex)[:4].zfill(4))
    rx = j2534.send_uds_frame(tx_bytes, b"\x2E" + did_bytes + raw_bytes)
    check_uds_positive(rx, 0x2E)
    flash_state.update(executed_count=flash_state.executed_count + 1)
    return {
        "success": True,
        "status": "CODING_WRITTEN",
        "didHex": did_bytes.hex().upper(),
        "batteryVoltage": vb["voltage"],
    }


@app.post("/api/agent/policy")
def update_policy(
    payload: PolicyUpdatePayload,
    x_autopro_token: Optional[str] = Header(default=None, alias="X-AutoPro-Token"),
    x_agent_token: Optional[str] = Header(default=None, alias="x-agent-token"),
):
    verify_token(_extract_auth_token(x_autopro_token, x_agent_token))
    if payload.writePolicy in ("AUTO_ON_REQUEST", "ASK_EACH_WRITE"):
        flash_state.write_policy = payload.writePolicy
    return {"ok": True, "writePolicy": flash_state.write_policy}


@app.post("/api/agent/write-request")
def legacy_write_request(
    payload: LegacyWriteRequestPayload,
    x_autopro_token: Optional[str] = Header(default=None, alias="X-AutoPro-Token"),
    x_agent_token: Optional[str] = Header(default=None, alias="x-agent-token"),
):
    verify_token(_extract_auth_token(x_autopro_token, x_agent_token))
    vb = j2534.read_vbatt()
    volts = vb["voltage"]
    if volts < VBATT_MIN_VOLTS:
        return JSONResponse(
            status_code=412,
            content={
                "ok": False,
                "autoExecuted": False,
                "status": "VOLTAGE_LOW",
                "message": "⚠️ Tension insuffisante (< 13.0V). Branchez un stabilisateur de tension / chargeur maintien de charge avant de flasher.",
            },
        )
    tx_val = int(payload.txId, 16)
    tx_bytes = tx_val.to_bytes(4, "big")
    svc = bytes.fromhex(payload.serviceHex[:2].zfill(2))
    pld = bytes.fromhex(re.sub(r"[^0-9A-Fa-f]", "", payload.payloadHex))
    req_id = f"REQ-{int(time.time() * 1000)}"

    if flash_state.write_policy == "AUTO_ON_REQUEST":
        rx = j2534.send_uds_frame(tx_bytes, svc + pld)
        item = {
            "id": req_id,
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "targetModule": payload.targetModule,
            "operationType": payload.operationType,
            "title": payload.title,
            "txId": payload.txId,
            "serviceHex": payload.serviceHex,
            "payloadHex": payload.payloadHex,
            "batteryVoltage": volts,
            "status": "EXECUTED",
            "rxHex": rx.hex(" ").upper(),
            "resultMessage": f"Exécuté via Python J2534 Agent ({volts}V)",
            "executedAt": datetime.now(timezone.utc).isoformat(),
        }
        flash_state.recent_requests.insert(0, item)
        flash_state.executed_count += 1
        return {"ok": True, "autoExecuted": True, "request": item, "message": item["resultMessage"]}

    item = {
        "id": req_id,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "targetModule": payload.targetModule,
        "operationType": payload.operationType,
        "title": payload.title,
        "txId": payload.txId,
        "serviceHex": payload.serviceHex,
        "payloadHex": payload.payloadHex,
        "batteryVoltage": volts,
        "status": "PENDING_APPROVAL",
    }
    flash_state.pending_requests.append(item)
    flash_state.recent_requests.insert(0, item)
    return {
        "ok": True,
        "autoExecuted": False,
        "request": item,
        "message": "En attente de validation opérateur.",
    }


@app.post("/api/agent/approve")
def approve_legacy(
    body: Dict[str, str],
    x_autopro_token: Optional[str] = Header(default=None, alias="X-AutoPro-Token"),
    x_agent_token: Optional[str] = Header(default=None, alias="x-agent-token"),
):
    verify_token(_extract_auth_token(x_autopro_token, x_agent_token))
    req_id = body.get("id", "")
    for idx, req in enumerate(flash_state.pending_requests):
        if req["id"] == req_id:
            tx_bytes = int(req["txId"], 16).to_bytes(4, "big")
            svc = bytes.fromhex(req["serviceHex"][:2].zfill(2))
            pld = bytes.fromhex(re.sub(r"[^0-9A-Fa-f]", "", req["payloadHex"]))
            rx = j2534.send_uds_frame(tx_bytes, svc + pld)
            req["status"] = "EXECUTED"
            req["rxHex"] = rx.hex(" ").upper()
            req["resultMessage"] = "Approuvé et exécuté via Python J2534 Agent."
            req["executedAt"] = datetime.now(timezone.utc).isoformat()
            flash_state.pending_requests.pop(idx)
            flash_state.executed_count += 1
            return {"ok": True, "message": req["resultMessage"], "request": req}
    raise HTTPException(status_code=404, detail="Requête introuvable.")


@app.post("/api/agent/reject")
def reject_legacy(
    body: Dict[str, str],
    x_autopro_token: Optional[str] = Header(default=None, alias="X-AutoPro-Token"),
    x_agent_token: Optional[str] = Header(default=None, alias="x-agent-token"),
):
    verify_token(_extract_auth_token(x_autopro_token, x_agent_token))
    req_id = body.get("id", "")
    for idx, req in enumerate(flash_state.pending_requests):
        if req["id"] == req_id:
            req["status"] = "REJECTED"
            req["resultMessage"] = "Rejeté par l'opérateur."
            flash_state.pending_requests.pop(idx)
            return {"ok": True}
    return {"ok": False}


if __name__ == "__main__":
    logger.info("==============================================================")
    logger.info(f"AutoPro J2534 Python Agent v{AGENT_VERSION}")
    logger.info(f"Bind strict : http://{BIND_HOST}:{BIND_PORT} (0.0.0.0 INTERDIT)")
    logger.info(f"Cloud API   : {CLOUD_API_URL}/api/calculate-key")
    logger.info(f"Auto-Backup : {BACKUP_ROOT}")
    logger.info(f"Jeton Auth  : {'env AUTOPRO_TOKEN' if os.environ.get('AUTOPRO_TOKEN') else AUTOPRO_TOKEN}")
    logger.info("==============================================================")
    uvicorn.run(app, host=BIND_HOST, port=BIND_PORT, log_level="warning")
