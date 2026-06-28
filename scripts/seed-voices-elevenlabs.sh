#!/usr/bin/env bash
# Generate natural ElevenLabs voices for every slot via the running app's /api/tts.
# Requires the dev server running with ELEVENLABS_API_KEY set.
# Usage: bash scripts/seed-voices-elevenlabs.sh [BASE_URL] [ADMIN_SECRET] [MODEL]
set -e
BASE="${1:-http://localhost:3000}"
SECRET="${2:-etoile-bleue-admin}"
MODEL="${3:-eleven_multilingual_v2}"

# French / African-accent voices (override via env).
ANNOUNCER="${ANNOUNCER:-CHivAFig5q0FuNMEEmFi}"  # Diba   — africain, posé (annonces + Président)
MINISTER="${MINISTER:-FgHDn7bpgpKqz7QttoyC}"    # Donovan — africain, grave, sérieux
FEMALE="${FEMALE:-UaGvaD7NWzU5mJNoUqoY}"        # Perle  — française corporate (Première Ministre)

COMMUNES=(Gombe Lingwala Barumbu Kinshasa "Kasa-Vubu" Kalamu Kintambo Bandalungwa Bumbu Makala Ngiri-Ngiri Ngaba Lemba Matete Limete Kisenso Ngaliema Selembao Mont-Ngafula Kimbanseke Masina Ndjili Nsele Maluku)

echo "Modèle: $MODEL | Annonceur/Président: $ANNOUNCER | Ministre: $MINISTER | PM: $FEMALE"

gen() { # $1 slot  $2 text  $3 voiceId
  local out; out=$(curl -s -X POST "$BASE/api/tts" -H "Authorization: Bearer $SECRET" -H "Content-Type: application/json" \
    -d "$(python3 -c 'import json,sys; print(json.dumps({"slot":sys.argv[1],"text":sys.argv[2],"voiceId":sys.argv[3],"model":sys.argv[4]}))' "$1" "$2" "$3" "$MODEL")")
  if echo "$out" | grep -q '"ok":true'; then echo "  ✓ $1"; else echo "  ✗ $1 -> $out"; fi
}
# French forced (turbo v2.5 supports language_code) — used for the spoken numbers
genfr() { # $1 slot  $2 text  $3 voiceId
  local out; out=$(curl -s -X POST "$BASE/api/tts" -H "Authorization: Bearer $SECRET" -H "Content-Type: application/json" \
    -d "$(python3 -c 'import json,sys; print(json.dumps({"slot":sys.argv[1],"text":sys.argv[2],"voiceId":sys.argv[3],"model":"eleven_turbo_v2_5","languageCode":"fr"}))' "$1" "$2" "$3")")
  if echo "$out" | grep -q '"ok":true'; then echo "  ✓ $1"; else echo "  ✗ $1 -> $out"; fi
}

echo "Validations…"
gen validation_minister "Validation faite par le Ministre de la Santé." "$MINISTER"
gen validation_pm "Validation faite par la Première Ministre." "$FEMALE"
gen president_prompt "Monsieur le Président, voulez-vous initialiser le système Étoile Bleue ?" "$ANNOUNCER"
gen president_activate_prompt "Monsieur le Président, confirmez-vous l'activation du système Étoile Bleue ?" "$ANNOUNCER"
gen president_confirm "Activation confirmée. Lancement du système Étoile Bleue." "$ANNOUNCER"

echo "Étapes…"
gen phase_analysis "Initialisation du système Étoile Bleue en cours." "$ANNOUNCER"
gen phase_validation "Initialisation engagée. Déploiement sur les communes de Kinshasa." "$ANNOUNCER"
gen phase_deploy "Initialisation du réseau sur les vingt-quatre communes de Kinshasa." "$ANNOUNCER"
gen phase_init_done "Le service Étoile Bleue a été initialisé dans les vingt-quatre communes de Kinshasa." "$ANNOUNCER"
gen phase_countdown "Séquence d'activation engagée. Activation imminente." "$ANNOUNCER"
gen phase_activation "Étoile Bleue est activé et lancé. Service opérationnel à cent pour cent dans la ville de Kinshasa." "$ANNOUNCER"

echo "Compte à rebours (10 → 1, français forcé)…"
declare -a WORDS=( [10]=Dix [9]=Neuf [8]=Huit [7]=Sept [6]=Six [5]=Cinq [4]=Quatre [3]=Trois [2]=Deux [1]=Un )
for n in 10 9 8 7 6 5 4 3 2 1; do
  genfr "count_$n" "${WORDS[$n]}." "$ANNOUNCER"
done

echo "Communes (24) — « Service initialisé à … »…"
i=0
for name in "${COMMUNES[@]}"; do
  gen "commune_$i" "Service initialisé à $name." "$ANNOUNCER"
  i=$((i+1))
done
echo "Terminé."
