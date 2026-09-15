# ADI ONG — Site moderne (React + Node.js)

Refonte moderne du site WordPress de l'ONG **ADI** (Accessibility and Disabled Inclusion, Goma — RDC),
spécialisée dans l'inclusion des personnes handicapées.

## Stack

| Côté | Technologies |
|------|--------------|
| Frontend | React 18, Vite, React Router, Tailwind CSS, Framer Motion, **TipTap** (éditeur riche) |
| Backend | Node.js, Express, SQLite natif (`node:sqlite`), JWT, Multer, **Jimp** (optimisation d'images) |

## Démarrage

```bash
npm run setup   # installe les dépendances (racine + server + client)
npm run dev     # mode dev : API sur :4000 + Vite sur :5173 (proxy /api)
```

Mode production :

```bash
npm run build   # compile le client dans client/dist
npm start       # Express sert l'API + le site (port 4000, PORT=... pour changer)
```

## Espace administrateur

- URL : `/admin` (lien « Espace admin » dans le pied de page)
- Identifiants initiaux : **admin@adiong.org** / **AdiOng2026!**
- Fonctionnalités :
  - **Tableau de bord** : statistiques, derniers dons et messages
  - **Articles** : publication/édition/suppression des actualités (catégories : plaidoyer, éducation, écologie, socio-économique), brouillons
    - **Éditeur moderne (TipTap)** : H2/H3, gras, italique, souligné, barré, surligné, code, listes, citation, bloc code, ligne de séparation, alignements, liens (avec barre de gestion), images, undo/redo, mode aperçu, compteur de mots/caractères
    - **SEO par article** : titre SEO, description (160), image de partage (Open Graph), noindex — aperçu de la carte de partage
    - L'extrait de carte est généré automatiquement depuis le contenu s'il est vide
  - **Causes** : gestion des domaines d'action (Notre travail) : icône, image, ordre, brouillon
  - **Campagnes de collecte** : objectif, montant collecté, échéance, progression en direct
  - **Dons** : dons envoyés depuis la page « Faire un don » (le montant collecté de la campagne est incrémenté automatiquement), statuts
  - **Messages** : messages du formulaire de contact (marquer lu, répondre, supprimer)
  - **Médiathèque** : bibliothèque d'images (recherche, upload, copie d'URL, suppression).
    **Optimisation automatique** (Jimp) : redimensionnement max 1600px + compression + miniature 480px ;
    si l'original est déjà plus léger, il est conservé. Suppression bloquée si l'image est encore utilisée.
    Accessible aussi depuis tout champ image (« Bibliothèque ») et depuis l'éditeur d'articles.
  - **Liens d'invitation** (page Utilisateurs) : générez un lien privé (`/inscription?token=…`) à
    envoyer à un employé pour qu'il **crée lui-même son compte** (nom, email, mot de passe).
    L'inscription n'est jamais ouverte au public : sans lien valide, la page refuse l'accès.
    Options : email imposé, rôle (éditeur / consultation / administrateur), objet, validité (3 à 30 jours).
    Lien à **usage unique**, révocable, expirable. Limitation de débit sur l'inscription (10/h).
  - **Utilisateurs & rôles** : création/édition/suppression de comptes. Rôles :
    `super_admin` (tout + modules + salaires), `admin` (tout sauf modules/salaires),
    `editor` (articles, causes, campagnes, médiathèque), `viewer` (consultation).
    Garde-fous : impossible de supprimer/rétrograder le dernier compte privilégié, ni de supprimer son
    propre compte ; seul un super admin peut donner le rôle super admin.
    Le menu s'adapte au rôle et le rôle est re-vérifié côté API à chaque requête.
  - **Paramètres** : **100 % du contenu du site est éditable** — 7 onglets :
    - *Identité & contact* : nom, slogan, adresse, téléphones, email, réseaux sociaux, copyright
    - *Logo, favicone & SEO* : logo du site (nav + footer), favicone (onglet navigateur), SEO global
      (titre/description/mots-clés, image de partage Open Graph avec **aperçu de la carte de partage**), compte X
    - *Accueil* : image du hero, titres/textes du hero, badge, image et textes de la mission, mots du bandeau défilant, titres des sections « Notre travail » / « Actualités », bannière CTA
    - *En-têtes de pages* : kicker, titre, texte et image d'en-tête de chaque page (À propos, Notre travail, Actualités, Collectes, Don, Contact)
    - *À propos* : présentation, valeurs, méthode de travail, présence, carrières
    - *Don & collectes* : montants de don proposés, arguments « Pourquoi donner », points de réassurance des campagnes
    - *Compteurs & valeurs* : compteurs animés, valeurs, étapes de la méthode
    - + changement de mot de passe

## Données

La base SQLite est créée et pré-remplie automatiquement au premier lancement
(`server/data/adiong.db`, ignorée par git) avec le contenu récupéré du site WordPress :
causes (plaidoyer, entrepreneuriat, éducation inclusive, justice climatique),
articles d'actualité, coordonnées et textes officiels de l'ONG.

Les images générées sont dans `server/uploads/seed/` (servies via `/uploads/seed/...`).

## SEO

