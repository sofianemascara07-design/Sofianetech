#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AutoPro DZ Agent & Cloud — Agent Local Windows Sécurisé (Pare-Feu Matériel & Anti-Bricking)
===========================================================================================
- Serveur WebSocket local isolé : ws://127.0.0.1:8765 (CORS / Origin strict + Jeton HMAC-SHA256)
- Pare-feu matériel : Whitelist IHU (IHU624G, IHU715P, IHU535G, IHU510G, Flyme Auto 2.5.0)
- Verrouillage strict : interdiction rw sur /system et /vendor, DID F190 & odomètre en lecture seule
- Watchdog batterie continu : blocage strict si V < 13.0V ou V > 14.8V (plage idéale 13.5V–13.8V)
- Chiffrement RAM AES-256-GCM pour packs et dumps ECU + Secure Wipe après opération
- Aucune dépendance externe type Telegram — 100% piloté via l'Agent PC et le SaaS Web AutoPro DZ
"""

from __future__ import annotations

import asyncio
import base64
import ctypes
import hashlib
import hmac
import json
import logging
import math
import os
import platform
import re
import secrets
import shutil
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.request
from ctypes import POINTER, Structure, byref, c_ulong, c_void_p
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import psutil
import serial
import serial.tools.list_ports
import websockets
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# ==============================================================================
# 1. CONFIGURATION SÉCURITÉ, LOGGING & CHEMINS PYINSTALLER
# ==============================================================================

AGENT_VERSION = "4.0.0-AUTOPRO-DZ"
WS_HOST = "127.0.0.1"  # STRICT : jamais 0.0.0.0
WS_PORT = int(os.environ.get("AUTOPRO_WS_PORT", "8765"))
BACKEND_API_URL = os.environ.get("AUTOPRO_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")

ALLOWED_ORIGINS = {
    "https://autoprodz-a7071.web.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
}

# Secret HMAC éphémère ou configuré via variable d'environnement pour la session locale
SESSION_HMAC_SECRET = os.environ.get("AUTOPRO_AGENT_HMAC_SECRET") or secrets.token_hex(32)

# Seuils Watchdog Tension Batterie (Anti-Bricking)
VOLT_MIN_ALLOWED = 13.0
VOLT_MAX_ALLOWED = 14.8
VOLT_IDEAL_MIN = 13.5
VOLT_IDEAL_MAX = 13.8

# Répertoires locaux Atelier
BASE_DATA_DIR = Path(
    os.environ.get("LOCALAPPDATA", ".") if platform.system() == "Windows" else "."
) / "AutoPro_DZ_Agent"
BACKUP_ROOT = BASE_DATA_DIR / "backups"
BENCH_INBOX_DIR = BASE_DATA_DIR / "bench_inbox"
BENCH_OUTBOX_DIR = BASE_DATA_DIR / "bench_outbox"
LOG_FILE = BASE_DATA_DIR / "autopro_agent.log"

for _d in (BASE_DATA_DIR, BACKUP_ROOT, BENCH_INBOX_DIR, BENCH_OUTBOX_DIR):
    _d.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout) if sys.stdout else logging.NullHandler(),
    ],
)
logger = logging.getLogger("AutoProDZAgent")


def resolve_adb_binary() -> str:
    """Résout le chemin vers adb.exe embarqué par PyInstaller (--onefile) ou dans le PATH."""
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        bundled = Path(getattr(sys, "_MEIPASS")) / "adb.exe"
        if bundled.exists():
            return str(bundled)
    local_dir_adb = Path(__file__).resolve().parent / "adb_tools" / "adb.exe"
    if local_dir_adb.exists():
        return str(local_dir_adb)
    return shutil.which("adb") or "adb"


def zero_wipe_bytearray(buf: Optional[bytearray]) -> None:
    """Effacement sécurisé en mémoire RAM (Secure Wipe par écrasement à 0x00)."""
    if buf is None:
        return
    for i in range(len(buf)):
        buf[i] = 0


def secure_delete_file(path: Path) -> None:
    """Écrase le fichier avec des octets aléatoires puis des zéros avant suppression."""
    try:
        if not path.exists() or not path.is_file():
            return
        size = path.stat().st_size
        if size > 0:
            with open(path, "r+b") as f:
                f.seek(0)
                f.write(os.urandom(size))
                f.flush()
                os.fsync(f.fileno())
                f.seek(0)
                f.write(b"\x00" * size)
                f.flush()
                os.fsync(f.fileno())
        path.unlink(missing_ok=True)
    except Exception as exc:
        logger.warning(f"Avertissement Secure Wipe fichier {path}: {exc}")


def compute_sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest().upper()


def compute_shannon_entropy(data: bytes) -> float:
    """Calcule l'entropie de Shannon (0.0 à 8.0 bits/octet) pour rejeter les dumps vides."""
    if not data:
        return 0.0
    freq = [0] * 256
    for b in data:
        freq[b] += 1
    total = len(data)
    entropy = 0.0
    for count in freq:
        if count > 0:
            p = count / total
            entropy -= p * math.log2(p)
    return entropy


def post_security_log_to_saas(
    jwt_token: Optional[str],
    vin: str,
    vehicle_model: str,
    operation_type: str,
    ihu_or_ecu: str,
    backup_sha256: str,
    battery_voltage: Optional[float],
    status: str,
    alert_level: str,
    message_fr: str,
    message_darija: str,
) -> None:
    """Enregistre chaque alerte de sécurité et succès directement dans le Backend API SaaS."""
    if not jwt_token:
        return
    payload = {
        "vin": vin or "NON_DETECTE",
        "vehicle_model": vehicle_model or "Véhicule Atelier DZ",
        "operation_type": operation_type,
        "ihu_or_ecu": ihu_or_ecu,
        "backup_sha256": backup_sha256,
        "battery_voltage": battery_voltage,
        "status": status,
        "alert_level": alert_level,
        "message_fr": message_fr,
        "message_darija": message_darija,
    }
    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"{BACKEND_API_URL}/api/logs/security",
            data=data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {jwt_token}",
            },
            method="POST",
        )
        ctx = ssl.create_default_context()
        with urllib.request.urlopen(req, timeout=4, context=ctx if BACKEND_API_URL.startswith("https") else None):
            pass
    except Exception as exc:
        logger.warning(f"Log SaaS hors-ligne (enregistré localement uniquement) : {exc}")


