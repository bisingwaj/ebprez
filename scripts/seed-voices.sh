#!/usr/bin/env bash
# Generate French voice clips (macOS `say`) and register them to the audio slots.
# Useful to demo/test the audio-driven sequence locally without recording anything.
# Requires the dev server running (default http://localhost:3000) and macOS `say`+`afconvert`.
#
# Usage:  bash scripts/seed-voices.sh [BASE_URL] [ADMIN_SECRET] [VOICE]
set -e

BASE="${1:-http://localhost:3000}"
SECRET="${2:-etoile-bleue-admin}"
VOICE="${3:-Jacques}"
TMP="$(mktemp -d)"

# Communes — MUST match the order in lib/nodes.js
COMMUNES=(Gombe Lingwala Barumbu Kinshasa "Kasa-Vubu" Kalamu Kintambo Bandalungwa Bumbu Makala Ngiri-Ngiri Ngaba Lemba Matete Limete Kisenso Ngaliema Selembao Mont-Ngafula Kimbanseke Masina Ndjili Nsele Maluku)

say_clip() { # $1 text -> echoes path to .m4a
  local text="$1" base="$TMP/clip_$RANDOM"
  say -v "$VOICE" -o "$base.aiff" "$text" >/dev/null 2>&1
  afconvert "$base.aiff" "$base.m4a" -f m4af -d aac >/dev/null 2>&1
  echo "$base.m4a"
}

register() { # $1 slot  $2 text
  local slot="$1" text="$2"
  local file; file="$(say_clip "$text")"
  local url; url="$(curl -s -X POST "$BASE/api/local-upload" -F "secret=$SECRET" -F "file=@$file" | python3 -c 'import sys,json;print(json.load(sys.stdin)["url"])')"
  curl -s -X POST "$BASE/api/audios" -H "Authorization: Bearer $SECRET" -H "Content-Type: application/json" \
    -d "{\"action\":\"register\",\"slot\":\"$slot\",\"blob\":{\"url\":\"$url\",\"name\":\"$slot.m4a\"}}" >/dev/null
  echo "  ✓ $slot — \"$text\""
}

echo "Validation voices…"
register validation_minister "Validation faite par le Ministre de la Santé."
register validation_pm "Validation faite par la Première Ministre."
register president_prompt "Monsieur le Président, confirmez-vous le lancement du système ?"
register president_confirm "Lancement du système Étoile Bleue."

echo "Phase voices…"
register phase_deploy "Déploiement du réseau sur la ville-province de Kinshasa."
register phase_countdown "Séquence d'activation engagée."
register phase_activation "Étoile Bleue. Service activé. Numéro d'urgence national : un, neuf, neuf."

echo "Commune voices (24)…"
i=0
for name in "${COMMUNES[@]}"; do
  register "commune_$i" "Service activé à $name."
  i=$((i+1))
done

rm -rf "$TMP"
echo "Terminé. Ouvrez /projection (armez), puis lancez via les validateurs ou /admin."
