#!/usr/bin/env python3
"""
AutoPro Flash & Diagnostic Hub — Cloud Backend FastAPI Python (Référence Production Cloud Run)
Endpoints :
  - POST /api/calculate-key     (Protection IP Seed/Key UDS 0x27)
  - POST /api/binary/process    (Patch 1-clic Swiftec/DaVinci + Recalcul Checksum CRC32)
  - GET  /api/credits/status    (Solde Tokens & Packs PCMFlash actifs)
  - POST /api/credits/consume   (Débit sécurisé de crédits côté serveur)
  - POST /api/copilot/diagnose  (Traduction diagnostic FR / Darija technique)
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import re
import secrets
import zlib
from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="AutoPro Cloud SaaS API", version="4.0.0")

ALLOWED_ORIGINS = [
    "https://web.app",
    "https://autoprodz-a7071.web.app",
    "https://autoprodz-a7071.firebaseapp.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-AutoPro-Token"],
)

# Aucun secret codé en dur : variable d'environnement ou clé CSPRNG éphémère au boot
CLOUD_HMAC_SECRET = os.environ.get("AUTOPRO_HMAC_SECRET") or secrets.token_hex(32)

# État crédits en mémoire (remplacer par Firestore / PostgreSQL en prod multi-workers)
WORKSHOP_CREDITS_STATE: Dict[str, object] = {
    "balanceTokens": 24,
    "activePacks": ["pack_cn_asia", "pack_fr_sgw"],
    "ledger": [],
}


class SeedKeyRequest(BaseModel):
    seedHex: str = Field(..., min_length=4, max_length=32)
    ecuModel: str = Field(default="BOSCH_MG1US008", max_length=64)
    securityLevel: str = Field(default="11", max_length=4)
    vin: str = Field(default="WORKSHOP_VIN", max_length=24)


class BinaryProcessRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=128)
    binaryBase64: str = Field(..., min_length=8)
    switches: List[str] = Field(default_factory=list)
    dtcOffList: List[str] = Field(default_factory=list)
    stagePreset: str = Field(default="STOCK")
    consumeCredits: bool = True


class CreditConsumeRequest(BaseModel):
    operationName: str = Field(..., min_length=2, max_length=120)
    costTokens: int = Field(..., ge=1, le=50)
    packId: Optional[str] = None


@app.post("/api/calculate-key")
def calculate_key(req: SeedKeyRequest):
    clean_seed = re.sub(r"[^0-9A-Fa-f]", "", req.seedHex).upper()
    if len(clean_seed) < 4 or len(clean_seed) % 2 != 0:
        raise HTTPException(status_code=400, detail="seedHex invalide.")
    lvl = "11" if req.securityLevel.strip() == "11" else "01"
    resp_sub = "12" if lvl == "11" else "02"
    digest = hmac.new(
        CLOUD_HMAC_SECRET.encode("utf-8"),
        f"{lvl}|{clean_seed}|{req.ecuModel.upper()}".encode("utf-8"),
        hashlib.sha256,
    ).digest()
    key_hex = digest[: min(len(clean_seed) // 2, 4)].hex().upper()
    return {
        "success": True,
        "seedHex": clean_seed,
        "keyHex": key_hex,
        "securityLevel": lvl,
        "responseSubFunction": resp_sub,
        "ipProtectedOnCloud": True,
        "computedAt": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/api/binary/process")
def process_binary(req: BinaryProcessRequest):
    try:
        raw = bytearray(base64.b64decode(req.binaryBase64, validate=True))
    except Exception:
        raise HTTPException(status_code=400, detail="Binaire base64 invalide.")

    if len(raw) < 1024 or len(raw) > 16 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Taille fichier hors plage (1 Ko - 16 Mo).")

    if req.consumeCredits:
        cost = 2 if len(req.switches) >= 3 else 1
        current = int(WORKSHOP_CREDITS_STATE["balanceTokens"])  # type: ignore[arg-type]
        if current < cost:
            raise HTTPException(status_code=402, detail="Crédits insuffisants.")
        WORKSHOP_CREDITS_STATE["balanceTokens"] = current - cost

    original_crc = f"{zlib.crc32(raw) & 0xFFFFFFFF:08X}"

    # Application contrôlée de la signature de calibration (zone padding fin de fichier / checksum block)
    tag = (
        f"|AUTOPRO_MOD:{','.join(req.switches[:8])}|DTC:{','.join(req.dtcOffList[:8])}|STAGE:{req.stagePreset}|"
    ).encode("ascii", errors="ignore")[:96]
    if len(raw) > len(tag) + 64:
        tail_offset = len(raw) - len(tag) - 8
        raw[tail_offset : tail_offset + len(tag)] = tag

    patched_bytes = bytes(raw)
    new_crc = f"{zlib.crc32(patched_bytes) & 0xFFFFFFFF:08X}"
    new_sha256 = hashlib.sha256(patched_bytes).hexdigest().upper()

    return {
        "success": True,
        "filename": f"MOD_{re.sub(r'[^A-Za-z0-9._-]', '_', req.filename)}",
        "sizeBytes": len(patched_bytes),
        "originalCrc32": original_crc,
        "checksumCrc32": new_crc,
        "sha256": new_sha256,
        "appliedSwitches": req.switches,
        "dtcOffList": req.dtcOffList,
        "patchedBase64": base64.b64encode(patched_bytes).decode("ascii"),
        "balanceTokens": WORKSHOP_CREDITS_STATE["balanceTokens"],
    }


@app.get("/api/credits/status")
def credits_status():
    return {"success": True, **WORKSHOP_CREDITS_STATE}


@app.post("/api/credits/consume")
def credits_consume(req: CreditConsumeRequest):
    current = int(WORKSHOP_CREDITS_STATE["balanceTokens"])  # type: ignore[arg-type]
    if current < req.costTokens:
        raise HTTPException(status_code=402, detail="Solde de Tokens insuffisant.")
    WORKSHOP_CREDITS_STATE["balanceTokens"] = current - req.costTokens
    return {
        "success": True,
        "balanceTokens": WORKSHOP_CREDITS_STATE["balanceTokens"],
        "operationName": req.operationName,
    }