- **`/sitemap.xml`** — généré dynamiquement : pages fixes + articles publiés (+ `lastmod`), causes, collectes. Les articles en `noindex` sont exclus.
- **`/robots.txt`** — autorise le crawl, exclut `/admin` et `/api`, pointe vers le sitemap.
- **`/rss.xml`** — flux RSS des 25 derniers articles publiés (titre, description, image, catégorie, date).
- **Texte alternatif** : chaque image de la médiathèque a un champ « Aa » (texte alternatif) réutilisé automatiquement à l'insertion dans les articles (accessibilité lecteurs d'écran + SEO image).
- L'URL absolue utilisée dans ces fichiers est celle de la requête ; en production, fixez `BASE_URL=https://app.adiong.org` pour forcer le domaine exact (https).

## Page article & partage

La page d'un article est repensée pour la lecture et la diffusion :

- **Contenu riche** rendu (titres, listes, citations, images, liens) avec typographie soignée.
- **Sidebar collante** avec :
  - **Timeline** des 5 derniers articles (points datés, l'article courant mis en avant) ;
  - **« Lire aussi »** : les autres articles de la même catégorie (repli sur les plus récents).
- **Partage** : boutons Facebook, X (Twitter), WhatsApp, LinkedIn, email, et **copier le lien** (en en-tête et en pied d'article).
- **Breadcrumbs** (Accueil / Actualités / catégorie).
- **SEO** : title, meta description, canonical, Open Graph & Twitter Card (image de partage), `noindex` optionnel.

## Page Actualités

- **Recherche** plein texte (titre, extrait, contenu) + filtre par catégorie (les deux se combinent).
- **Pagination** (6 articles par page) avec indicateur du nombre de résultats.

## Performance

- **Admin en lazy loading** : toutes les pages de l'espace admin (et TipTap) sont chargées à la demande.
  Le visiteur du site public ne télécharge plus l'éditeur ni l'interface admin — le bundle principal est
  passé de ~860 Ko à ~380 Ko (minifié), ~118 Ko en gzip.

## Module GRH (ressources humaines)

Module **interne** (jamais visible sur le site public) de gestion des ressources humaines :

- **Vue d'ensemble** : effectif, répartition par département, dernières embauches, congés en cours/à venir, congés en attente.
- **Équipe** : fiches employés (fonction, département, type de contrat, date d'embauche, statut actif/inactif + date de départ, photo depuis la médiathèque, notes), recherche et filtres. **Le salaire n'est visible que par le super admin.**
- **Congés** : demande (annuel, maladie, maternité, sans solde, formation) avec circuit de validation (en attente → approuvé/rejeté).
- **Départements** : création, renommage (inline), suppression protégée (impossible si employés affectés).

**Activation / désactivation** : réservée au **super administrateur** via
*Admin → Paramètres → Modules (super admin)*. La désactivation masque le menu et ferme l'API GRH
(les données sont conservées). Le menu GRH s'affiche pour les rôles super admin et administrateur.

**Rôles** : `super_admin` (tout + activation des modules + salaires) > `admin` (contenu,
paramètres, utilisateurs, GRH) > `editor` (contenu) > `viewer` (consultation).
Le compte initial `admin@adiong.org` est super admin. Seul un super admin peut créer/donner le rôle
super admin ; il doit toujours rester au moins un compte privilégié (super admin ou admin).

## Sécurité

- **En-têtes de sécurité** (helmet) : `X-Content-Type-Options`, `X-Frame-Options`, HSTS, `Referrer-Policy`…
- **Limitation de débit** (anti brute-force / anti spam) :
  - connexion admin : 10 tentatives / 15 min par couple IP+email,
  - formulaire de contact : 5 messages / heure par IP,
  - dons : 10 envois / heure par IP.

## Notifications par email (SMTP)

Un nouveau **message de contact** ou un nouveau **don** déclenche un email à l'équipe.
Sans configuration SMTP, le message est simplement journalisé (rien n'échoue).

```bash
SMTP_HOST=smtp.ovh.com SMTP_PORT=587 SMTP_SECURE=false \
SMTP_USER=notifications@adiong.org SMTP_PASS="…mot-de-passe-app…" \
MAIL_TO=equipe@adiong.org \
npm start
```

Env facultatives : `MAIL_FROM` (expéditeur). `MAIL_TO` est par défaut l'email du site (paramètres).

## Structure

```
├── client/          # React (Vite)
│   └── src/
│       ├── pages/         # Accueil, À propos, Notre travail, Actualités, Collectes, Don, Contact + admin/
│       ├── components/    # Navbar, Footer, cartes, animations (Reveal/Counter), icônes
│       └── hooks/         # contexte global du site
└── server/
    ├── index.js     # Express : API publique + admin, uploads, SPA en prod
    ├── db.js        # schéma SQLite
    └── seed.js      # contenu initial (récupéré du site WordPress)
```

> ⚠️ Le site WordPress original (app.adiong.org) présentait des traces de piratage
> (contenus spam injectés). Seuls les contenus authentiques de l'ONG ont été repris ;
> vérifiez et complétez les articles longs depuis l'espace admin.