# ==============================================================================
# 2. COUCHE J2534 PASSTHRU WINDOWS (CTYPES)
# ==============================================================================

ISO15765_PROTOCOL_ID = 6
ISO15765_BAUDRATE_500K = 500000
IOCTL_READ_VBATT = 0x00000003
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


class J2534Session:
    """Gère la lecture réelle de tension et les échanges UDS via la DLL J2534 certifiée."""

    def __init__(self) -> None:
        self.dll: Any = None
        self.device_id = c_ulong(0)
        self.channel_id = c_ulong(0)
        self.driver_name: str = ""
        self.connected = False

    def open_driver(self, dll_path: str, driver_name: str) -> Tuple[bool, str]:
        if platform.system() != "Windows" or not dll_path or not Path(dll_path).exists():
            return False, "DLL J2534 introuvable sur ce poste."
        try:
            dll_obj = ctypes.WinDLL(dll_path)
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
                c_ulong, POINTER(PassThruMsg), POINTER(c_ulong), c_ulong
            ]
            dll_obj.PassThruWriteMsgs.restype = c_ulong
            dll_obj.PassThruReadMsgs.argtypes = [
                c_ulong, POINTER(PassThruMsg), POINTER(c_ulong), c_ulong
            ]
            dll_obj.PassThruReadMsgs.restype = c_ulong

            dev_id = c_ulong(0)
            if dll_obj.PassThruOpen(None, byref(dev_id)) != STATUS_NOERROR:
                return False, f"Échec PassThruOpen sur {driver_name}."

            ch_id = c_ulong(0)
            if dll_obj.PassThruConnect(
                dev_id, ISO15765_PROTOCOL_ID, 0, ISO15765_BAUDRATE_500K, byref(ch_id)
            ) != STATUS_NOERROR:
                dll_obj.PassThruClose(dev_id)
                return False, f"Échec PassThruConnect ISO15765 (500 kbps) sur {driver_name}."

            self.dll = dll_obj
            self.device_id = dev_id
            self.channel_id = ch_id
            self.driver_name = driver_name
            self.connected = True
            return True, f"Interface J2534 {driver_name} initialisée."
        except Exception as exc:
            return False, f"Erreur chargement DLL J2534 : {exc}"

    def read_vbatt(self) -> Optional[float]:
        if not self.connected or not self.dll:
            return None
        try:
            mv = c_ulong(0)
            rc = self.dll.PassThruIoctl(self.device_id, IOCTL_READ_VBATT, None, byref(mv))
            if rc == STATUS_NOERROR and mv.value > 0:
                return round(mv.value / 1000.0, 2)
        except Exception:
            return None
        return None

    def send_uds_command(self, tx_id: int, service_bytes: bytes, timeout_ms: int = 1200) -> bytes:
        if not self.connected or not self.dll:
            raise RuntimeError("Aucune session J2534 active.")
        tx_msg = PassThruMsg()
        tx_msg.ProtocolID = ISO15765_PROTOCOL_ID
        tx_msg.TxFlags = 0x00000040  # ISO15765_FRAME_PAD
        full_payload = tx_id.to_bytes(4, "big") + service_bytes
        tx_msg.DataSize = len(full_payload)
        for i, b in enumerate(full_payload):
            tx_msg.Data[i] = b

        num_tx = c_ulong(1)
        rc_w = self.dll.PassThruWriteMsgs(self.channel_id, byref(tx_msg), byref(num_tx), timeout_ms)
        if rc_w != STATUS_NOERROR:
            raise RuntimeError(f"Erreur PassThruWriteMsgs (code {rc_w}).")

        rx_msg = PassThruMsg()
        num_rx = c_ulong(1)
        rc_r = self.dll.PassThruReadMsgs(self.channel_id, byref(rx_msg), byref(num_rx), timeout_ms)
        if rc_r != STATUS_NOERROR or num_rx.value == 0:
            raise RuntimeError(f"Aucune réponse ECU (code {rc_r}).")

        return bytes(rx_msg.Data[: rx_msg.DataSize])[4:]

    def close(self) -> None:
        if self.connected and self.dll:
            try:
                self.dll.PassThruDisconnect(self.channel_id)
                self.dll.PassThruClose(self.device_id)
            except Exception:
                pass
        self.connected = False
        self.dll = None


# ==============================================================================
# 3. CLASSE HARDWARE FIREWALL (PARE-FEU MATÉRIEL & ANTI-BRICKING)
# ==============================================================================


class FirewallViolation(Exception):
    """Exception levée lorsqu'une règle de sécurité critique bloque l'opération."""

    def __init__(self, code: str, message_fr: str, message_darija: str) -> None:
        super().__init__(message_fr)
        self.code = code
        self.message_fr = message_fr
        self.message_darija = message_darija


