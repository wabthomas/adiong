import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Jimp from 'jimp';
import db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const slugify = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');


export const DEFAULT_SETTINGS = {
  site_name: 'ADI ONG',
  site_tagline: "Soutenir l'inclusion des personnes handicapées dans tous les secteurs de la vie",
  logo: '/uploads/seed/logo.png',
  favicon: '/uploads/seed/favicon.png',
  grh_enabled: '0',
  address: '38 Av. Baraka, Rue Dr. Maganga, Q. Himbi, Commune de Goma, Nord-Kivu, RDC',
  phone1: '+243 976 483 612',
  phone2: '+243 811 401 636',
  email: 'contact@adiong.org',
  whatsapp: '+243 976 483 612',
  facebook: 'https://facebook.com/',
  twitter: 'https://twitter.com/',
  instagram: 'https://instagram.com/',
  pinterest: 'https://pinterest.com/',
  video_url: '',
  copyright: '© 2026 ADI ONG — Tous droits réservés.',

  seo_title: 'ADI ONG — Inclusion des personnes handicapées à Goma',
  seo_description: "L'ONG ADI (Accessibility and Disabled Inclusion) soutient l'inclusion des personnes handicapées dans tous les secteurs de la vie : plaidoyer, entrepreneuriat, éducation inclusive et justice climatique à Goma, RDC.",
  seo_keywords: 'ONG, handicap, inclusion, Goma, RDC, plaidoyer, éducation inclusive, entrepreneuriat, justice climatique, ADI',
  og_image: '/uploads/seed/hero.jpg',
  twitter_handle: '@adiong',

  hero_image: '/uploads/seed/hero.jpg',
  hero_kicker: "Bienvenue dans le monde de l'ONG ADI",
  hero_title: "Soutenir l'inclusion des personnes handicapées dans tous les secteurs de la vie",
  hero_text: "Nous sommes fiers de participer activement à la promotion de l'inclusion professionnelle, socio-économique et politique pour les personnes vivant avec un handicap. En tant qu'acteur engagé, nous entendons apporter une véritable contribution à la construction d'une société plus juste et solidaire, qui respecte les droits de tous.",
  hero_badge_title: 'ONG congolaise',
  hero_badge_sub: 'Basée à Goma, Nord-Kivu',
  about_image: '/uploads/seed/about.jpg',
  mission_title: 'Notre mission',
  mission_text: "Nous sommes convaincus que chaque individu, quelle que soit sa situation, mérite d'être pleinement intégré et reconnu pour ses compétences et son potentiel. Nous agissons donc avec détermination pour accompagner les personnes en situation de handicap dans leur parcours d'insertion professionnelle, pour sensibiliser les entreprises et les institutions aux enjeux de l'inclusion et pour encourager une participation effective dans la vie sociale et politique. Notre engagement est total et nous travaillons sans relâche pour assurer une meilleure qualité de vie pour tous.",
  home_mission_heading: "Une société plus juste, où chaque personne est pleinement intégrée",
  marquee_items: [
    'Inclusion', 'Plaidoyer', 'Entrepreneuriat', 'Éducation inclusive', 'Justice climatique',
    'Dignité', 'Participation', 'Solidarité', 'Droits des PvH', 'Goma — RDC'
  ],
  home_work_kicker: 'Notre travail',
  home_work_title: 'Les causes qui nous tiennent à cœur',
  home_work_text: 'Quatre domaines d’action pour l’inclusion des personnes handicapées dans tous les secteurs de la vie.',
  home_news_kicker: 'Dernières informations',
  home_news_title: 'Regardez nos dernières actualités',
  home_news_text: "Projets, événements et avancées de l'ONG ADI sur le terrain.",
  cta_kicker: 'Donnez-leur un coup de main',
  cta_title: 'Chaque personne compte. Chaque contribution, chaque don compte.',
  cta_text: "Rejoignez-nous dans cette cause et aidons les personnes vivant avec handicap à prendre leur place dans tous les secteurs de la vie.",

  about_title: "À propos de l'ONG ADI",
  about_text: "L'ONG Accessibility and Disabled Inclusion (ADI) est une organisation non gouvernementale congolaise basée à Goma, ville de l'Est de la République Démocratique du Congo. Forte de 6 années d'expérience professionnelle, ADI œuvre au quotidien pour la défense des droits des Personnes Vivant avec Handicap (PvH) et pour leur inclusion dans tous les secteurs de la vie nationale.",
  about_values_kicker: 'Nos valeurs',
  about_values_title: 'Ce qui guide chacune de nos actions',
  about_method_kicker: 'Méthode de travail',
  about_method_title: 'Comment nous intervenons sur le terrain',
  about_method_text: 'Une approche participative, transparente et centrée sur les personnes concernées.',
  about_presence_title: 'Notre présence',
  about_presence_text: "Notre siège est basé à Goma, dans le Nord-Kivu (RDC), au 38 Av. Baraka, Rue Dr. Maganga, quartier Himbi. Nous intervenons dans la ville de Goma et les communautés environnantes, en partenariat avec les écoles, les institutions et la société civile locale.",
  about_career_title: 'Carrière, bénévolat & préoccupations',
  about_career_text: "Vous souhaitez rejoindre nos équipes, devenir volontaire ou partager une préoccupation ? Écrivez-nous — nous répondons à toutes les candidatures.",

  about_header: {
    kicker: 'À propos',
    title: 'Qui sommes-nous ?',
    text: "L'ONG Accessibility and Disabled Inclusion (ADI) œuvre depuis 6 ans, à Goma, pour l'inclusion des personnes handicapées dans tous les secteurs de la vie.",
    image: '/uploads/seed/about.jpg'
  },
  work_header: {
    kicker: 'Notre travail',
    title: "Quatre domaines, un seul objectif : l'inclusion",
    text: "Plaidoyer, entrepreneuriat, éducation inclusive et justice climatique — nos interventions pour que rien n'empêche chaque personne de réaliser son plein potentiel.",
    image: '/uploads/seed/hero.jpg'
  },
  news_header: {
    kicker: 'Actualités',
    title: 'Dernières informations',
    text: "Toute l'actualité de l'ONG ADI : projets lancés, évaluations, plaidoyer et moments forts sur le terrain.",
    image: '/uploads/seed/cause-education.jpg'
  },
  campaigns_header: {
    kicker: 'Collectes de fonds',
    title: 'Nos campagnes de collecte',
    text: "Chaque don, petit ou grand, contribue directement à nos programmes d'inclusion. Voici où votre soutien va.",
    image: '/uploads/seed/campaign-kits.jpg'
  },
  donate_header: {
    kicker: 'Faire un don',
    title: 'Chaque soutien compte',
    text: "Votre don finance directement l'inclusion : scolarité, formation, plaidoyer. Merci de votre générosité.",
    image: '/uploads/seed/campaign-scolarite.jpg'
  },
  contact_header: {
    kicker: 'Contact',
    title: "Parlons de l'inclusion",
    text: 'Une question, une idée de partenariat, une préoccupation ? Écrivez-nous, nous vous répondons rapidement.',
    image: '/uploads/seed/cause-plaidoyer.jpg'
  },

  donate_amounts: [10, 25, 50, 100, 250, 500],
  donate_why_title: 'Pourquoi donner à ADI ONG ?',
  donate_why_points: [
    '100% du don est affecté aux programmes d’inclusion.',
    'Transparence : rapports d’activité partagés.',
    'Impact local et direct à Goma et ses environs.'
  ],
  campaign_points: [
    'Utilisation directe et transparente des fonds',
    'Rapport de suivi partagé avec les donateurs',
    'Impact mesurable dans nos zones d’intervention à Goma'
  ],

  stats: [
    { value: 6, suffix: ' ans', label: "d'expérience professionnelle" },
    { value: 120, suffix: '+', label: 'personnes accompagnées' },
    { value: 15, suffix: '+', label: 'projets et activités réalisés' },
    { value: 4, suffix: '', label: 'domaines d’action' }
  ],
  values: [
    { title: 'Inclusion', text: "Chaque personne, quelle que soit sa situation, est pleinement intégrée et reconnue pour ses compétences et son potentiel." },
    { title: 'Participation', text: "Les personnes vivant avec handicap sont actrices de leur propre développement et présentes dans les instances de décision." },
    { title: 'Solidarité', text: "Nous agissons ensemble, avec la communauté, pour construire une société plus juste et plus solidaire." },
    { title: 'Intégrité', text: "Nous menons nos activités avec transparence, responsabilité et respect des droits fondamentaux de chacun." },
    { title: 'Développement durable', text: "Nos interventions visent des changements durables, mesurables et bénéfiques sur le long terme." }
  ],
  method: [
    { title: 'Diagnostic et cartographie', text: "Nous identifions les besoins des personnes vivant avec handicap dans nos zones d’intervention." },
    { title: 'Sensibilisation et plaidoyer', text: "Nous sensibilisons les entreprises, les institutions et la communauté aux enjeux de l’inclusion, et plaidons pour la défense des droits des PvH." },
    { title: 'Formation et renforcement des capacités', text: "Nous formons les jeunes en situation de handicap à l’entrepreneuriat, à l’insertion socio-économique et à la citoyenneté." },
    { title: 'Suivi et évaluation', text: "Nous suivons et évaluons nos projets pour garantir leur efficacité et notre redevabilité envers les communautés et nos partenaires." }
  ]
};


