This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

# Mise en place d'un environnement de developpement simplifié

## Dépendances système

**Ubuntu / Debian** — à installer une fois sur la machine hôte :

```bash
# Back
sudo apt-get update
sudo apt-get install -y \
  libgl1 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libcairo2 \
  libgdk-pixbuf2.0-0 \
  libffi-dev \
  shared-mime-info

# Front
sudo  apt install -y \
  build-essential \
  libcairo2-dev \
  libpango1.0-dev \
  libjpeg-dev \
  libgif-dev \
  librsvg2-dev \
  pkg-config
```

## Dépendances Node
Important : à l'heure actuelle l'installation est recommandée avec Node 20, la version 24 étant trop récente beaucoup de paquets ne supportent pas l'update.
NodeMailer posera sûrement soucis, pour fixer si le npm i ne fonctionne pas, voici quoi faire :
```
npm install --legacy-peer-deps
```

## Création d'une persistence

Création d'une session tmux pour faire tourner en arrière plan les services next et python (non obligatoire, les services peuvent être lancés à la main à chaque connexion, ici tmux sert à garder les services actifs). 

1. Se rendre dans le dossier du repo
2. Créer une session `tmux new -s fleap`
3. Dans la nouvelle fenêtre, se rendre dans le dossier du backend et faire : `uvicorn main:app --reload --host 127.0.0.1 --port 8000` pour l'API, puis ouvrir une nouvelle fenêtre avec **Ctrl+b puis c**, ici aller à la racine du code et faire `npm run dev -- -H 127.0.0.1 -p 3000` pour lancer le front NextJS 
4. Une fois fait, fermer la fenêtre **EN FAISANT Ctrl+b puis d**

Pour revenir plus tard
```
tmux attach -t fleap
```

Pour voir les sessions

```
tmux ls
```

## Connexion à l'environnement créé

Tunnel SSH qui redirige les ports sur votre PC, localhost:3000 correspondra au front NextJS, et localhost:8000 au back.

```
ssh -L 3000:127.0.0.1:3000 -L 8000:127.0.0.1:8000 root@X.X.X.X
```

## Quoi mettre dans les .env
### Next — fichier .env à la racine du repo (là où est package.json)

Comme le navigateur sur ton PC appelle l’app et l’API en localhost via le tunnel, les variables NEXT_PUBLIC_* “URL” doivent être en localhost :
NEXT_PUBLIC_APP_URL=http://localhost:3000
NGROK_URL=http://localhost:3000
NEXT_PUBLIC_SERVER_PYTHON=http://localhost:8000
NEXT_PUBLIC_APP_URL : http://localhost:3000
NEXT_PUBLIC_SERVER_PYTHON : URL de l’API vue par le navigateur → ici http://localhost:8000
Tout le reste (Supabase, Track Déchets, Mixpanel, Gmail, Upstash, NEXT_PUBLIC_TRACK_*, etc.) : reprends les mêmes valeurs que sur Vercel

### Python — backend-python/.env
Clés et secrets utiles côté API : GEMINI_API_KEY, MINDEE_API_KEY, éventuellement les variables Supabase si l’API les lit, PORT=8000, etc. — comme en prod


### Récap des étapes
Sur le VPS : tmux attach -t fleap (ou new -s fleap) → API + npm run dev déjà lancés, ou les lancer.
Sur le PC : ouvre le tunnel ssh -L 3000:... -L 8000:....
Sur le PC : navigateur → http://localhost:3000.
Le fichier .env sur le repo doit être rempli sur le VPS, avec les localhost ci-dessus pour les URL publiques côté client.