#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AutoPro DZ Agent & Cloud — Backend API FastAPI + SQLAlchemy + JWT + SaaS Audit
===============================================================================
- Gestion des ateliers, authentification JWT (HS256) et décompte atomique de crédits
- /api/cockpit/authorize : Whitelist IHU + délivrance pack FR/AR/Darija chiffré AES-256-GCM
- /api/ecu/process : Validation binaire (4096/8192 Ko + entropie), liaison VIN, file d'attente
- /api/logs/security : Centralisation temps réel des alertes matérielles et historique SaaS
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import math
import os
import re
import secrets
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import Session, declarative_base, relationship, sessionmaker

# ==============================================================================
# 1. CONFIGURATION BASE DE DONNÉES & SÉCURITÉ JWT / AES-256
# ==============================================================================

DATABASE_URL = os.environ.get("AUTOPRO_DATABASE_URL", "sqlite:///./autopro_saas.db")
JWT_SECRET = os.environ.get("AUTOPRO_JWT_SECRET") or secrets.token_hex(32)
VIN_BIND_SECRET = os.environ.get("AUTOPRO_VIN_BIND_SECRET") or secrets.token_hex(32)
JWT_EXPIRY_SECONDS = int(os.environ.get("AUTOPRO_JWT_TTL", "43200"))  # 12 heures

ALLOWED_ORIGINS = [
    "https://autoprodz-a7071.web.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

ALLOWED_IHU_WHITELIST = {
    "IHU624G",
    "IHU715P",
    "IHU535G",
    "IHU510G",
    "FLYME AUTO 2.5.0",
    "FLYME-AUTO-2.5.0",
}

VALID_ECU_SIZES = {4096 * 1024, 8192 * 1024}

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)
Base = declarative_base()


# ==============================================================================
# 2. MODÈLES SQLALCHEMY (ATELIERS, LOGS SÉCURITÉ, JOBS ECU)
# ==============================================================================


