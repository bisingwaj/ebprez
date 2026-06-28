# Mettre Étoile Bleue en ligne (Vercel)

Temps estimé : ~15 min. Il te faut un compte **Vercel** (gratuit) et ta **clé ElevenLabs**.

---

## Étape 1 — Déployer le code

### Option A — Vercel CLI (le plus rapide, depuis ce terminal)
```bash
npm i -g vercel              # installe l'outil Vercel (une seule fois)
cd "etoile-bleue"
vercel login                 # ouvre le navigateur pour te connecter
vercel                       # 1er déploiement (réponds Enter aux questions)
```
À la fin, Vercel affiche une URL de type `https://etoile-bleue-xxxx.vercel.app`.

### Option B — GitHub (plus visuel)
1. Crée un dépôt GitHub et pousse le dossier `etoile-bleue/`.
2. Sur **vercel.com → Add New → Project → Import** ton dépôt.
3. Framework détecté : **Next.js** → **Deploy**.

---

## Étape 2 — Ajouter le stockage (OBLIGATOIRE)

Dans le projet sur **vercel.com → onglet Storage** :

1. **Create Database → Redis (Upstash)** → Connecte-le au projet.
   *(C'est la base partagée entre le président, les validateurs et la projection. Sans elle, la synchro ne marche pas.)*
2. **Create → Blob** → Connecte-le au projet.
   *(Stockage des vidéos et des voix/sons.)*

Vercel ajoute automatiquement les variables (`KV_REST_API_URL`/`UPSTASH_…`, `BLOB_READ_WRITE_TOKEN`).

---

## Étape 3 — Variables d'environnement

**Settings → Environment Variables**, ajoute :

| Nom | Valeur |
|---|---|
| `ADMIN_SECRET` | un mot de passe admin de ton choix (ex. `EtoileBleue2026!`) |
| `ELEVENLABS_API_KEY` | ta clé ElevenLabs |
| `ELEVENLABS_MODEL` | `eleven_multilingual_v2` |

Puis **Redeploy** (Deployments → ⋯ → Redeploy) pour appliquer storage + variables.

---

## Étape 4 — Remplir les contenus (voix, sons, vidéo, codes)

Remplace `URL` par ton adresse Vercel et `SECRET` par ton `ADMIN_SECRET` :

```bash
cd "etoile-bleue"
bash scripts/seed-voices-elevenlabs.sh https://TON-URL.vercel.app SECRET
bash scripts/seed-sound-design.sh      https://TON-URL.vercel.app SECRET
```
*(Régénère les 36 voix + le sound design directement dans ta base de production.)*

Puis ouvre **`https://TON-URL.vercel.app/admin`** (mot de passe = `ADMIN_SECRET`) pour :
- **Uploader la vidéo officielle** et la définir « active » ;
- Régler les **3 codes** (Ministre / Première Ministre / Président) ;
- Ajuster/écouter les voix si besoin.

---

## Étape 5 — Le jour J

Distribue les adresses :

| Surface | URL |
|---|---|
| Régie / admin | `…/admin` |
| Ministre de la Santé | `…/validate/minister` |
| Première Ministre | `…/validate/pm` |
| Président | `…/validate/president` |
| Projection (grand écran) | `…/projection` |

Déroulé : ouvrir **un seul** `/projection` → **ACTIVER L'AFFICHAGE** → Ministre saisit son code → Première Ministre → Président (code = **initialisation**) → le réseau s'initialise → le Président appuie sur **⏻ ACTIVER** → décompte → activation → vidéo.

> ⚠️ N'ouvre **qu'un seul** onglet `/projection` (chaque onglet rejoue les voix).

---

## Notes

- Les voix/sons générés **en local** ne montent pas en production : c'est l'étape 4 qui les recrée dans le Blob/Redis de prod (les fichiers locaux `public/uploads/` et `.eb-store.json` sont ignorés).
- Pour mettre à jour le code plus tard : `vercel --prod` (option A) ou un simple `git push` (option B).
