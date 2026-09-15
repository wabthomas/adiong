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
  - **Partenaires** : logos des partenaires affichés en **défilement automatique** (marquee infini,
    pause au survol, niveaux de gris qui colorisent au survol) juste au-dessus du pied de page,
    sur toutes les pages. Réordonnancement par boutons ↑↓, visibilité publiée/masquée par logo,
    lien cliquable optionnel. Le bandeau disparaît automatiquement s'il n'y a aucun partenaire publié.
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
- **Équipe** : fiches employés (fonction, département, type de contrat, date d'embauche, statut actif/inactif + date de départ, photo depuis la médiathèque, notes, fiche de poste), recherche et filtres. **Le salaire n'est visible que par le super admin.**
- **Dossier employé** : pièces et documents privés (contrat, pièce d'identité, diplôme, certificat médical…) — upload, téléchargement, suppression ; stockés hors du site public, accessibles uniquement aux rôles RH.
- **Organigramme** : supérieur hiérarchique par employé, arborescence interactive (clic sur un nom = ouvre le dossier).
- **Congés** : types (annuel, maladie, maternité, sans solde, formation), circuit de validation (en attente → approuvé/rejeté), **soldes par employé** (jours par an, pris, restants — réglables par défaut dans Paramètres ou individuellement par employé), durée comptée en jours ouvrés, **calendrier mensuel** des absences approuvées.
- **Mon espace (auto-service)** : chaque employé dont l'email correspond à un dossier voit *Admin → Mon espace* — consultation de son solde, demande de congé (contrôlée par le solde), retrait de ses demandes en attente, et **annonces internes** de l'équipe (épinglées en tête).
- **Paie** (super admin uniquement) : grille mensuelle des bulletins (salaire de base, primes, retenues, net), génération d'un mois en un clic pour tous les actifs, bulletin imprimable et **PDF** téléchargeable, statuts brouillon/envoyé, **export CSV** du mois (compatible Excel), et **historique des changements de salaire** dans le dossier employé.
- **Recrutement** : offres d'emploi (intitulé, département, contrat, lieu, fourchette salariale, date limite, publiée/masquée) et **pipeline de candidats** (reçu → entretien → retenu/refusé/retiré) avec CV privé téléchargeable, notes et date d'entretien. Le bouton **« Embaucher »** convertit le candidat en employé en un clic (dossier créé avec le poste et le contrat de l'offre).
- **Évaluations** : bilan par employé et par période (mois), **critères personnalisables notés sur 5** (moyenne calculée automatiquement), commentaires, statuts brouillon/validée, filtres par employé.
- **Formations** : catalogue de formations (interne/externe, organisme, dates, coût) avec **participants** (inscription, statut inscrit/terminé/annulé, date de fin), ajout de participants à la volée.
- **Annonces internes** : messages de l'équipe (épinglage, date d'expiration, auteur) — **visibles par chaque employé dans « Mon espace »**.
- **Certificats PDF** : depuis le dossier employé, génération d'une **attestation d'emploi** (en poste) ou d'un **certificat de travail** (après départ, avec date de fin) — PDF à l'en-tête de l'organisation, prêt à signer.
- **Départements** : création, renommage (inline), suppression protégée (impossible si employés affectés).

**Activation / désactivation** : réservée au **super administrateur** via
*Admin → Paramètres → Modules (super admin)*. La désactivation masque le menu et ferme l'API GRH
(les données sont conservées). Le menu GRH s'affiche pour les rôles super admin et administrateur.

**Rôles** : `super_admin` (tout + activation des modules + salaires) > `admin` (contenu,
paramètres, utilisateurs, GRH, point de vente) > `editor` (contenu) > `viewer` (consultation).
Le compte initial `admin@adiong.org` est super admin. Seul un super admin peut créer/donner le rôle
super admin ; il doit toujours rester au moins un compte privilégié (super admin ou admin).

## Module Point de vente (POS) + stock

Module **interne** (jamais visible sur le site public) pour vendre des produits (boutique,
merchandising, produits des ateliers…) et gérer le stock :

- **Caisse** : grille de produits (recherche, filtres par catégorie, stock affiché, rupture bloquée),
  panier avec quantités, client, **réduction**, choix du paiement (**Espèces, Mobile Money, Carte,
  Virement, Autre**), montant reçu et **monnaie rendue**, puis encaissement.
- **Ticket** : à chaque vente, ticket imprimable (imprimante standard) ou **PDF A5** à l'en-tête de
  l'organisation, avec numéro séquentiel (POS-00001…), lignes, totaux et mode de paiement.
- **Facture client** : en un clic depuis une vente (ou son détail), **facture PDF A4** avec blocs
  organisation/client, tableau des articles, totaux, mode de paiement et mention des retours.
- **Rapport de caisse** : pour n'importe quel jour, rapport imprimable — nombre de ventes, montant
  encaissé, total avant réduction, réductions accordées, retours, ventes annulées, panier moyen,
  répartition par mode de paiement et meilleures ventes du jour.
- **Ventes** : historique filtrable (période, paiement, recherche), détail par vente, **retours
  partiels ou totaux** (le stock retourné est réapprovisionné automatiquement, motif tracé) et
  **annulation** d'une vente (suppression + réapprovisionnement du stock non retourné).
- **Stock** : catalogue produits (nom, référence, catégorie, prix de vente, coût d'achat, image,
  actif/inactif), **seuils d'alerte** « stock bas / rupture », catégories (création, renommage,
  suppression protégée), **mouvements** (entrée, sortie, ajustement) et historique complet tracé
  (chaque vente, retour, annulation et mouvement laisse une piste horodatée avec l'auteur).
- **Statistiques** : ventes et chiffre d'affaires du jour, répartition par mode de paiement,
  graphique des 7 derniers jours, meilleures ventes sur 30 jours, valeur du stock et alertes.

**Activation / désactivation** : comme le module GRH, réservée au **super administrateur**
(*Admin → Paramètres → Modules*). La désactivation masque le menu et ferme l'API POS
(les données sont conservées). Visible pour les rôles super admin et administrateur.

## Sécurité

Le site a été conçu en tenant compte des attaques subies par l'ancienne version WordPress :

- **En-têtes de sécurité** (helmet) : `X-Content-Type-Options`, `X-Frame-Options`, HSTS, `Referrer-Policy`…
- **Content-Security-Policy** : activée en production (scripts/styles/connexion limités à l'origine du site, `object-src 'none'`, `frame-ancestors 'self'`).
- **CORS** : seule l'origine du site est acceptée — aucune requête cross-origin n'est servie.
- **Limitation de débit** (anti brute-force / anti spam) :
  - connexion admin : 10 tentatives / 15 min par couple IP+email,
  - formulaire de contact : 5 messages / heure par IP,
  - dons : 10 envois / heure par IP,
  - filet global : 600 requêtes / 15 min par IP sur toute l'API.
- **Anti-spam des formulaires** (contact & dons) : champ piège invisible (honeypot) + piège temporel (un formulaire soumis en moins de 3 s est rejeté). Les bots reçoivent une réponse « succès » silencieuse sans que le message soit enregistré.
- **Validation des entrées** : adresses email vérifiées, longeurs maximales imposées (nom 100, email 120, sujet 200, message 2000, don 500, montant ≤ 1 M), montants contrôlés.
- **Cheminements d'attaque neutralisés** : `/wp-login.php`, `/xmlrpc.php`, `/.env`, `/.git`, `/phpmyadmin`, etc. renvoient un 404 uniforme pour ne pas révéler de quoi le site est fait.
- **Sessions** : révocation serveur au déconnexion (un token déconnecté n'est plus valide) + journal des connexions réussies/échouées et des déconnexions, visible dans *Espace admin → Utilisateurs → Sécurité*.
- **Erreurs** : les erreurs internes (500) renvoient un message générique, sans détail technique.
- **`/security.txt`** : fichier de contact pour les chercheurs en sécurité (norme CVE).

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