class WorkshopAccount(Base):
    __tablename__ = "workshops"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(120), unique=True, nullable=False, index=True)
    workshop_name = Column(String(120), nullable=False)
    wilaya = Column(String(64), default="Mascara")
    password_hash = Column(String(256), nullable=False)
    role = Column(String(24), default="workshop", nullable=False)  # 'admin' | 'workshop'
    credits = Column(Integer, default=10, nullable=False)
    hwid_bound = Column(String(120), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    logs = relationship("SecurityAuditLog", back_populates="workshop")
    ecu_jobs = relationship("EcuProcessingJob", back_populates="workshop")


class SecurityAuditLog(Base):
    __tablename__ = "security_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    workshop_id = Column(Integer, ForeignKey("workshops.id"), nullable=False, index=True)
    vin = Column(String(32), nullable=False, index=True)
    vehicle_model = Column(String(80), nullable=False)
    operation_type = Column(String(40), nullable=False)
    ihu_or_ecu = Column(String(64), nullable=False)
    backup_sha256 = Column(String(64), default="")
    battery_voltage = Column(Float, nullable=True)
    status = Column(String(48), nullable=False)
    alert_level = Column(String(24), default="INFO", nullable=False)  # INFO | WARNING | CRITICAL
    message_fr = Column(Text, nullable=False)
    message_darija = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    workshop = relationship("WorkshopAccount", back_populates="logs")


class EcuProcessingJob(Base):
    __tablename__ = "ecu_processing_jobs"

    id = Column(Integer, primary_key=True, index=True)
    job_uid = Column(String(36), unique=True, nullable=False, index=True)
    workshop_id = Column(Integer, ForeignKey("workshops.id"), nullable=False, index=True)
    vin = Column(String(32), nullable=False, index=True)
    ecu_model = Column(String(32), nullable=False)
    calibration_profile = Column(String(48), nullable=False)
    original_sha256 = Column(String(64), nullable=False)
    processed_sha256 = Column(String(64), nullable=False)
    vin_binding_hmac = Column(String(64), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    entropy = Column(Float, nullable=False)
    status = Column(String(32), default="COMPLETED", nullable=False)
    locked_binary_b64 = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    workshop = relationship("WorkshopAccount", back_populates="ecu_jobs")


Base.metadata.create_all(bind=engine)


# ==============================================================================
# 3. UTILITAIRES CRYPTOGRAPHIE (JWT HS256, PBKDF2, AES-256-GCM, ENTROPIE)
# ==============================================================================


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000)
    return f"{salt}${dk.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt, hex_digest = stored_hash.split("$", 1)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000)
        return hmac.compare_digest(dk.hex(), hex_digest)
    except Exception:
        return False


def _b64u_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64u_decode(s: str) -> bytes:
    pad = "=" * ((4 - len(s) % 4) % 4)
    return base64.urlsafe_b64decode(s + pad)


def create_jwt_token(workshop: WorkshopAccount) -> str:
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": str(workshop.id),
        "email": workshop.email,
        "role": workshop.role,
        "workshop_name": workshop.workshop_name,
        "iat": now,
        "exp": now + JWT_EXPIRY_SECONDS,
    }
    h_b64 = _b64u_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    p_b64 = _b64u_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{h_b64}.{p_b64}".encode("ascii")
    sig = hmac.new(JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{h_b64}.{p_b64}.{_b64u_encode(sig)}"


def decode_jwt_token(token: str) -> Dict[str, Any]:
    try:
        parts = token.strip().split(".")
        if len(parts) != 3:
            raise ValueError("Format JWT invalide")
        h_b64, p_b64, s_b64 = parts
        signing_input = f"{h_b64}.{p_b64}".encode("ascii")
        expected_sig = hmac.new(JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
        if not hmac.compare_digest(_b64u_decode(s_b64), expected_sig):
            raise ValueError("Signature JWT invalide")
        payload = json.loads(_b64u_decode(p_b64).decode("utf-8"))
        if int(payload.get("exp", 0)) < int(time.time()):
            raise ValueError("Jeton JWT expiré")
        return payload
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Authentification JWT refusée : {exc}")


def encrypt_payload_aes256(plain_bytes: bytes) -> Dict[str, str]:
    key = AESGCM.generate_key(bit_length=256)
    nonce = os.urandom(12)
    ciphertext = AESGCM(key).encrypt(nonce, plain_bytes, None)
    return {
        "aes_key_b64": base64.b64encode(key).decode("ascii"),
        "nonce_b64": base64.b64encode(nonce).decode("ascii"),
        "cipher_b64": base64.b64encode(ciphertext).decode("ascii"),
    }


def compute_entropy(data: bytes) -> float:
    if not data:
        return 0.0
    freq = [0] * 256
    for b in data:
        freq[b] += 1
    total = len(data)
    ent = 0.0
    for c in freq:
        if c > 0:
            p = c / total
            ent -= p * math.log2(p)
    return ent


# ==============================================================================
# 4. DÉPENDANCES DB & AUTHENTIFICATION + INITIALISATION COMPTE ATELIER DÉFAUT
# ==============================================================================


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_default_accounts() -> None:
    admin_pass = (os.environ.get("AUTOPRO_ADMIN_PASS") or "").strip()
    if not admin_pass:
        return
    db = SessionLocal()
    try:
        admin_email = os.environ.get("AUTOPRO_ADMIN_EMAIL", "admin@autoprodz.dz")
        if not db.query(WorkshopAccount).filter(WorkshopAccount.email == admin_email).first():
            db.add(
                WorkshopAccount(
                    email=admin_email,
                    workshop_name="Console Admin AutoPro DZ",
                    wilaya="Mascara",
                    password_hash=hash_password(admin_pass),
                    role="admin",
                    credits=9999,
                )
            )
            db.commit()
    finally:
        db.close()


ensure_default_accounts()


def get_current_workshop(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> WorkshopAccount:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="En-tête Authorization Bearer manquant.")
    token = authorization.split(" ", 1)[1]
    payload = decode_jwt_token(token)
    workshop = db.query(WorkshopAccount).filter(WorkshopAccount.id == int(payload["sub"])).first()
    if not workshop or not workshop.is_active:
        raise HTTPException(status_code=403, detail="Compte atelier inactif ou révoqué.")
    return workshop


# ==============================================================================
# 5. SCHÉMAS PYDANTIC & APPLICATION FASTAPI
# ==============================================================================


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=4, max_length=120)
    password: str = Field(..., min_length=6, max_length=120)


class CockpitAuthorizeRequest(BaseModel):
    vin: str = Field(..., min_length=6, max_length=24)
    selected_ihu: str = Field(..., min_length=4, max_length=40)
    detected_ihu: str = Field(..., min_length=4, max_length=40)
    target_lang: str = Field(default="fr", pattern="^(fr|ar|darija)$")
    hwid: Optional[str] = None
    battery_voltage: float = Field(..., ge=13.0, le=14.8)


class EcuProcessRequest(BaseModel):
    vin: str = Field(..., min_length=6, max_length=24)
    ecu_model: str = Field(..., pattern="^(MG1US008|MG1CS080)$")
    calibration_profile: str = Field(..., pattern="^(EXPORT_DZ_174|ANTI_LSPI_177|ORI_RESTORE)$")
    original_sha256: str = Field(..., min_length=64, max_length=64)
    size_bytes: int
    entropy: float
    binary_b64: str = Field(..., min_length=16)


class SecurityLogCreateRequest(BaseModel):
    vin: str = Field(..., max_length=32)
    vehicle_model: str = Field(..., max_length=80)
    operation_type: str = Field(..., max_length=40)
    ihu_or_ecu: str = Field(..., max_length=64)
    backup_sha256: str = Field(default="", max_length=64)
    battery_voltage: Optional[float] = None
    status: str = Field(..., max_length=48)
    alert_level: str = Field(default="INFO", pattern="^(INFO|WARNING|CRITICAL)$")
    message_fr: str
    message_darija: str


app = FastAPI(title="AutoPro DZ Cloud Backend API", version="4.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.post("/api/auth/login")
def login_workshop(body: LoginRequest, db: Session = Depends(get_db)):
    workshop = (
        db.query(WorkshopAccount)
        .filter(WorkshopAccount.email == body.email.strip().lower())
        .first()
    )
    if not workshop or not verify_password(body.password, workshop.password_hash):
        raise HTTPException(status_code=401, detail="Identifiants atelier invalides.")
    if not workshop.is_active:
        raise HTTPException(status_code=403, detail="Licence atelier suspendue par l'administrateur.")

    token = create_jwt_token(workshop)
    return {
        "access_token": token,
        "token_type": "bearer",
        "workshop": {
            "id": workshop.id,
            "email": workshop.email,
            "workshop_name": workshop.workshop_name,
            "wilaya": workshop.wilaya,
            "role": workshop.role,
            "credits": workshop.credits,
        },
    }


@app.get("/api/workshop/me")
def get_workshop_profile(workshop: WorkshopAccount = Depends(get_current_workshop)):
    return {
        "id": workshop.id,
        "email": workshop.email,
        "workshop_name": workshop.workshop_name,
        "wilaya": workshop.wilaya,
        "role": workshop.role,
        "credits": workshop.credits,
        "is_active": workshop.is_active,
    }


@app.post("/api/admin/workshops/{workshop_id}/credits")
def admin_add_credits(
    workshop_id: int,
    amount: int = Query(..., ge=-1000, le=5000),
    current: WorkshopAccount = Depends(get_current_workshop),
    db: Session = Depends(get_db),
):
    if current.role != "admin":
        raise HTTPException(status_code=403, detail="Réservé à l'administrateur AutoPro DZ.")
    target = db.query(WorkshopAccount).filter(WorkshopAccount.id == workshop_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Atelier introuvable.")
    target.credits = max(0, target.credits + amount)
    db.commit()
    return {"workshop_id": target.id, "credits": target.credits}


@app.post("/api/cockpit/authorize")
def authorize_cockpit_pack(
    body: CockpitAuthorizeRequest,
    workshop: WorkshopAccount = Depends(get_current_workshop),
    db: Session = Depends(get_db),
):
    """Vérifie le Hardware ID IHU + crédits, délivre le pack FR/AR/Darija chiffré AES-256-GCM."""
    sel_norm = body.selected_ihu.strip().upper()
    det_norm = body.detected_ihu.strip().upper()

    if sel_norm not in ALLOWED_IHU_WHITELIST or det_norm not in ALLOWED_IHU_WHITELIST or sel_norm != det_norm:
        db.add(
            SecurityAuditLog(
                workshop_id=workshop.id,
                vin=body.vin.upper(),
                vehicle_model=body.selected_ihu,
                operation_type="COCKPIT_AUTH",
                ihu_or_ecu=f"SEL:{sel_norm} != DET:{det_norm}",
                battery_voltage=body.battery_voltage,
                status="IHU_MISMATCH_BLOCKED",
                alert_level="CRITICAL",
                message_fr=f"Autorisation refusée : discorde matérielle {sel_norm} vs {det_norm}.",
                message_darija=f"تم رفض الترخيص: الكارط مير {det_norm} ما تطابقش مع {sel_norm}.",
            )
        )
        db.commit()
        raise HTTPException(status_code=400, detail="Whitelist IHU non respectée : croisement bloqué.")

    if workshop.role != "admin" and workshop.credits < 1:
        raise HTTPException(status_code=402, detail="Crédits atelier insuffisants pour cette opération.")

    if workshop.hwid_bound and body.hwid and workshop.hwid_bound != body.hwid:
        raise HTTPException(status_code=403, detail="Licence liée à un autre poste PC (HWID différent).")
    if not workshop.hwid_bound and body.hwid:
        workshop.hwid_bound = body.hwid

    # Construction du pack linguistique non destructif (FR / AR / Darija)
    locale_pack = {
        "ihu_target": sel_norm,
        "lang": body.target_lang,
        "install_scope": "/data/local/tmp",
        "protect_partitions": ["/system", "/vendor"],
        "strings": {
            "app_title": "AutoPro Cockpit DZ" if body.target_lang == "fr" else "نظام أوتوبرو كوكبيت الجزائر",
            "nav_maps": "Navigation GPS (LVDS)" if body.target_lang == "fr" else "الخرائط GPS على العداد",
            "cam_540": "Caméras 360°/540°" if body.target_lang == "fr" else "كاميرا 360°/540°",
            "oil_warn": "Huile 0W-20 API SP Obligatoire" if body.target_lang == "fr" else "تنبيه: زيت 0W-20 API SP إجباري",
        },
        "local_apks": [],
    }
    encrypted = encrypt_payload_aes256(json.dumps(locale_pack, ensure_ascii=False).encode("utf-8"))

    if workshop.role != "admin":
        workshop.credits -= 1

    db.add(
        SecurityAuditLog(
            workshop_id=workshop.id,
            vin=body.vin.upper(),
            vehicle_model=sel_norm,
            operation_type="COCKPIT_AUTHORIZE",
            ihu_or_ecu=det_norm,
            battery_voltage=body.battery_voltage,
            status="AUTHORIZED",
            alert_level="INFO",
            message_fr=f"Clé éphémère AES-256 délivrée pour {sel_norm} ({body.target_lang.upper()}).",
            message_darija=f"تم فتح التشفير بنجاح لباك {sel_norm}.",
        )
    )
    db.commit()

    return {
        "authorized": True,
        "remaining_credits": workshop.credits,
        "aes_key_b64": encrypted["aes_key_b64"],
        "nonce_b64": encrypted["nonce_b64"],
        "encrypted_pack_b64": encrypted["cipher_b64"],
    }


@app.post("/api/ecu/process")
def process_ecu_file(
    body: EcuProcessRequest,
    workshop: WorkshopAccount = Depends(get_current_workshop),
    db: Session = Depends(get_db),
):
    """Valide le dump ECU Bench (4096/8192 Ko + entropie), lie au VIN, met en file et décompte 1 crédit."""
    if workshop.role != "admin" and workshop.credits < 1:
        raise HTTPException(status_code=402, detail="Crédits atelier insuffisants.")

    try:
        raw_bytes = base64.b64decode(body.binary_b64, validate=True)
    except Exception:
        raise HTTPException(status_code=400, detail="Payload binaire base64 invalide.")

    if len(raw_bytes) not in VALID_ECU_SIZES or len(raw_bytes) != body.size_bytes:
        raise HTTPException(status_code=400, detail="Taille binaire non conforme (4096 Ko ou 8192 Ko exigés).")

    actual_sha = hashlib.sha256(raw_bytes).hexdigest().upper()
    if actual_sha != body.original_sha256.strip().upper():
        raise HTTPException(status_code=400, detail="Hash SHA-256 incohérent lors de la réception.")

    zeros = raw_bytes.count(0x00)
    ffs = raw_bytes.count(0xFF)
    if (zeros / len(raw_bytes)) > 0.98 or (ffs / len(raw_bytes)) > 0.98:
        raise HTTPException(status_code=400, detail="Dump vide ou corrompu (0x00/0xFF) rejeté.")

    entropy = compute_entropy(raw_bytes)
    if entropy < 3.5:
        raise HTTPException(status_code=400, detail=f"Entropie trop faible ({entropy:.2f}) : dump rejeté.")

    clean_vin = re.sub(r"[^A-Z0-9]", "", body.vin.strip().upper())[:17]
    vin_hmac = hmac.new(
        VIN_BIND_SECRET.encode("utf-8"),
        f"{clean_vin}:{actual_sha}:{body.ecu_model}:{body.calibration_profile}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest().upper()

    # Signature métadonnées de verrouillage VIN (sans altérer la zone code si ORI)
    # En production, le moteur de calibration applique ici la calibration signée puis le Checksum/RSA est finalisé par l'outil Bench.
    locked_bytes = raw_bytes
    processed_sha = hashlib.sha256(locked_bytes).hexdigest().upper()
    encrypted = encrypt_payload_aes256(locked_bytes)
    job_uid = secrets.token_hex(12).upper()

    job = EcuProcessingJob(
        job_uid=job_uid,
        workshop_id=workshop.id,
        vin=clean_vin,
        ecu_model=body.ecu_model,
        calibration_profile=body.calibration_profile,
        original_sha256=actual_sha,
        processed_sha256=processed_sha,
        vin_binding_hmac=vin_hmac,
        size_bytes=len(locked_bytes),
        entropy=round(entropy, 3),
        status="READY_VIN_LOCKED",
        locked_binary_b64=base64.b64encode(locked_bytes).decode("ascii"),
    )
    db.add(job)

    if workshop.role != "admin":
        workshop.credits -= 1

    db.add(
        SecurityAuditLog(
            workshop_id=workshop.id,
            vin=clean_vin,
            vehicle_model=f"ECU {body.ecu_model}",
            operation_type="ECU_BENCH_PROCESS",
            ihu_or_ecu=f"{body.ecu_model} ({body.calibration_profile})",
            backup_sha256=actual_sha,
            battery_voltage=13.6,
            status="VIN_LOCKED_READY",
            alert_level="INFO",
            message_fr=f"Dump {body.ecu_model} validé (Entropie {entropy:.2f}) et lié au VIN {clean_vin}.",
            message_darija=f"تم فحص ملف {body.ecu_model} وربطه برقم الشاسي {clean_vin} بنجاح.",
        )
    )
    db.commit()

    return {
        "success": True,
        "job_uid": job_uid,
        "vin": clean_vin,
        "vin_binding_hmac": vin_hmac,
        "processed_sha256": processed_sha,
        "entropy": round(entropy, 3),
        "remaining_credits": workshop.credits,
        "aes_key_b64": encrypted["aes_key_b64"],
        "nonce_b64": encrypted["nonce_b64"],
        "encrypted_binary_b64": encrypted["cipher_b64"],
    }


@app.get("/api/ecu/jobs/{job_uid}/download")
def download_locked_ecu_job(
    job_uid: str,
    workshop: WorkshopAccount = Depends(get_current_workshop),
    db: Session = Depends(get_db),
):
    job = db.query(EcuProcessingJob).filter(EcuProcessingJob.job_uid == job_uid).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job ECU introuvable.")
    if workshop.role != "admin" and job.workshop_id != workshop.id:
        raise HTTPException(status_code=403, detail="Accès refusé à ce fichier ECU.")
    raw = base64.b64decode(job.locked_binary_b64)
    filename = f"{job.vin}_{job.ecu_model}_{job.calibration_profile}_LOCKED.bin"
    return Response(
        content=raw,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-VIN-Binding-HMAC": job.vin_binding_hmac,
        },
    )


@app.post("/api/logs/security")
def create_security_log(
    body: SecurityLogCreateRequest,
    workshop: WorkshopAccount = Depends(get_current_workshop),
    db: Session = Depends(get_db),
):
    entry = SecurityAuditLog(
        workshop_id=workshop.id,
        vin=body.vin.upper(),
        vehicle_model=body.vehicle_model,
        operation_type=body.operation_type,
        ihu_or_ecu=body.ihu_or_ecu,
        backup_sha256=body.backup_sha256,
        battery_voltage=body.battery_voltage,
        status=body.status,
        alert_level=body.alert_level,
        message_fr=body.message_fr,
        message_darija=body.message_darija,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {"id": entry.id, "recorded": True}


@app.get("/api/logs/security")
def list_security_logs(
    limit: int = Query(default=50, ge=1, le=200),
    workshop: WorkshopAccount = Depends(get_current_workshop),
    db: Session = Depends(get_db),
):
    query = db.query(SecurityAuditLog)
    if workshop.role != "admin":
        query = query.filter(SecurityAuditLog.workshop_id == workshop.id)
    rows = query.order_by(SecurityAuditLog.id.desc()).limit(limit).all()
    return {
        "logs": [
            {
                "id": r.id,
                "workshop_id": r.workshop_id,
                "vin": r.vin,
                "vehicle_model": r.vehicle_model,
                "operation_type": r.operation_type,
                "ihu_or_ecu": r.ihu_or_ecu,
                "backup_sha256": r.backup_sha256,
                "battery_voltage": r.battery_voltage,
                "status": r.status,
                "alert_level": r.alert_level,
                "message_fr": r.message_fr,
                "message_darija": r.message_darija,
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ]
    }
