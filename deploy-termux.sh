#!/usr/bin/env bash
set -e

echo "============================================================"
echo "  AUTOPRO DZ - DEPLOIEMENT TERMUX -> RENDER & FIREBASE"
echo "  Projet Firebase : autoprodz-a7071.web.app"
echo "============================================================"

# 0. Pull latest GitHub commits if inside a git repo
if [ -d ".git" ]; then
  echo "[0/4] Synchronisation GitHub (git pull)..."
  git pull --ff-only || true
fi

# 1. Resolve Render Backend URL (arg $1 > env VITE_API_URL > .env.production.local)
if [ -n "$1" ]; then
  export VITE_API_URL="${1%/}"
  echo "VITE_API_URL=$VITE_API_URL" > .env.production.local
  echo "[INFO] URL Backend Render enregistree : $VITE_API_URL"
elif [ -n "$VITE_API_URL" ]; then
  export VITE_API_URL="${VITE_API_URL%/}"
  echo "VITE_API_URL=$VITE_API_URL" > .env.production.local
elif [ -f ".env.production.local" ]; then
  set -a
  . ./.env.production.local
  set +a
  echo "[INFO] URL Backend Render chargee depuis .env.production.local : $VITE_API_URL"
elif [ -t 0 ]; then
  echo ""
  echo "[IMPORTANT] Pour que Firebase Hosting (autoprodz-a7071.web.app) communique"
  echo "avec votre serveur Render (Admin, Abonnés, Verrouillage Démos) :"
  printf "Entrez l'URL de votre backend Render (ex: https://autopro-dz-backend.onrender.com) : "
  read -r INPUT_RENDER_URL
  if [ -n "$INPUT_RENDER_URL" ]; then
    export VITE_API_URL="${INPUT_RENDER_URL%/}"
    echo "VITE_API_URL=$VITE_API_URL" > .env.production.local
  fi
fi

echo "[1/4] Nettoyage de l'ancien build (dist)..."
rm -rf dist

echo "[2/4] Installation des dependances..."
npm install --include=dev

echo "[3/4] Compilation Vite + React (Admin, Verrouillage Démos, Caméras & ADAS)..."
npm run build

echo "[4/4] Deploiement sur Firebase Hosting (autoprodz-a7071)..."
if command -v firebase >/dev/null 2>&1; then
  firebase deploy --only hosting --project autoprodz-a7071
else
  npx firebase-tools deploy --only hosting --project autoprodz-a7071
fi

echo ""
echo "✅ Termine ! Ouvrez https://autoprodz-a7071.web.app (en navigation privee ou Ctrl+F5)."