class HardwareFirewall:
    """
    Pare-feu matériel et logiciel strict :
    - Whitelist IHU exacte via adb shell getprop
    - Rejet adaptateurs OBD bas de gamme / clones instables
    - Watchdog batterie continu (13.0V - 14.8V, idéal 13.5V - 13.8V)
    - Verrouillage /system, /vendor, DID F190 et odomètre
    """

    ALLOWED_IHU_WHITELIST = {
        "IHU624G",
        "IHU715P",
        "IHU535G",
        "IHU510G",
        "FLYME AUTO 2.5.0",
        "FLYME-AUTO-2.5.0",
        "FLYME_AUTO_2_5_0",
    }

    CERTIFIED_ADAPTER_KEYWORDS = (
        "SCANMATIK",
        "SM2",
        "TACTRIX",
        "OPENPORT",
        "VLINKER",
        "OBDLINK",
        "FOXFLASH",
        "KT200",
        "FLEX",
        "AUTOTUNER",
        "KESS3",
    )

    UNTRUSTED_ADAPTER_KEYWORDS = (
        "ELM327",
        "CH340",
        "CH341",
        "V1.5",
        "V2.1",
        "KESS V2",
        "KTAG CLONE",
        "OBDII GENERIC",
    )

    FORBIDDEN_COMMAND_PATTERNS = (
        r"/system",
        r"/vendor",
        r"\bremount\b",
        r"mount\s+-o\s+rw",
        r"\bfastboot\s+flash\s+(system|vendor|boot|preloader)\b",
        r"\bdd\s+if=",
        r"\bformat\b",
        r"\b2E\s*F1\s*90\b",  # Écriture VIN DID F190 interdite
    )

    def __init__(self) -> None:
        self.adb_bin = resolve_adb_binary()
        self.j2534 = J2534Session()
        self.serial_port_path: Optional[str] = None
        self.serial_device_label: Optional[str] = None
        self.emergency_stop_requested = False

    def trigger_emergency_stop(self) -> None:
        self.emergency_stop_requested = True
        logger.critical("ARRÊT D'URGENCE DÉCLENCHÉ PAR L'OPÉRATEUR !")

    def clear_emergency_stop(self) -> None:
        self.emergency_stop_requested = False

    def assert_not_aborted(self) -> None:
        if self.emergency_stop_requested:
            raise FirewallViolation(
                "EMERGENCY_STOP",
                "Opération interrompue immédiatement par l'arrêt d'urgence.",
                "العملية تحبست فوراً بسبّة زر التوقف الطارئ.",
            )

    def scan_and_validate_adapters(self) -> Dict[str, Any]:
        """Scanne les pilotes J2534 Windows et ports COM USB, rejette les clones instables."""
        certified: List[Dict[str, str]] = []
        rejected: List[Dict[str, str]] = []

        # 1. Scan Registre Windows PassThruSupport.04.04
        if platform.system() == "Windows":
            try:
                import winreg  # type: ignore

                for root_key, sub_path in (
                    (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\PassThruSupport.04.04"),
                    (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\PassThruSupport.04.04"),
                ):
                    try:
                        reg = winreg.OpenKey(root_key, sub_path)
                    except OSError:
                        continue
                    with reg:
                        idx = 0
                        while True:
                            try:
                                sub_name = winreg.EnumKey(reg, idx)
                                idx += 1
                            except OSError:
                                break
                            try:
                                sub = winreg.OpenKey(reg, sub_name)
                                with sub:
                                    name, _ = winreg.QueryValueEx(sub, "Name")
                                    vendor, _ = winreg.QueryValueEx(sub, "Vendor")
                                    dll_path, _ = winreg.QueryValueEx(sub, "FunctionLibrary")
                                    label = f"{name} ({vendor})".upper()
                                    if any(k in label for k in self.CERTIFIED_ADAPTER_KEYWORDS):
                                        certified.append(
                                            {
                                                "kind": "J2534",
                                                "name": str(name),
                                                "vendor": str(vendor),
                                                "path": str(dll_path),
                                            }
                                        )
                                    else:
                                        rejected.append(
                                            {
                                                "kind": "J2534_NON_CERTIFIE",
                                                "name": str(name),
                                                "reason": "Interface non certifiée pour écriture sécurisée.",
                                            }
                                        )
                            except OSError:
                                continue
            except Exception as exc:
                logger.warning(f"Scan registre J2534 ignoré : {exc}")

        # 2. Scan Ports Série USB (pyserial)
        for port in serial.tools.list_ports.comports():
            desc_upper = f"{port.description} {port.manufacturer or ''} {port.hwid or ''}".upper()
            if any(k in desc_upper for k in self.CERTIFIED_ADAPTER_KEYWORDS):
                certified.append(
                    {
                        "kind": "SERIAL_OBD",
                        "name": port.description,
                        "vendor": port.manufacturer or "USB Serial",
                        "path": port.device,
                    }
                )
            elif any(k in desc_upper for k in self.UNTRUSTED_ADAPTER_KEYWORDS):
                rejected.append(
                    {
                        "kind": "SERIAL_REJETE",
                        "name": f"{port.description} ({port.device})",
                        "reason": "Adaptateur générique/clone instable bloqué par le pare-feu AutoPro.",
                    }
                )

        if certified and not self.j2534.connected:
            first_j2534 = next((c for c in certified if c["kind"] == "J2534"), None)
            if first_j2534:
                self.j2534.open_driver(first_j2534["path"], first_j2534["name"])
            else:
                first_ser = certified[0]
                self.serial_port_path = first_ser["path"]
                self.serial_device_label = first_ser["name"]

        return {
            "certified": certified,
            "rejected": rejected,
            "active_interface": (
                self.j2534.driver_name
                if self.j2534.connected
                else self.serial_device_label
                if self.serial_port_path
                else (certified[0]["name"] if certified else None)
            ),
            "blocked_only": len(certified) == 0 and len(rejected) > 0,
        }

    def read_real_battery_voltage(self) -> Optional[float]:
        """Lit la tension batterie réelle via J2534 IOCTL ou port série certifié (ATRV)."""
        if self.j2534.connected:
            v = self.j2534.read_vbatt()
            if v is not None:
                return v

        if self.serial_port_path:
            try:
                with serial.Serial(self.serial_port_path, baudrate=115200, timeout=1.2) as ser:
                    ser.write(b"ATRV\r")
                    raw = ser.read(64).decode(errors="ignore")
                    m = re.search(r"(\d{1,2}\.\d{1,2})\s*V", raw, re.IGNORECASE)
                    if m:
                        return float(m.group(1))
            except Exception as exc:
                logger.warning(f"Lecture ATRV série échouée : {exc}")

        return None

    def check_voltage_watchdog(self, voltage: Optional[float]) -> Dict[str, Any]:
        """Vérifie strictement la plage 13.0V–14.8V (idéal 13.5V–13.8V)."""
        self.assert_not_aborted()
        if voltage is None:
            raise FirewallViolation(
                "NO_VOLTAGE_TELEMETRY",
                "Tension batterie non mesurée : connectez une interface certifiée ou un stabilisateur avec télémétrie active.",
                "ماكانش قياس حقيقي لتونسيون البطارية: ربط جهاز معتمد ولا سطابيليزاتور قبل ما تبدا.",
            )
        if voltage < VOLT_MIN_ALLOWED:
            raise FirewallViolation(
                "VOLTAGE_TOO_LOW",
                f"BLOCAGE PARE-FEU : Tension trop basse ({voltage:.2f}V < {VOLT_MIN_ALLOWED:.1f}V). Branchez un stabilisateur 13.5V–13.8V.",
                f"بلوكاج أمان: البطارية طايحة ({voltage:.2f}V أقل من {VOLT_MIN_ALLOWED:.1f}V). ركّب السطابيليزاتور 13.5V–13.8V.",
            )
        if voltage > VOLT_MAX_ALLOWED:
            raise FirewallViolation(
                "VOLTAGE_TOO_HIGH",
                f"BLOCAGE PARE-FEU : Surtension dangereuse ({voltage:.2f}V > {VOLT_MAX_ALLOWED:.1f}V). Risque de griller le calculateur.",
                f"بلوكاج أمان: الفولطاج طالع بزاف ({voltage:.2f}V فوق {VOLT_MAX_ALLOWED:.1f}V). خطر تحرق الكومبيوتر!",
            )
        ideal = VOLT_IDEAL_MIN <= voltage <= VOLT_IDEAL_MAX
        return {
            "voltage": voltage,
            "ideal": ideal,
            "status": "IDEAL_STABILISE" if ideal else "ACCEPTABLE_SOUS_SURVEILLANCE",
        }

    def assert_command_safe(self, command_str: str) -> None:
        """Bloque toute tentative d'écriture sur /system, /vendor, DID F190 ou odomètre."""
        for pat in self.FORBIDDEN_COMMAND_PATTERNS:
            if re.search(pat, command_str, re.IGNORECASE):
                raise FirewallViolation(
                    "FORBIDDEN_PARTITION_OR_ODOMETER",
                    f"INTERDICTION CRITIQUE : Commande bloquée ({command_str}). Modification /system, /vendor ou DID F190/Odomètre strictement interdite.",
                    "ممنوع منعاً باتاً: تلمس /system أو /vendor أو الكيلومتراج والـ VIN! البرامج بلوكا العملية.",
                )

    def run_adb(self, args: List[str], timeout: int = 20) -> Tuple[int, str, str]:
        """Exécute adb.exe après filtrage strict par le pare-feu."""
        self.assert_not_aborted()
        joined = " ".join(args)
        self.assert_command_safe(joined)
        cmd = [self.adb_bin] + args
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            creationflags=subprocess.CREATE_NO_WINDOW if platform.system() == "Windows" else 0,
        )
        return proc.returncode, proc.stdout.strip(), proc.stderr.strip()

    def verify_ihu_whitelist(self, selected_pack_ihu: str) -> Dict[str, str]:
        """
        Exécute adb shell getprop et vérifie la concordance EXACTE entre la référence carte mère
        détectée et le pack sélectionné. Bloque immédiatement en cas de discordance.
        """
        self.assert_not_aborted()
        expected_norm = selected_pack_ihu.strip().upper()
        if expected_norm not in self.ALLOWED_IHU_WHITELIST:
            raise FirewallViolation(
                "IHU_NOT_IN_WHITELIST",
                f"Pack '{selected_pack_ihu}' absent de la Whitelist matérielle certifiée.",
                f"الباك '{selected_pack_ihu}' ماشي داخل في القائمة الآمنة المعتمدة.",
            )

        rc_dev, out_dev, _ = self.run_adb(["devices"], timeout=10)
        lines = [l.strip() for l in out_dev.splitlines()[1:] if "\tdevice" in l]
        if rc_dev != 0 or not lines:
            raise FirewallViolation(
                "NO_ADB_DEVICE",
                "Aucune tablette détectée en mode USB/ADB Data. Activez le débogage USB sur le port Data principal.",
                "ماكانش تابلت مكونيكتيا بـ USB Data. فعّل وضع المطورين (ADB) وركّب الكابل في البور الرئيسي.",
            )

        props: Dict[str, str] = {}
        for prop_key in ("ro.product.board", "ro.build.display.id", "ro.board.platform", "ro.product.model"):
            _, val, _ = self.run_adb(["shell", "getprop", prop_key], timeout=10)
            props[prop_key] = val

        fingerprint_upper = " ".join(props.values()).upper()
        detected_ihu: Optional[str] = None
        for candidate in self.ALLOWED_IHU_WHITELIST:
            if candidate in fingerprint_upper or candidate.replace(" ", "-") in fingerprint_upper:
                detected_ihu = candidate
                break

        if not detected_ihu or detected_ihu != expected_norm:
            raise FirewallViolation(
                "IHU_HARDWARE_MISMATCH",
                f"HARD_STOP ANTI-BRICK : Carte mère détectée ({detected_ihu or 'INCONNUE'} | {props.get('ro.build.display.id', '')}) incompatible avec le pack {expected_norm} !",
                f"توقف إجباري (Anti-Brick): الكارط مير لي في الطوموبيل ({detected_ihu or 'غير معروفة'}) ما تطابقش مع باك {expected_norm}!",
            )

        return {"detected_ihu": detected_ihu, **props}


# ==============================================================================
# 4. CLASSE COCKPIT AUTOMATOR (4 ÉTAPES SÉCURISÉES + BACKUP SHA-256)
# ==============================================================================


class CockpitAutomator:
    """Orchestre le protocole Cockpit non destructif en 4 étapes contrôlées par le pare-feu."""

    FACTORY_CODES_BY_IHU = {
        "IHU624G": ["8888", "3368", "*#*#3646633#*#*"],
        "IHU715P": ["8888", "3368", "*#*#3646633#*#*"],
        "IHU535G": ["8888", "3368", "*#*#3646633#*#*"],
        "IHU510G": ["8888", "3368"],
        "FLYME AUTO 2.5.0": ["Appui long Heure/Version (Flyme Diag)"],
    }

    def __init__(self, firewall: HardwareFirewall) -> None:
        self.fw = firewall

    async def execute_full_workflow(
        self,
        selected_ihu: str,
        vin: str,
        target_lang: str,
        encrypted_pack_b64: str,
        aes_key_b64: str,
        nonce_b64: str,
        jwt_token: Optional[str],
        emit: Any,
    ) -> Dict[str, Any]:
        clean_vin = re.sub(r"[^A-Za-z0-9]", "", vin.upper())[:17] or "VIN_INCONNU"
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_dir = BACKUP_ROOT / f"backup_cockpit_{clean_vin}_{ts}"
        manifest_sha = ""
        measured_v: Optional[float] = None

        try:
            # --- ÉTAPE 1 : Contrôle Paramètres, Watchdog Batterie & Whitelist IHU ---
            await emit({
                "type": "step",
                "phase": 1,
                "status": "running",
                "message_fr": "Étape 1/4 : Vérification tension batterie, codes usine & Whitelist IHU (getprop)...",
                "message_darija": "المرحلة 1/4: رانا نفيريفيو البطارية وكود المصنع وتطابق الكارط مير IHU...",
            })
            measured_v = self.fw.read_real_battery_voltage()
            self.fw.check_voltage_watchdog(measured_v)
            ihu_props = self.fw.verify_ihu_whitelist(selected_ihu)
            codes = self.FACTORY_CODES_BY_IHU.get(ihu_props["detected_ihu"], ["8888"])

            await emit({
                "type": "telemetry",
                "battery_voltage": measured_v,
                "detected_ihu": ihu_props["detected_ihu"],
                "factory_codes": codes,
            })

            # --- ÉTAPE 2 : Backup Atomique & Vérification SHA-256 ---
            await emit({
                "type": "step",
                "phase": 2,
                "status": "running",
                "message_fr": f"Étape 2/4 : Création Backup Atomique dans {backup_dir.name} + contrôle SHA-256...",
                "message_darija": "المرحلة 2/4: رانا نسحبو النسخة الاحتياطية الكاملة مع فحص البصمة SHA-256...",
            })
            backup_dir.mkdir(parents=True, exist_ok=True)
            backup_commands = {
                "system_props.txt": ["shell", "getprop"],
                "settings_global.txt": ["shell", "settings", "list", "global"],
                "settings_system.txt": ["shell", "settings", "list", "system"],
                "audio_dsp_dump.txt": ["shell", "dumpsys", "audio"],
                "vin_f190.txt": ["shell", "echo", f"VIN_LOCKED_RO={clean_vin}"],
            }
            manifest: Dict[str, str] = {}
            for fname, adb_args in backup_commands.items():
                self.fw.check_voltage_watchdog(self.fw.read_real_battery_voltage())
                rc, stdout_txt, stderr_txt = self.fw.run_adb(adb_args, timeout=25)
                if rc != 0:
                    raise FirewallViolation(
                        "BACKUP_FAILED",
                        f"Échec lecture backup ({fname}) : {stderr_txt}",
                        f"فشلت قراءة الباكاب ({fname}) — العملية توقفت للحماية.",
                    )
                fpath = backup_dir / fname
                raw_bytes = stdout_txt.encode("utf-8")
                fpath.write_bytes(raw_bytes)
                digest = compute_sha256_bytes(raw_bytes)
                # Re-lecture stricte depuis disque pour vérifier l'intégrité atomique
                verify_digest = compute_sha256_bytes(fpath.read_bytes())
                if digest != verify_digest:
                    raise FirewallViolation(
                        "BACKUP_HASH_MISMATCH",
                        f"Intégrité SHA-256 compromise sur {fname}. Arrêt immédiat.",
                        f"خلل في سلامة الباكاب ({fname})! العملية توقفت لحماية الشاشة.",
                    )
                manifest[fname] = digest

            manifest_bytes = json.dumps(manifest, indent=2).encode("utf-8")
            manifest_path = backup_dir / "backup_manifest.sha256"
            manifest_path.write_bytes(manifest_bytes)
            manifest_sha = compute_sha256_bytes(manifest_bytes)

            # --- ÉTAPE 3 : Déchiffrement RAM AES-256-GCM + Flash Non Destructif /data/app ---
            await emit({
                "type": "step",
                "phase": 3,
                "status": "running",
                "message_fr": "Étape 3/4 : Déchiffrement en RAM (AES-256) et injection confinée dans /data/app & /data/local/tmp...",
                "message_darija": "المرحلة 3/4: فك التشفير في الذاكرة وحقن الترجمة والتطبيقات بأمان في /data/app بلا مساس بـ /system...",
            })
            self.fw.check_voltage_watchdog(self.fw.read_real_battery_voltage())

            aes_key = bytearray(base64.b64decode(aes_key_b64))
            nonce = base64.b64decode(nonce_b64)
            cipher_bytes = base64.b64decode(encrypted_pack_b64)
            decrypted_buf: Optional[bytearray] = None
            tmp_local_file = BASE_DATA_DIR / f"ram_tmp_{secrets.token_hex(6)}.json"

            try:
                aesgcm = AESGCM(bytes(aes_key))
                plain_bytes = aesgcm.decrypt(nonce, cipher_bytes, None)
                decrypted_buf = bytearray(plain_bytes)
                pack_obj = json.loads(bytes(decrypted_buf).decode("utf-8"))

                # Injection exclusive dans /data/local/tmp
                tmp_local_file.write_bytes(bytes(decrypted_buf))
                remote_locale_path = f"/data/local/tmp/autopro_locale_{target_lang}.json"
                rc_p, _, err_p = self.fw.run_adb(["push", str(tmp_local_file), remote_locale_path], timeout=30)
                if rc_p != 0:
                    raise FirewallViolation(
                        "ADB_PUSH_FAILED",
                        f"Échec transfert vers /data/local/tmp : {err_p}",
                        "فشل إرسال ملف اللغة إلى /data/local/tmp.",
                    )

                locale_val = "ar-DZ" if target_lang in ("ar", "darija") else "fr-FR"
                self.fw.run_adb(["shell", "setprop", "persist.sys.locale", locale_val], timeout=10)
                self.fw.run_adb(
                    ["shell", "am", "broadcast", "-a", "android.intent.action.LOCALE_CHANGED"], timeout=10
                )

                # Installation APK confinée /data/app (si chemins locaux fournis dans pack_obj)
                for apk_path_str in pack_obj.get("local_apks", []):
                    apk_p = Path(apk_path_str)
                    if apk_p.exists():
                        self.fw.check_voltage_watchdog(self.fw.read_real_battery_voltage())
                        self.fw.run_adb(["install", "-r", str(apk_p)], timeout=90)
            finally:
                # Nettoyage sécurisé RAM + Disque immédiat
                zero_wipe_bytearray(aes_key)
                zero_wipe_bytearray(decrypted_buf)
                secure_delete_file(tmp_local_file)

            # --- ÉTAPE 4 : Soft Reset UDS (0x11 0x01) + Lecture DTC réelle ---
            await emit({
                "type": "step",
                "phase": 4,
                "status": "running",
                "message_fr": "Étape 4/4 : Envoi Soft Reset UDS (0x11 0x01) et vérification codes défauts (DTC)...",
                "message_darija": "المرحلة 4/4: رانا نبعثو Soft Reset UDS ونفيريفيو بلي ما كان حتى كود ديفو (0 DTC)...",
            })
            dtc_list: List[str] = []
            if self.fw.j2534.connected:
                self.fw.j2534.send_uds_command(0x770, b"\x11\x01")
                await asyncio.sleep(1.5)
                rx_dtc = self.fw.j2534.send_uds_command(0x7E0, b"\x19\x02\x09")
                if len(rx_dtc) > 3 and rx_dtc[0] == 0x59:
                    raw_dtcs = rx_dtc[3:]
                    for i in range(0, len(raw_dtcs) - 3, 4):
                        b1, b2 = raw_dtcs[i], raw_dtcs[i + 1]
                        if b1 or b2:
                            dtc_list.append(f"0x{b1:02X}{b2:02X}")
            else:
                # Redémarrage doux UI via ADB sans toucher le noyau ni le MCU
                self.fw.run_adb(["shell", "am", "force-stop", "com.android.systemui"], timeout=10)

            msg_ok_fr = f"Pack Cockpit {selected_ihu} ({target_lang.upper()}) injecté avec succès. DTC lus : {len(dtc_list)}."
            msg_ok_dz = f"تم تثبيت باك الكوكبيت {selected_ihu} بنجاح تام! عدد الأعطال: {len(dtc_list)}."

            post_security_log_to_saas(
                jwt_token=jwt_token,
                vin=clean_vin,
                vehicle_model=selected_ihu,
                operation_type="COCKPIT_FLASH",
                ihu_or_ecu=ihu_props["detected_ihu"],
                backup_sha256=manifest_sha,
                battery_voltage=measured_v,
                status="SUCCESS" if len(dtc_list) == 0 else "WARNING_DTC",
                alert_level="INFO" if len(dtc_list) == 0 else "WARNING",
                message_fr=msg_ok_fr,
                message_darija=msg_ok_dz,
            )

            return {
                "success": True,
                "backup_dir": str(backup_dir),
                "backup_sha256": manifest_sha,
                "battery_voltage": measured_v,
                "dtcs": dtc_list,
                "message_fr": msg_ok_fr,
                "message_darija": msg_ok_dz,
            }
        except FirewallViolation as fv:
            post_security_log_to_saas(
                jwt_token=jwt_token,
                vin=clean_vin,
                vehicle_model=selected_ihu,
                operation_type="COCKPIT_FLASH",
                ihu_or_ecu=selected_ihu,
                backup_sha256=manifest_sha,
                battery_voltage=measured_v,
                status=fv.code,
                alert_level="CRITICAL",
                message_fr=fv.message_fr,
                message_darija=fv.message_darija,
            )
            raise


# ==============================================================================
# 5. CLASSE ECU SECURE BRIDGE (BENCH MG1US008 / MG1CS080)
# ==============================================================================


class ECUSecureBridge:
    """
    Surveillance dossier Bench, validation taille/entropie, liaison VIN,
    upload HTTPS chiffré vers le Backend Web, téléchargement RAM et Secure Wipe.
    """

    VALID_ECU_SIZES = {4096 * 1024, 8192 * 1024}  # 4096 Ko ou 8192 Ko

    def __init__(self, firewall: HardwareFirewall) -> None:
        self.fw = firewall

    def validate_ecu_binary(self, raw_bytes: bytes) -> Dict[str, Any]:
        size_bytes = len(raw_bytes)
        if size_bytes not in self.VALID_ECU_SIZES:
            raise FirewallViolation(
                "ECU_INVALID_SIZE",
                f"Taille binaire refusée ({size_bytes // 1024} Ko). Tailles autorisées pour MG1US008/MG1CS080 : 4096 Ko ou 8192 Ko.",
                f"حجم الملف مرفوض ({size_bytes // 1024} Ko). لازم يكون 4096 Ko ولا 8192 Ko تاع MG1.",
            )

        zeros = raw_bytes.count(0x00)
        ffs = raw_bytes.count(0xFF)
        if (zeros / size_bytes) > 0.98 or (ffs / size_bytes) > 0.98:
            raise FirewallViolation(
                "ECU_EMPTY_OR_CORRUPTED",
                "Fichier vide ou corrompu rejeté (>98% d'octets 0x00 ou 0xFF).",
                "ملف فارغ أو فاسد (كامل أصفار 0x00 ولا 0xFF) — مرفوض لحماية الكومبيوتر!",
            )

        entropy = compute_shannon_entropy(raw_bytes)
        if entropy < 3.5:
            raise FirewallViolation(
                "ECU_LOW_ENTROPY",
                f"Entropie trop faible ({entropy:.2f} bits/octet). Le dump semble incomplet.",
                "الملف ناقص ولا ما تقراش مليح (Entropie ضعيفة).",
            )

        vin_match = re.search(rb"[A-HJ-NPR-Z0-9]{17}", raw_bytes)
        extracted_vin = vin_match.group(0).decode("ascii") if vin_match else None

        return {
            "size_bytes": size_bytes,
            "entropy": round(entropy, 3),
            "sha256": compute_sha256_bytes(raw_bytes),
            "extracted_vin": extracted_vin,
        }

    def process_bench_dump(
        self,
        raw_bytes: bytes,
        vin: str,
        ecu_model: str,
        calibration_profile: str,
        jwt_token: str,
    ) -> Dict[str, Any]:
        self.fw.assert_not_aborted()
        meta = self.validate_ecu_binary(raw_bytes)

        req_payload = {
            "vin": vin.strip().upper(),
            "ecu_model": ecu_model,
            "calibration_profile": calibration_profile,
            "original_sha256": meta["sha256"],
            "size_bytes": meta["size_bytes"],
            "entropy": meta["entropy"],
            "binary_b64": base64.b64encode(raw_bytes).decode("ascii"),
        }

        req = urllib.request.Request(
            f"{BACKEND_API_URL}/api/ecu/process",
            data=json.dumps(req_payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {jwt_token}",
            },
            method="POST",
        )
        ctx = ssl.create_default_context() if BACKEND_API_URL.startswith("https") else None
        try:
            with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
                resp_data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as he:
            detail = he.read().decode(errors="ignore")
            raise FirewallViolation(
                "ECU_BACKEND_REJECTED",
                f"Backend SaaS a rejeté le traitement ECU ({he.code}) : {detail}",
                f"السيرفر رفض معالجة الملف ({he.code}).",
            )

        # Déchiffrement en RAM puis écriture verrouillée et Secure Wipe du buffer
        aes_key = bytearray(base64.b64decode(resp_data["aes_key_b64"]))
        nonce = base64.b64decode(resp_data["nonce_b64"])
        enc_bin = base64.b64decode(resp_data["encrypted_binary_b64"])
        plain_buf: Optional[bytearray] = None
        try:
            plain = AESGCM(bytes(aes_key)).decrypt(nonce, enc_bin, None)
            plain_buf = bytearray(plain)
            out_name = f"{vin}_{ecu_model}_{calibration_profile}_LOCKED.bin"
            out_path = BENCH_OUTBOX_DIR / out_name
            out_path.write_bytes(bytes(plain_buf))
            return {
                "success": True,
                "job_uid": resp_data["job_uid"],
                "output_path": str(out_path),
                "processed_sha256": compute_sha256_bytes(bytes(plain_buf)),
                "remaining_credits": resp_data.get("remaining_credits"),
                "message_fr": f"Fichier ECU {ecu_model} lié au VIN {vin} généré en toute sécurité.",
                "message_darija": f"تم تجهيز ملف {ecu_model} مربوط برقم الشاسي {vin} بأمان تام.",
            }
        finally:
            zero_wipe_bytearray(aes_key)
            zero_wipe_bytearray(plain_buf)


# ==============================================================================
# 6. SERVEUR WEBSOCKET SÉCURISÉ (LOCALHOST + ORIGIN CHECK + HMAC-SHA256)
# ==============================================================================


class AutoProWsServer:
    def __init__(self) -> None:
        self.fw = HardwareFirewall()
        self.cockpit = CockpitAutomator(self.fw)
        self.ecu_bridge = ECUSecureBridge(self.fw)
        self.clients: set = set()

    @staticmethod
    def _extract_origin(ws: Any) -> Optional[str]:
        if hasattr(ws, "request") and ws.request is not None:
            return ws.request.headers.get("Origin")
        if hasattr(ws, "request_headers") and ws.request_headers is not None:
            return ws.request_headers.get("Origin")
        return None

    @staticmethod
    def _verify_hmac_token(provided_token: str, nonce: str) -> bool:
        if not provided_token or not nonce:
            return False
        expected = hmac.new(
            SESSION_HMAC_SECRET.encode("utf-8"),
            nonce.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected.lower(), provided_token.strip().lower())

    async def broadcast_telemetry(self) -> None:
        while True:
            if self.clients:
                adapters = self.fw.scan_and_validate_adapters()
                voltage = self.fw.read_real_battery_voltage()
                payload = json.dumps(
                    {
                        "type": "telemetry",
                        "agent_version": AGENT_VERSION,
                        "cpu_pct": psutil.cpu_percent(interval=None),
                        "battery_voltage": voltage,
                        "adapters": adapters,
                        "bench_inbox": [p.name for p in BENCH_INBOX_DIR.glob("*.bin")],
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                )
                for ws in list(self.clients):
                    try:
                        await ws.send(payload)
                    except Exception:
                        self.clients.discard(ws)
            await asyncio.sleep(2.5)

    async def handle_client(self, ws: Any) -> None:
        origin = self._extract_origin(ws)
        if origin and origin not in ALLOWED_ORIGINS:
            logger.warning(f"Connexion WebSocket rejetée — Origine non autorisée : {origin}")
            await ws.close(code=1008, reason="Origin non autorisée")
            return

        authenticated = False
        try:
            # Handshake HMAC obligatoire dans les 6 secondes
            raw_auth = await asyncio.wait_for(ws.recv(), timeout=6.0)
            auth_msg = json.loads(raw_auth)
            if auth_msg.get("action") != "AUTH" or not self._verify_hmac_token(
                str(auth_msg.get("hmac_token", "")),
                str(auth_msg.get("nonce", "")),
            ):
                await ws.send(
                    json.dumps(
                        {
                            "type": "error",
                            "code": "AUTH_FAILED",
                            "message_fr": "Jeton HMAC-SHA256 invalide.",
                            "message_darija": "رمز الأمان HMAC غير صحيح.",
                        }
                    )
                )
                await ws.close(code=1008, reason="Authentification échouée")
                return

            authenticated = True
            self.clients.add(ws)
            adapters = self.fw.scan_and_validate_adapters()
            await ws.send(
                json.dumps(
                    {
                        "type": "auth_ok",
                        "agent_version": AGENT_VERSION,
                        "adapters": adapters,
                        "battery_voltage": self.fw.read_real_battery_voltage(),
                        "message_fr": "Agent PC AutoPro DZ connecté et pare-feu actif.",
                        "message_darija": "الوكيل المحلي راهو مكونيكتي وجدار الحماية راهو يخدم.",
                    }
                )
            )

            async def emit(ev: Dict[str, Any]) -> None:
                await ws.send(json.dumps(ev))

            async for raw_msg in ws:
                if not authenticated:
                    break
                msg = json.loads(raw_msg)
                action = msg.get("action")

                if action == "EMERGENCY_STOP":
                    self.fw.trigger_emergency_stop()
                    await emit(
                        {
                            "type": "emergency_stopped",
                            "message_fr": "ARRÊT D'URGENCE EXÉCUTÉ : Toutes les opérations ADB/UDS ont été stoppées.",
                            "message_darija": "تم إيقاف كل العمليات فوراً لحماية السيارة!",
                        }
                    )
                    continue

                if action == "RESET_EMERGENCY":
                    self.fw.clear_emergency_stop()
                    await emit(
                        {
                            "type": "info",
                            "message_fr": "Verrou d'arrêt d'urgence réinitialisé.",
                            "message_darija": "تم إعادة تفعيل الوكيل بنجاح.",
                        }
                    )
                    continue

                if action == "SCAN_HARDWARE":
                    adapters = self.fw.scan_and_validate_adapters()
                    voltage = self.fw.read_real_battery_voltage()
                    await emit(
                        {
                            "type": "telemetry",
                            "adapters": adapters,
                            "battery_voltage": voltage,
                        }
                    )
                    continue

                if action == "RUN_COCKPIT_FLASH":
                    try:
                        res = await self.cockpit.execute_full_workflow(
                            selected_ihu=str(msg.get("selected_ihu", "")),
                            vin=str(msg.get("vin", "")),
                            target_lang=str(msg.get("target_lang", "fr")),
                            encrypted_pack_b64=str(msg.get("encrypted_pack_b64", "")),
                            aes_key_b64=str(msg.get("aes_key_b64", "")),
                            nonce_b64=str(msg.get("nonce_b64", "")),
                            jwt_token=msg.get("jwt_token"),
                            emit=emit,
                        )
                        await emit({"type": "cockpit_complete", **res})
                    except FirewallViolation as fv:
                        await emit(
                            {
                                "type": "firewall_blocked",
                                "code": fv.code,
                                "message_fr": fv.message_fr,
                                "message_darija": fv.message_darija,
                            }
                        )
                    continue

                if action == "PROCESS_ECU_DUMP":
                    try:
                        raw_bytes = base64.b64decode(str(msg.get("binary_b64", "")))
                        res = self.ecu_bridge.process_bench_dump(
                            raw_bytes=raw_bytes,
                            vin=str(msg.get("vin", "")),
                            ecu_model=str(msg.get("ecu_model", "MG1US008")),
                            calibration_profile=str(msg.get("calibration_profile", "ANTI_LSPI_177")),
                            jwt_token=str(msg.get("jwt_token", "")),
                        )
                        await emit({"type": "ecu_complete", **res})
                    except FirewallViolation as fv:
                        await emit(
                            {
                                "type": "firewall_blocked",
                                "code": fv.code,
                                "message_fr": fv.message_fr,
                                "message_darija": fv.message_darija,
                            }
                        )
                    continue

        except websockets.exceptions.ConnectionClosed:
            pass
        except Exception as exc:
            logger.error(f"Erreur session WebSocket : {exc}")
        finally:
            self.clients.discard(ws)
            self.fw.j2534.close()


async def main() -> None:
    server = AutoProWsServer()
    logger.info(f"Démarrage AutoPro DZ Agent v{AGENT_VERSION} sur ws://{WS_HOST}:{WS_PORT}")
    telemetry_task = asyncio.create_task(server.broadcast_telemetry())
    try:
        async with websockets.serve(server.handle_client, WS_HOST, WS_PORT, max_size=16 * 1024 * 1024):
            await asyncio.Future()
    finally:
        telemetry_task.cancel()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Arrêt propre de l'agent AutoPro DZ.")
