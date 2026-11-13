#!/usr/bin/env bash
set -e

echo "============================================================"
echo "  AUTOPRO DZ - DEPLOIEMENT TERMUX -> RENDER & FIREBASE"
echo "  Projet Firebase : autoprodz-a7071.web.app"
echo "============================================================"

if [ -n "$1" ]; then
  export VITE_API_URL="$1"
  echo "[INFO] URL Backend Render configuree : $VITE_API_URL"
fi

echo "[1/4] Nettoyage de l'ancien build (dist)..."
rm -rf dist

echo "[2/4] Installation des dependances..."
npm install --include=dev

echo "[3/4] Compilation Vite + React (Caméras & ADAS, Mode Atelier, PDF, Suivi Clients)..."
npm run build

echo "[4/4] Deploiement sur Firebase Hosting (autoprodz-a7071)..."
if command -v firebase >/dev/null 2>&1; then
  firebase deploy --only hosting --project autoprodz-a7071
else
  npx firebase-tools deploy --only hosting --project autoprodz-a7071
fi

echo ""
echo "✅ Termine ! Ouvrez https://autoprodz-a7071.web.app (videz le cache ou Ctrl+F5 / rafraichir sur tablette)."