export function ensureSettings() {
  const ins = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    ins.run(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
}

export function seedIfEmpty() {
  ensureSettings();

  const contentCount = db.prepare('SELECT COUNT(*) AS n FROM articles').get().n;
  if (contentCount > 0) return;

  const now = new Date().toISOString();

  const hash = bcrypt.hashSync('AdiOng2026!', 10);
  db.prepare('INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)').run(
    'admin@adiong.org',
    hash,
    'Administrateur ADI',
    'super_admin'
  );

  const causes = [
    {
      slug: 'plaidoyer',
      title: 'Plaidoyer',
      tagline: 'Faciliter l’inclusion des jeunes handicapés dans la prise des décisions',
      description: "Quand rien ne nous empêche de faire ce que nous aimons le plus, chaque plaisir est possible. Ensemble facilitons l'inclusion des jeunes handicapés dans la prise des décisions.",
      long_content: `Dans le but de promouvoir le bien-être des personnes handicapées et de favoriser la démocratie et la bonne gouvernance, l'ONG Accessibility and Disabled Inclusion aspire à construire un Congo équitable et non discriminatoire, où les Personnes Vivant avec Handicap jouissent de leurs droits fondamentaux, s'épanouissent et sont pleinement intégrées dans la société.

L'ONG ADI s'engage à faire participer les Personnes Vivant avec Handicap à toutes les instances de décision et d'action politique et économique en RD Congo, afin qu'elles puissent revendiquer elles-mêmes leurs droits spécifiques.

Nos actions de plaidoyer :
- Participer aux consultations publiques et aux processus électoraux pour garantir la voix des PvH ;
- Sensibiliser les institutions publiques et les entreprises sur les obligations d'inclusion ;
- Accompagner les jeunes en situation de handicap à s'organiser et à porter leurs revendications ;
- Promouvoir l'adoption et l'application des lois protectrices des droits des personnes handicapées.

Chaque personne compte. Chaque contribution, chaque don compte pour créer un monde politique meilleur, adapté à tous et sans discrimination.`,
      icon: 'megaphone',
      image: '/uploads/seed/cause-plaidoyer.jpg',
      link: '/notre-travail/plaidoyer',
      sort_order: 1
    },
    {
      slug: 'entrepreneuriat',
      title: 'Entrepreneuriat pour les jeunes handicapés',
      tagline: 'Faciliter l’insertion socio-économique des jeunes handicapés',
      description: "Lorsque rien ne nous empêche de faire ce que nous aimons le plus, chaque plaisir est décuplé. Facilitons l'insertion socio-économique des jeunes handicapées.",
      long_content: `L'insertion socio-économique des jeunes en situation de handicap est au cœur de notre action. Lorsque rien ne nous empêche de faire ce que nous aimons le plus, chaque plaisir est décuplé : c'est pourquoi nous facilitons l'insertion socio-économique des jeunes handicapés.

Nos interventions :
- Formations en entrepreneuriat, gestion et techniques de production adaptées ;
- Accompagnement à la création d'activités génératrices de revenus ;
- Mise en relation avec les microfinances et les partenaires économiques ;
- Incubation des projets et suivi des jeunes entrepreneurs.

Notre objectif : que chaque jeune en situation de handicap puisse vivre de son travail, devenir un contributeur à son équilibre familial et à l'économie locale de Goma et de ses environs.`,
      icon: 'briefcase',
      image: '/uploads/seed/cause-entrepreneuriat.jpg',
      link: '/notre-travail/entrepreneuriat',
      sort_order: 2
    },
    {
      slug: 'education',
      title: 'Éducation inclusive',
      tagline: 'Une éducation de qualité pour tous les enfants',
      description: "Nous soutenons la scolarisation et l'éducation inclusive des personnes handicapées dans la ville de Goma, y compris les enfants déplacés.",
      long_content: `L'éducation est le premier pas vers l'inclusion. L'ONG ADI porte le projet de scolarité pour l'éducation inclusive des personnes handicapées dans la ville de Goma, qui permet à des enfants et des jeunes en situation de handicap d'accéder à l'école aux côtés de leurs pairs.

Nos actions éducatives :
- Prise en charge des frais de scolarité et fournitures scolaires pour les enfants handicapés dans le besoin ;
- Lancement d'initiatives éducatives pour les enfants déplacés, comme celle du camp de Kanyaruchinya ;
- Sensibilisation des enseignants et des familles à l'éducation inclusive ;
- Suivi et évaluation réguliers des progrès scolaires des bénéficiaires.

Chaque enfant qui apprend est un avenir qui se construit. Merci de nous aider à élargir les bancs d'école.`,
      icon: 'education',
      image: '/uploads/seed/cause-education.jpg',
      link: '/notre-travail/education',
      sort_order: 3
    },
    {
      slug: 'ecologie',
      title: 'Justice climatique',
      tagline: 'Les jeunes handicapés, acteurs de la protection de l’environnement',
      description: "Lorsque rien ne nous empêche de faire ce que nous aimons le plus, chaque plaisir est décuplé. Soutenir l'apport des jeunes handicapés dans la lutte contre le réchauffement climatique et la protection de l'écologie.",
      long_content: `La crise climatique touche tout le monde, mais elle frappe d'abord les plus vulnérables. Nous croyons que les jeunes en situation de handicap doivent être des acteurs de la solution, et non de simples spectateurs.

Nos activités :
- Sensibilisation à la lutte contre le réchauffement climatique et à la protection de l'écologie ;
- Campagnes de reboisement et d'assainissement menées avec et par les jeunes handicapés ;
- Participation à la Journée mondiale de l'environnement et aux initiatives climatiques locales ;
- Promotion des modes de vie durables dans nos zones d'intervention.

Ensemble, protégeons notre environnement et ouvrons la porte à une économie verte inclusive.`,
      icon: 'leaf',
      image: '/uploads/seed/cause-ecologie.jpg',
      link: '/notre-travail/ecologie',
      sort_order: 4
    }
  ];
  const insCause = db.prepare(`INSERT INTO causes (slug, title, tagline, description, long_content, icon, image, link, sort_order, published, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`);
  for (const c of causes)
    insCause.run(c.slug, c.title, c.tagline, c.description, c.long_content, c.icon, c.image, c.link, c.sort_order, now);

  const articles = [
    {
      slug: 'initiative-educative-enfants-deplaces-kanyaruchinya',
      title: 'ADI ONG lance une initiative éducative pour les enfants déplacés à Kanyaruchinya',
      excerpt: "Le 5 août 2024, dans le camp de réfugiés de Kanyaruchinya, nous avons lancé une initiative éducative au profit des enfants déplacés en situation de handicap.",
      category: 'education',
      image: '/uploads/seed/cause-education.jpg',
      author: 'ADI ONG',
      date: '2024-08-09',
      long_content: `Le 5 août 2024, dans le camp de réfugiés de Kanyaruchinya, nous avons lancé une initiative éducative au profit des enfants déplacés, en particulier ceux vivant avec un handicap.

Dans les camps de déplacés, les enfants sont souvent les premières victimes : ils sortent de l'école, travaillent, ou restent invisibles aux yeux des services sociaux. Les enfants en situation de handicap le sont encore davantage.

Notre initiative vise à :
- réinscrire les enfants déplacés en situation de handicap dans les écoles des environs ;
- leur fournir des kits scolaires adaptés ;
- accompagner les familles par une sensibilisation sur les droits de l'enfant.

Cette initiative n'est possible que grâce au soutien de nos donateurs et partenaires. Merci de continuer à croire en l'éducation inclusive.`
    },
    {
      slug: 'journee-mondiale-de-lenvironnement',
      title: 'Journée mondiale de l’environnement',
      excerpt: "La Journée mondiale de l’environnement est une occasion précieuse de réfléchir à notre relation avec la nature et à notre responsabilité commune.",
      category: 'ecologie',
      image: '/uploads/seed/cause-ecologie.jpg',
      author: 'ADI ONG',
      date: '2024-06-05',
      long_content: `La Journée mondiale de l'environnement est une occasion précieuse de réfléchir à notre relation avec la nature et à notre responsabilité commune.

Chez ADI, nous pensons que la protection de l'environnement est aussi une question d'inclusion : les personnes vivant avec handicap doivent pouvoir participer aux actions écologiques, en bénéficier et en être actrices.

À cette occasion, nos équipes et les jeunes que nous accompagnons ont mené des actions de sensibilisation et de reboisement dans la ville de Goma.

Merci aux jeunes en situation de handicap qui ont pris part à ces activités avec enthousiasme. La planète a besoin de toutes les énergies.`
    },
    {
      slug: 'realisations-gouvernement-sama-lukonde-pvh',
      title: '« Vers l’inclusion : les réalisations clés du gouvernement sortant de Sama Lukonde pour les personnes handicapées en RDC »',
      excerpt: "Nous tenons à exprimer notre gratitude au gouvernement sortant et à l'ancien Premier Ministre de la République pour les avancées en faveur des personnes handicapées.",
      category: 'plaidoyer',
      image: '/uploads/seed/cause-plaidoyer.jpg',
      author: 'ADI ONG',
      date: '2024-03-20',
      long_content: `Nous tenons à exprimer notre gratitude au gouvernement sortant et à l'ancien Premier Ministre de la République pour les avancées significatives enregistrées en faveur des personnes handicapées en République Démocratique du Congo.

Parmi les réalisations clés auxquelles l'ONG ADI a pris part ou qui nous ont bénéficié :
- le renforcement du cadre juridique et institutionnel de protection des personnes handicapées ;
- la prise en compte progressive des besoins spécifiques des PvH dans les politiques publiques ;
- l'ouverture de dialogues entre la société civile et l'État sur l'inclusion.

Ces progrès, encore partiels, constituent une base sur laquelle nous continuerons à plaider, avec la détermination de toujours, pour une RDC vraiment inclusive.`
    },
    {
      slug: 'suivi-evaluation-projet-scolarite-education-inclusive-goma',
      title: 'Suivi et évaluation du premier trimestre de la deuxième année du projet de scolarité pour l’éducation inclusive des personnes handicapées dans la ville de Goma',
      excerpt: "Le premier trimestre de la deuxième année du projet de scolarité inclusive à Goma fait état de résultats encourageants dans le suivi des enfants handicapés.",
      category: 'education',
      image: '/uploads/seed/cause-education.jpg',
      author: 'ADI ONG',
      date: '2024-04-13',
      long_content: `Au terme du premier trimestre de la deuxième année de notre projet de scolarité pour l'éducation inclusive des personnes handicapées dans la ville de Goma, nous tirons un bilan encourageant.

Les points saillants de ce trimestre :
- la continuité de la scolarisation des enfants bénéficiaires malgré les difficultés de contexte ;
- une amélioration des résultats scolaires pour plusieurs élèves ;
- le renforcement du lien entre l'ONG, les écoles et les familles ;
- le maintien du suivi pédagogique individualisé.

Nous remercions les écoles, les enseignants et les partenaires qui rendent ce projet possible. Le prochain trimestre sera consacré au renforcement des capacités des enseignants sur l'éducation inclusive.`
    },
    {
      slug: 'l-ong-adi-milite-pour-l-inclusion-pvh-bonne-gouvernance-democratie',
      title: 'L’ONG ADI milite pour l’inclusion des personnes handicapées dans la bonne gouvernance et la démocratie',
      excerpt: "L'ONG ADI s'engage à faire participer les Personnes Vivant avec Handicap à toutes les instances de décision et d'action politique et économique en RD Congo.",
      category: 'plaidoyer',
      image: '/uploads/seed/cause-plaidoyer.jpg',
      author: 'ADI ONG',
      date: '2024-02-10',
      long_content: `Dans le but de promouvoir le bien-être des personnes handicapées et de favoriser la démocratie et la bonne gouvernance, l'ONG Accessibility and Disabled Inclusion aspire à construire un Congo équitable et non discriminatoire, où les Personnes Vivant avec Handicap jouissent de leurs droits fondamentaux, s'épanouissent et sont pleinement intégrées dans la société.

L'ONG ADI s'engage à faire participer les Personnes Vivant avec Handicap à toutes les instances de décision et d'action politique et économique en RD Congo, afin qu'elles puissent revendiquer elles-mêmes leurs droits spécifiques.

Chaque personne compte, chaque contribution, chaque don compte pour créer un monde politique meilleur, adapté à tous et sans discrimination. En cliquant sur « Faire un don », faites la différence et rejoignez cette cause.`
    }
  ];
  const insArticle = db.prepare(`INSERT INTO articles (slug, title, excerpt, content, category, image, author, date, published, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`);
  for (const a of articles)
    insArticle.run(a.slug, a.title, a.excerpt, a.long_content, a.category, a.image, a.author, a.date, now);

  const campaigns = [
    {
      slug: 'scolarisation-inclusive-goma',
      title: 'Scolarité inclusive — Ville de Goma',
      description: "Aidez-nous à inscrire et maintenir les enfants en situation de handicap dans les écoles de la ville de Goma : frais de scolarité, kits scolaires adaptés et accompagnement pédagogique.",
      image: '/uploads/seed/campaign-scolarite.jpg',
      goal_amount: 5000,
      collected_amount: 3250,
      deadline: '2026-12-31',
      cause_slug: 'education'
    },
    {
      slug: 'kits-scolaires-kanyaruchinya',
      title: 'Kits scolaires — Camp de Kanyaruchinya',
      description: "Chaque kit comprend cahiers, stylos, uniformes et matériel adapté pour les enfants déplacés en situation de handicap. Ensemble, faisons redevenir l'école un droit pour tous.",
      image: '/uploads/seed/campaign-kits.jpg',
      goal_amount: 2000,
      collected_amount: 840,
      deadline: '2026-11-30',
      cause_slug: 'education'
    },
    {
      slug: 'fonds-entrepreneuriat-jeunes-pvh',
      title: 'Fonds d’entrepreneuriat des jeunes en situation de handicap',
      description: "Un fonds rotatif pour financer les premières activités génératrices de revenus de jeunes handicapés formés par l'ONG ADI : outillage, stock et démarrage.",
      image: '/uploads/seed/campaign-entrepreneuriat.jpg',
      goal_amount: 10000,
      collected_amount: 4120,
      deadline: '2027-03-31',
      cause_slug: 'entrepreneuriat'
    }
  ];
  const insCampaign = db.prepare(`INSERT INTO campaigns (slug, title, description, image, goal_amount, collected_amount, deadline, cause_slug, published, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`);
  for (const c of campaigns)
    insCampaign.run(c.slug, c.title, c.description, c.image, c.goal_amount, c.collected_amount, c.deadline, c.cause_slug, now);

  console.log('✅ Base de données initialisée avec les données de l\'ONG ADI.');
}

export async function syncMediaLibrary() {
  const uploadRoot = path.join(__dirname, 'uploads');
  const dirs = [
    { dir: path.join(uploadRoot, 'seed'), urlPrefix: '/uploads/seed' },
    { dir: path.join(uploadRoot, 'media'), urlPrefix: '/uploads/media' },
    { dir: path.join(uploadRoot, 'docs'), urlPrefix: '/uploads/docs' }
  ];
  const exists = db.prepare('SELECT 1 FROM media WHERE url = ?');
  const taken = db.prepare('SELECT 1 FROM media WHERE filename = ?');
  const ins = db.prepare(
    `INSERT INTO media (filename, url, thumb, size, width, height, mime, alt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const { dir, urlPrefix } of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (/\.thumb\.jpe?g$/i.test(name)) continue;
      if (!/\.(jpe?g|png|webp|gif|avif|svg|pdf)$/i.test(name)) continue;
      const url = `${urlPrefix}/${name}`;
      if (exists.get(url)) continue;
      const filePath = path.join(dir, name);
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) continue;

      let width = 0;
      let height = 0;
      let mime = 'image/jpeg';
      if (/\.pdf$/i.test(name)) {
        mime = 'application/pdf';
      } else {
        try {
          const img = await Jimp.read(filePath);
          width = img.bitmap.width;
          height = img.bitmap.height;
          mime = img.getMIME() || mime;
        } catch {
          if (/\.png$/i.test(name)) mime = 'image/png';
          else if (/\.webp$/i.test(name)) mime = 'image/webp';
          else if (/\.gif$/i.test(name)) mime = 'image/gif';
          else if (/\.svg$/i.test(name)) mime = 'image/svg+xml';
        }
      }

      const thumbFile = name.replace(/\.[^.]+$/, '.thumb.jpg');
      const thumb = fs.existsSync(path.join(dir, thumbFile)) ? `${urlPrefix}/${thumbFile}` : url;
      let filename = name;
      if (taken.get(filename)) filename = `${path.parse(name).name}-${stat.mtimeMs}${path.extname(name)}`;
      ins.run(filename, url, thumb, stat.size, width, height, mime, '');
    }
  }
}

export { slugify };
