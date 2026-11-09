# NEXO CLOUD

Plateforme publique d'hébergement d'images, conçue pour partager des liens directs dans FiveM, les interfaces NUI et les pages web.

## Fonctionnalités

- Upload public d'images JPG, PNG, WEBP et GIF
- Vérification de la signature réelle du fichier (pas seulement son extension/MIME déclaré)
- Limite de taille configurable (10 Mo par défaut)
- Galerie publique, aperçu, lien direct, code HTML et copie en un clic
- Administration protégée par mot de passe : statistiques et suppression
- Interface responsive avec thème sombre violet/bleu et bascule claire
- Limitation du nombre d'envois et des tentatives de connexion

## Lancer sur Windows

1. Installe Node.js 20 ou plus récent : https://nodejs.org/
2. Décompresse le dossier `nexo-cloud`.
3. Ouvre un terminal dans ce dossier.
4. Copie `.env.example` vers `.env`.
5. Modifie `ADMIN_PASSWORD` avec un mot de passe long et personnel.
6. Laisse `PUBLIC_BASE_URL=http://localhost:3000` pour un test local.
7. Exécute :

```powershell
npm install
npm start
```

8. Ouvre http://localhost:3000 dans ton navigateur.

## Mise en ligne

Pour publier le site, il faut un serveur Node.js/VPS ou un hébergement compatible Node.js, un domaine ou sous-domaine, HTTPS et un stockage persistant. Dans `.env`, définis `PUBLIC_BASE_URL` avec l'adresse HTTPS réelle, par exemple `https://cloud.mondomaine.fr`.

Le dossier `uploads/` contient les fichiers et `data/images.json` les métadonnées. Ils doivent être conservés et sauvegardés lors des déploiements. Ne place pas ces dossiers sur un stockage temporaire.

### Exemple de lien FiveM / NUI

```html
<img src="https://cloud.mondomaine.fr/uploads/identifiant-image.png" alt="Visuel">
```

Ou dans une ressource Lua :

```lua
local imageUrl = 'https://cloud.mondomaine.fr/uploads/identifiant-image.png'
```

## Configuration

| Variable | Description | Défaut |
|---|---|---|
| `PORT` | Port HTTP local | `3000` |
| `ADMIN_PASSWORD` | Mot de passe administrateur | À définir |
| `PUBLIC_BASE_URL` | URL publique utilisée dans les liens | localhost |
| `MAX_FILE_SIZE_MB` | Taille maximale d'un upload | `10` |

## À savoir avant ouverture publique

Cette version est une première base fonctionnelle. Les fichiers sont stockés sur le disque du serveur : prévois des sauvegardes et surveille l'espace disponible. Pour une forte fréquentation, plusieurs administrateurs, des quotas par utilisateur, ou un stockage distribué, il faudra ajouter une base de données et un stockage objet (par exemple Cloudflare R2). L'upload est public : publie des règles d'utilisation et une procédure de signalement/retrait avant d'ouvrir le service à tous.
