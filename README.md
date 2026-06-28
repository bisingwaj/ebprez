# Étoile Bleue — Administration · Validateurs · Projection

Dispositif multi-écrans pour l'activation du protocole « Étoile Bleue », déployable sur Vercel.

## Les surfaces (pages)

| Page | Pour qui | Rôle |
|---|---|---|
| `/admin` | Régie / organisateur | Upload **vidéos** et **voix** (par étape et par commune), définition des **3 codes**, contrôle des répétitions. |
| `/validate/minister` | Ministre de la Santé | Saisit son code (1ʳᵉ validation). |
| `/validate/pm` | Première Ministre | Saisit son code (2ᵉ validation). |
| `/validate/president` | Président | Saisit son code → **déclenche le lancement**. |
| `/projection` | Grands écrans + sono | Joue les voix de validation puis déroule la cinématique → vidéo. |

## Déroulé d'un événement

1. **Régie** (`/admin`) : uploader la vidéo officielle, enregistrer les voix souhaitées
   (validations, étapes, et une voix par commune), régler les 3 codes.
2. **Projection** : ouvrir `/projection` sur l'écran projeté, cliquer **« ACTIVER L'AFFICHAGE »**
   (débloque son + plein écran + préchargement), laisser en attente.
3. **Validateurs** : sur 3 appareils séparés, chacun ouvre sa page. Le Ministre saisit son code →
   la projection annonce « Validation faite par le Ministre de la Santé » → c'est le tour de la
   Première Ministre → puis le Président. La projection invite le Président (« Monsieur le
   Président, confirmez-vous le lancement ? ») ; à sa validation, **la séquence démarre**.
4. **Cinématique** : analyse → déploiement (chaque commune s'allume avec sa voix « Service activé à
   … », la suivante démarre à la fin de l'audio précédent) → compte à rebours → activation 199 →
   **vidéo plein écran**.

## Lancer en local

```bash
npm install
npm run dev          # http://localhost:3000
```

- Une **vidéo d'exemple** est préchargée automatiquement (aucune config requise).
- Codes par défaut : Ministre **111111**, Première Ministre **222222**, Président **332003**.
- Clé administrateur par défaut : **etoile-bleue-admin**.
- **Voix de démo** (macOS) : `bash scripts/seed-voices.sh` génère et enregistre des voix
  françaises pour les 24 communes + validations (avec `say`). En production, on uploade les vraies
  voix depuis `/admin`.
- Test multi-appareils : `npm run dev -- -H 0.0.0.0` puis ouvrez les pages depuis les autres
  appareils du réseau.

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `ADMIN_SECRET` | Protège les écritures admin (upload, codes, contrôle). |
| `ELEVENLABS_API_KEY` | Génération de voix naturelles depuis `/admin` (ElevenLabs). |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Vercel KV — état partagé entre toutes les surfaces. |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob — stockage des vidéos et des voix uploadées. |

> Les **codes d'activation** ne sont jamais exposés au client : ils restent dans le store et sont
> vérifiés côté serveur (`/api/validate`).

## Déploiement Vercel

1. Importer le dossier `etoile-bleue/` (framework détecté : Next.js).
2. **Storage** → ajouter **KV / Redis (Upstash)** + un store **Blob** (variables injectées auto).
3. **Settings → Environment Variables** → définir `ADMIN_SECRET`.
4. Déployer. Répartir les URLs : `/admin` (régie), `/validate/*` (officiels), `/projection` (écran).

> ⚠️ Sans Vercel KV en production, la synchro entre appareils ne fonctionne pas (le repli mémoire
> ne marche qu'en local mono-processus).

## Architecture technique

- **Cinématique** : `components/Cinematic.jsx` (port fidèle de l'original `.dc.html`), déploiement
  des communes **piloté par la fin de chaque voix** (`lib/voice.js`), voix par étape.
- **Synchro** : polling `GET /api/state` (500 ms). Le flux de validation (`flow`) et le
  déclenchement (`session`) portent un `epoch` pour des transitions idempotentes.
- **Slots audio** : définis dans `lib/slots.js` (4 validations, 6 étapes, 24 communes).
- **Stockage** : `lib/store.js` (Vercel KV + repli mémoire) ; fichiers sur Vercel Blob
  (`/api/upload`, upload client direct) avec repli disque local en dev (`/api/local-upload`).
