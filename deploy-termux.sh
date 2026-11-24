#!/usr/bin/env bash
set -e

DEFAULT_RENDER_URL="https://autopro-suitebacken.onrender.com"

echo "============================================================"
echo "  AUTOPRO DZ - DEPLOIEMENT TERMUX -> RENDER & FIREBASE"
echo "  Projet Firebase : autoprodz-a7071.web.app"
echo "============================================================"

# 0. Pull latest GitHub commits if inside a git repo
if [ -d ".git" ]; then
  echo "[0/4] Synchronisation GitHub (git pull)..."
  git pull --ff-only || true
fi

# 1. Resolve Render Backend URL (arg $1 > env VITE_API_URL > .env.production.local > DEFAULT_RENDER_URL)
if [ -n "$1" ]; then
  export VITE_API_URL="${1%/}"
elif [ -z "$VITE_API_URL" ] && [ -f ".env.production.local" ]; then
  set -a
  . ./.env.production.local
  set +a
fi

if [ -z "$VITE_API_URL" ]; then
  export VITE_API_URL="$DEFAULT_RENDER_URL"
fi

echo "VITE_API_URL=$VITE_API_URL" > .env.production.local
echo "[INFO] Backend Render lie : $VITE_API_URL"

echo "[1/4] Nettoyage de l'ancien build (dist)..."
rm -rf dist

echo "[2/4] Installation des dependances..."
npm install --include=dev

echo "[3/4] Compilation Vite + React (Admin, Verrouillage Démos, Caméras & ADAS)..."
npm run build

echo "[4/4] Deploiement sur Firebase Hosting (autoprodz-a7071)..."
export NODE_OPTIONS="--dns-result-order=ipv4first ${NODE_OPTIONS:-}"

FIREBASE_CMD="npx firebase-tools"
if command -v firebase >/dev/null 2>&1; then
  FIREBASE_CMD="firebase"
fi

DEPLOY_OK=0
for ATTEMPT in 1 2 3; do
  echo "Tentative Firebase Hosting ($ATTEMPT/3)..."
  if $FIREBASE_CMD deploy --only hosting --project autoprodz-a7071; then
    DEPLOY_OK=1
    break
  fi
  echo "⚠️ Echec reseau lors de la publication Firebase. Nouvelle tentative dans 4s..."
  sleep 4
done

if [ "$DEPLOY_OK" -ne 1 ]; then
  echo "❌ Echec apres 3 tentatives. Relancez avec --debug ou 'firebase login --reauth' :"
  echo "   NODE_OPTIONS=\"--dns-result-order=ipv4first\" $FIREBASE_CMD deploy --only hosting --project autoprodz-a7071 --debug"
  exit 1
fi

echo ""
echo "✅ Termine ! Ouvrez https://autoprodz-a7071.web.app (en navigation privee ou Ctrl+F5)."
