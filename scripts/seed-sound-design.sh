#!/usr/bin/env bash
# Generate the ElevenLabs sound design (music + effects) via the running app's /api/sfx.
# Usage: bash scripts/seed-sound-design.sh [BASE_URL] [ADMIN_SECRET]
set -e
BASE="${1:-http://localhost:3000}"
SECRET="${2:-etoile-bleue-admin}"

gen() { # $1 slot  $2 mode(sfx|music)  $3 prompt  $4 extra(key=value)
  local body; body=$(python3 -c 'import json,sys
d={"slot":sys.argv[1],"mode":sys.argv[2],"prompt":sys.argv[3]}
e=sys.argv[4] if len(sys.argv)>4 else ""
if e:
 k,v=e.split("=");d[k]=int(v)
print(json.dumps(d))' "$1" "$2" "$3" "${4:-}")
  local out; out=$(curl -s -X POST "$BASE/api/sfx" -H "Authorization: Bearer $SECRET" -H "Content-Type: application/json" -d "$body")
  if echo "$out" | grep -q '"ok":true'; then echo "  ✓ $1"; else echo "  ✗ $1 -> $out"; fi
}

echo "Sound design (musique + effets)…"
gen bg_ambience    music "Tense yet hopeful cinematic orchestral underscore for a solemn national ceremony, evolving warm strings, soft low brass swells, subtle pulsing heartbeat, no vocals, no heavy drums, seamless and loopable, dignified and modern." "durationMs=30000"
gen sfx_validation sfx   "Short futuristic confirmation chime, positive holographic UI success ping with a soft shimmer tail, clean and premium." "duration=2"
gen sfx_deploy     sfx   "Sci-fi network activation sweep, energy spreading across a map, rising digital pulses and data shimmer, building forward momentum." "duration=4"
gen sfx_commune    sfx   "Short crisp digital confirmation blip, single soft UI beep with a tiny shimmer tail, very short and clean." "duration=1"
gen sfx_countdown  sfx   "Cinematic tension riser building to a climax over four seconds, rising orchestral and synth swell with accelerating ticks, ending right before an impact." "duration=5"
gen sting_activation sfx "Triumphant orchestral brass hit with a deep cinematic boom and bright shimmer, victorious heroic impact and reverb tail." "duration=5"
gen sfx_transition sfx   "Cinematic whoosh transition into a reveal, fast riser with a deep sub drop and a clean tail." "duration=3"
echo "Terminé."
