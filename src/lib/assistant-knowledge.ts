/**
 * Base de connaissances de l'assistant AfriZone.
 * Sert à la fois au moteur local (hors ligne / sans clé IA) et au prompt système
 * envoyé à l'Edge Function `ai-assistant`.
 */

export type AssistantAudience = 'visiteur' | 'client' | 'vendeur' | 'livreur' | 'admin';

export interface AssistantLink {
  label: string;
  to: string;
}

export interface KnowledgeTopic {
  id: string;
  /** Mots-clés en minuscules, sans accents */
  keywords: string[];
  question: string;
  answer: string;
  links?: AssistantLink[];
  audiences?: AssistantAudience[];
}

export interface AssistantContext {
  role: AssistantAudience;
  path: string;
  userName?: string | null;
  country?: string | null;
  cartCount?: number;
}

export const COUNTRY_LABELS: Record<string, string> = {
  BF: 'Burkina Faso',
  ML: 'Mali',
  SN: 'Sénégal',
};

/** Résumé factuel de la plateforme — sert de contexte au modèle IA. */
export const PLATFORM_OVERVIEW = `
AfriZone est une marketplace multi-vendeurs en Afrique de l'Ouest couvrant trois pays :
Burkina Faso (BF), Mali (ML) et Sénégal (SN). Devise : FCFA.

La plateforme propose :
1. Une marketplace (boutiques de vendeurs indépendants, catalogue, panier, commandes).
2. Un service d'envoi de colis indépendant, avec numéro de suivi public.
3. Un réseau de livreurs avec suivi GPS en direct.

QUATRE RÔLES existent : client, vendeur, livreur, admin.
Un vendeur et un livreur doivent être validés par un administrateur avant de pouvoir travailler.

SÉLECTEUR PAYS : en haut du site, l'utilisateur choisit son pays (Burkina Faso, Mali, Sénégal).
Le catalogue et les boutiques affichés dépendent du pays sélectionné. Les villes servent
uniquement aux adresses de livraison, pas au filtre principal.

PAIEMENT : deux canaux distincts.
- Mobile Money : opérateurs télécoms (Orange Money, Moov Money, MTN Money).
- Wave : portefeuille indépendant, proposé séparément.
Le paiement est confirmé AVANT que le vendeur ne prépare la commande.

STATUTS DE COMMANDE, dans l'ordre :
en attente (pending) → confirmée/payée (confirmed) → en préparation (processing)
→ en livraison (shipped) → livrée (delivered). Une commande peut être annulée
(cancelled) ou remboursée (refunded).

À chaque étape, le client ET l'administrateur reçoivent un email automatique,
en plus d'une notification dans la cloche du site.

STATUTS DE COLIS : reçu, enlèvement programmé, collecté, en transit,
en cours de livraison, livré, annulé.

MODES DE LIVRAISON définis par le vendeur sur chaque produit :
- "Livraison par AfriZone" : un livreur AfriZone est assigné par l'administrateur.
- "Je livre moi-même" : le vendeur devient lui-même le livreur ; il démarre sa course
  depuis le détail de commande puis partage sa position GPS. Le client suit en direct.

BADGES VENDEURS : Vérifié (dossier validé), Gold Seller (volume de ventes élevé),
Top Rated (note ≥ 4,5 avec au moins 5 avis).

AVIS : un client peut noter le produit et le vendeur uniquement après que la commande
soit passée au statut "livrée".

ENGAGEMENTS ACCEPTÉS À L'INSCRIPTION (obligatoires) :
- Vendeur : ajouter les photos du produit ou du colis avant sa livraison au client.
- Client : photographier l'article reçu et envoyer la photo au vendeur pour confirmer
  la bonne réception.
`.trim();

/** Cartographie des pages, pour orienter l'utilisateur. */
export const PLATFORM_ROUTES = `
PAGES PUBLIQUES
/ : accueil (produits et vendeurs vedettes du pays sélectionné)
/catalogue : catalogue complet avec filtres (recherche, catégorie, pays, prix, état, tri)
/produit/:slug : fiche produit, avis, ajout au panier
/boutique/:slug : vitrine d'une boutique, ses produits et ses badges
/suivi : suivi public d'un colis avec le numéro de tracking
/faq, /contact, /cgu, /confidentialite : informations et pages légales

COMPTE CLIENT
/auth/login : connexion · /auth/register : choix du type de compte
/auth/register/client, /auth/register/vendor, /auth/register/driver : inscriptions
/auth/forgot-password : réinitialisation du mot de passe
/panier : panier · /checkout : adresse + paiement
/commandes : historique · /commandes/:id : détail, suivi et notation
/suivi-livraison/:id : carte de suivi GPS en direct du livreur
/colis : envoyer un colis · /colis/mes-envois : mes envois · /colis/:id : détail
/compte : profil · /compte/adresses : carnet d'adresses
/notifications : centre de notifications

ESPACE VENDEUR (rôle vendeur, après validation admin)
/vendeur : tableau de bord et statistiques
/vendeur/produits : liste · /vendeur/produits/nouveau : créer un produit
/vendeur/commandes : commandes reçues · /vendeur/commandes/:id : détail et changement de statut
/vendeur/livraisons : courses quand le vendeur livre lui-même
/vendeur/livraisons/:id : partage GPS et progression de la livraison

ESPACE LIVREUR (rôle livreur, après validation admin)
/livreur : tableau de bord · /livreur/courses : courses assignées
/livreur/courses/:id : accepter, collecter, livrer, partager la position GPS

ESPACE ADMIN (rôle admin)
/admin : tableau de bord · /admin/commandes · /admin/colis
/admin/vendeurs : valider ou refuser les boutiques
/admin/livreurs : valider les livreurs · /admin/livraisons : assigner les courses
/admin/utilisateurs · /admin/catalogue
`.trim();

export const KNOWLEDGE_TOPICS: KnowledgeTopic[] = [
  {
    id: 'commander',
    keywords: [
      'commander', 'commande', 'acheter', 'achat', 'passer commande', 'comment acheter',
      'panier', 'ajouter au panier', 'checkout',
    ],
    question: 'Comment passer une commande ?',
    answer:
      "Quatre étapes : 1) parcourez le catalogue et ouvrez la fiche du produit ; 2) cliquez sur « Ajouter au panier » ; 3) ouvrez le panier et lancez le checkout ; 4) renseignez votre adresse de livraison puis payez par Mobile Money ou Wave. Dès le paiement confirmé, la commande part chez le vendeur et vous recevez un email de confirmation.",
    links: [
      { label: 'Voir le catalogue', to: '/catalogue' },
      { label: 'Mon panier', to: '/panier' },
    ],
  },
  {
    id: 'paiement',
    keywords: [
      'paiement', 'payer', 'payement', 'moyen de paiement', 'orange money', 'wave',
      'moov', 'mtn', 'mobile money', 'carte', 'especes', 'argent',
    ],
    question: 'Quels moyens de paiement sont acceptés ?',
    answer:
      "Deux canaux : **Mobile Money** (Orange Money, Moov Money, MTN Money selon votre pays) et **Wave**. Au checkout, choisissez d'abord le canal, puis l'opérateur si vous êtes en Mobile Money, et saisissez le numéro qui doit être débité. Vous recevez une demande de confirmation sur ce numéro. Le paiement est validé avant que le vendeur ne prépare la commande.",
    links: [{ label: 'Aller au checkout', to: '/checkout' }],
  },
  {
    id: 'suivi-commande',
    keywords: [
      'suivi', 'suivre', 'ou est ma commande', 'tracking', 'livraison en cours',
      'statut', 'etat de ma commande', 'gps', 'carte', 'temps reel',
    ],
    question: 'Comment suivre ma commande ou ma livraison ?',
    answer:
      "Ouvrez « Mes commandes » puis la commande concernée : la frise indique le statut (payée → en préparation → en livraison → livrée). Quand un livreur — ou le vendeur lui-même — a démarré la course et partage sa position, un bouton de suivi GPS en direct apparaît sur le détail de la commande. Vous recevez aussi un email à chaque changement d'étape.",
    links: [{ label: 'Mes commandes', to: '/commandes' }],
  },
  {
    id: 'statuts',
    keywords: [
      'statut', 'statuts', 'etape', 'etapes', 'preparation', 'expedie', 'livre',
      'confirmee', 'en attente', 'signifie',
    ],
    question: 'Que veulent dire les statuts de commande ?',
    answer:
      "En attente : commande créée, paiement pas encore validé. Confirmée : le paiement est encaissé. En préparation : le vendeur prépare le colis. En livraison : la course est partie, le suivi GPS peut être disponible. Livrée : vous avez reçu l'article et pouvez laisser un avis. Annulée ou remboursée : la commande n'ira pas à son terme.",
    links: [{ label: 'Mes commandes', to: '/commandes' }],
  },
  {
    id: 'colis',
    keywords: [
      'colis', 'envoyer un colis', 'expedier', 'envoi', 'paquet', 'tracking colis',
      'numero de suivi', 'expedition',
    ],
    question: 'Comment envoyer ou suivre un colis ?',
    answer:
      "Le service colis est indépendant de la marketplace. Depuis « Envoi de colis », indiquez l'expéditeur, le destinataire, les villes de départ et d'arrivée, le type et le poids : le prix est estimé automatiquement. Après paiement, vous recevez un numéro de suivi. Le destinataire peut le saisir sur la page Suivi, sans avoir de compte.",
    links: [
      { label: 'Envoyer un colis', to: '/colis' },
      { label: 'Suivre un colis', to: '/suivi' },
      { label: 'Mes envois', to: '/colis/mes-envois' },
    ],
  },
  {
    id: 'compte-client',
    keywords: [
      'creer un compte', 'inscription', 'sinscrire', 'inscrire', 'compte client',
      'sinregistrer', 'enregistrement', 'nouveau compte',
    ],
    question: 'Comment créer un compte client ?',
    answer:
      "Allez sur « Créer un compte » puis choisissez le profil Client. Renseignez votre nom, votre téléphone, un mot de passe et votre ville. Vous devez accepter les conditions générales ainsi que l'engagement acheteur : photographier l'article à la réception et envoyer la photo au vendeur pour confirmer la bonne réception. L'email est facultatif, mais il est nécessaire pour recevoir les emails de suivi et réinitialiser un mot de passe.",
    links: [
      { label: 'Créer un compte client', to: '/auth/register/client' },
      { label: 'Se connecter', to: '/auth/login' },
    ],
  },
  {
    id: 'engagement-client',
    keywords: [
      'engagement', 'photo reception', 'photo article', 'contrat', 'preuve',
      'confirmer reception', 'bon etat',
    ],
    question: 'Pourquoi dois-je photographier l’article reçu ?',
    answer:
      "C'est l'engagement acheteur d'AfriZone, accepté à l'inscription. À la réception, vous photographiez l'article et envoyez la photo au vendeur : cela confirme que la marchandise est arrivée en bon état. De son côté, le vendeur s'engage à photographier le produit avant l'expédition. Ces deux photos protègent les deux parties en cas de litige.",
  },
  {
    id: 'devenir-vendeur',
    keywords: [
      'devenir vendeur', 'vendre', 'boutique', 'ouvrir une boutique', 'vendeur',
      'marchand', 'commerce',
    ],
    question: 'Comment devenir vendeur sur AfriZone ?',
    answer:
      "L'inscription vendeur se fait en deux étapes. D'abord votre identité : nom, téléphone, email, mot de passe et une pièce d'identité (CNI ou passeport). Ensuite votre boutique : nom, pays, ville, adresse, catégorie, description, logo et registre de commerce si vous en avez un. Vous validez l'engagement vendeur — ajouter les photos du produit ou du colis avant la livraison — puis un administrateur examine votre dossier. Une fois approuvé, votre espace vendeur s'ouvre.",
    links: [{ label: 'Devenir vendeur', to: '/auth/register/vendor' }],
  },
  {
    id: 'devenir-livreur',
    keywords: [
      'devenir livreur', 'livreur', 'coursier', 'moto', 'livrer', 'course',
      'travailler comme livreur',
    ],
    question: 'Comment devenir livreur ?',
    answer:
      "Inscrivez-vous via « Devenir livreur » : vos informations personnelles, votre type de véhicule (moto, vélo, voiture, camionnette), l'immatriculation, votre ville et les pays que vous desservez. Après validation par un administrateur, les courses qui vous sont assignées apparaissent dans votre espace livreur, où vous pouvez les accepter et partager votre position GPS.",
    links: [{ label: 'Devenir livreur', to: '/auth/register/driver' }],
  },
  {
    id: 'avis',
    keywords: ['avis', 'noter', 'note', 'commentaire', 'evaluation', 'etoiles', 'review'],
    question: 'Comment laisser un avis ?',
    answer:
      "Un avis n'est possible qu'après une commande réellement livrée. Ouvrez le détail de la commande concernée : un formulaire de notation apparaît pour le produit et pour le vendeur. Votre note met automatiquement à jour la moyenne de la boutique et peut lui faire gagner le badge Top Rated.",
    links: [{ label: 'Mes commandes', to: '/commandes' }],
  },
  {
    id: 'badges',
    keywords: ['badge', 'badges', 'verifie', 'gold', 'top rated', 'confiance', 'fiable'],
    question: 'Que signifient les badges des vendeurs ?',
    answer:
      "Trois badges existent. **Vérifié** : le dossier et la pièce d'identité du vendeur ont été validés par AfriZone. **Gold Seller** : la boutique a atteint un volume de ventes élevé. **Top Rated** : la note moyenne est d'au moins 4,5 sur au minimum 5 avis. Ils vous aident à repérer les boutiques les plus fiables.",
    links: [{ label: 'Voir les boutiques', to: '/catalogue' }],
  },
  {
    id: 'pays',
    keywords: [
      'pays', 'burkina', 'mali', 'senegal', 'changer de pays', 'ville', 'zone',
      'dakar', 'ouagadougou', 'bamako', 'localisation',
    ],
    question: 'Comment changer de pays ?',
    answer:
      "AfriZone couvre le Burkina Faso, le Mali et le Sénégal. Le sélecteur de pays se trouve en haut du site, à côté de la barre de recherche : il filtre le catalogue et les boutiques affichées. Les villes, elles, servent au moment de la livraison, quand vous saisissez votre adresse.",
    links: [{ label: 'Parcourir le catalogue', to: '/catalogue' }],
  },
  {
    id: 'adresses',
    keywords: ['adresse', 'adresses', 'domicile', 'livrer chez moi', 'carnet', 'profil'],
    question: 'Comment gérer mes adresses de livraison ?',
    answer:
      "Dans « Mon compte » → « Mes adresses », vous pouvez enregistrer plusieurs adresses et en définir une par défaut. Celle-ci est préremplie automatiquement au checkout et lors d'un envoi de colis, ce qui vous évite de la retaper à chaque commande.",
    links: [
      { label: 'Mes adresses', to: '/compte/adresses' },
      { label: 'Mon profil', to: '/compte' },
    ],
  },
  {
    id: 'mot-de-passe',
    keywords: [
      'mot de passe', 'oublie', 'connexion', 'connecter', 'login', 'acces',
      'je narrive pas a me connecter', 'reinitialiser',
    ],
    question: 'J’ai oublié mon mot de passe, que faire ?',
    answer:
      "Utilisez « Mot de passe oublié » sur la page de connexion : un lien de réinitialisation est envoyé à votre email. Attention, un compte créé uniquement avec un numéro de téléphone, sans email, ne peut pas recevoir ce lien — dans ce cas, contactez le support pour faire réinitialiser le mot de passe.",
    links: [
      { label: 'Mot de passe oublié', to: '/auth/forgot-password' },
      { label: 'Contact', to: '/contact' },
    ],
  },
  {
    id: 'notifications',
    keywords: ['notification', 'notifications', 'cloche', 'alerte', 'email', 'mail'],
    question: 'Où voir mes notifications ?',
    answer:
      "La cloche dans l'en-tête affiche vos notifications non lues, et la page Notifications regroupe tout l'historique. En parallèle, un email automatique part à chaque étape de votre commande, du paiement jusqu'à la livraison.",
    links: [{ label: 'Mes notifications', to: '/notifications' }],
  },
  {
    id: 'annulation',
    keywords: ['annuler', 'annulation', 'rembourser', 'remboursement', 'retour', 'litige'],
    question: 'Puis-je annuler une commande ?',
    answer:
      "Une commande peut être annulée tant qu'elle n'est pas partie en livraison, c'est-à-dire aux statuts en attente, confirmée ou en préparation. Passé ce stade, contactez d'abord le vendeur, puis le support AfriZone si le problème persiste. Les photos prises au départ et à la réception servent de preuve en cas de litige.",
    links: [
      { label: 'Mes commandes', to: '/commandes' },
      { label: 'Contacter le support', to: '/contact' },
    ],
  },
  {
    id: 'frais-livraison',
    keywords: ['frais', 'livraison', 'cout', 'prix livraison', 'gratuit', 'combien'],
    question: 'Comment sont calculés les frais de livraison ?',
    answer:
      "Cela dépend du mode choisi par le vendeur sur chaque produit. En « Livraison par AfriZone », c'est le tarif de la plateforme qui s'applique. En « Je livre moi-même », le vendeur fixe ses propres frais et ses zones de livraison. Le montant exact est affiché dans le récapitulatif du panier et du checkout, avant tout paiement.",
    links: [{ label: 'Mon panier', to: '/panier' }],
  },
  // ── Vendeur ─────────────────────────────────────────────
  {
    id: 'vendeur-produit',
    keywords: ['ajouter un produit', 'publier', 'nouveau produit', 'article', 'stock', 'photo produit'],
    question: 'Comment publier un produit ?',
    answer:
      "Depuis « Mes produits » → « Nouveau produit », renseignez le nom, la description, la catégorie, le prix, le stock et jusqu'à 5 images. Choisissez ensuite le mode de livraison : par AfriZone, ou « Je livre moi-même » avec vos pays desservis et vos frais. Une fois enregistré, le produit apparaît immédiatement dans le catalogue de votre pays.",
    links: [
      { label: 'Nouveau produit', to: '/vendeur/produits/nouveau' },
      { label: 'Mes produits', to: '/vendeur/produits' },
    ],
    audiences: ['vendeur', 'admin'],
  },
  {
    id: 'vendeur-commande',
    keywords: ['traiter une commande', 'preparer', 'expedier', 'faire avancer', 'numero de suivi'],
    question: 'Comment traiter une commande reçue ?',
    answer:
      "Ouvrez « Commandes » puis la commande à traiter. Faites-la avancer étape par étape : confirmée → en préparation → en livraison → livrée. Au passage en livraison, si le produit est en mode AfriZone, saisissez un numéro de suivi ; s'il est en mode « Je livre moi-même », cliquez plutôt sur « Démarrer ma livraison ». Chaque changement déclenche un email au client.",
    links: [{ label: 'Mes commandes vendeur', to: '/vendeur/commandes' }],
    audiences: ['vendeur', 'admin'],
  },
  {
    id: 'vendeur-livraison',
    keywords: ['je livre moi meme', 'livrer moi meme', 'self delivery', 'ma livraison', 'partager position'],
    question: 'Comment livrer moi-même une commande ?',
    answer:
      "Sur une commande dont le produit est en mode « Je livre moi-même », le bouton « Démarrer ma livraison » crée votre course : vous devenez le livreur pour ce colis. Rendez-vous ensuite dans « Mes livraisons », activez « Partager ma position » et faites progresser le statut jusqu'à la remise. Le client suit votre trajet en direct sur la carte.",
    links: [{ label: 'Mes livraisons', to: '/vendeur/livraisons' }],
    audiences: ['vendeur', 'admin'],
  },
  {
    id: 'vendeur-validation',
    keywords: ['validation', 'valide', 'en attente de validation', 'approuve', 'refuse', 'dossier'],
    question: 'Ma boutique est en attente de validation, que se passe-t-il ?',
    answer:
      "Un administrateur doit vérifier votre pièce d'identité et les informations de votre boutique avant l'ouverture. Tant que le dossier est en attente, vous ne pouvez ni publier de produit ni recevoir de commande. Vous êtes prévenu par notification et par email dès que la décision est prise. En cas de refus, le motif vous est communiqué et vous pouvez soumettre un nouveau dossier.",
    audiences: ['vendeur', 'visiteur', 'admin'],
  },
  // ── Livreur ─────────────────────────────────────────────
  {
    id: 'livreur-course',
    keywords: ['course', 'accepter', 'collecte', 'en route', 'terminer la course', 'itineraire'],
    question: 'Comment gérer une course de livraison ?',
    answer:
      "Vos courses assignées apparaissent dans « Mes courses ». Ouvrez-en une et suivez la progression : accepter → collectée → en route → livrée. Activez « Partager ma position » pour que le client suive le trajet en direct, et utilisez le lien Google Maps pour l'itinéraire. Le passage à « livrée » met automatiquement la commande à jour côté client.",
    links: [{ label: 'Mes courses', to: '/livreur/courses' }],
    audiences: ['livreur', 'admin'],
  },
  // ── Admin ───────────────────────────────────────────────
  {
    id: 'admin-general',
    keywords: ['admin', 'administration', 'valider un vendeur', 'assigner', 'tableau de bord admin'],
    question: 'Que puis-je faire depuis l’espace admin ?',
    answer:
      "L'espace admin centralise tout : le tableau de bord (chiffre d'affaires, commandes, colis, utilisateurs), la validation des vendeurs et des livreurs avec consultation des pièces d'identité, l'assignation des courses, la gestion des commandes et des colis, le catalogue, ainsi que les comptes utilisateurs (modification, mot de passe, suppression).",
    links: [
      { label: 'Tableau de bord', to: '/admin' },
      { label: 'Vendeurs', to: '/admin/vendeurs' },
      { label: 'Livraisons', to: '/admin/livraisons' },
    ],
    audiences: ['admin'],
  },
  // ── Divers ──────────────────────────────────────────────
  {
    id: 'securite',
    keywords: ['securite', 'arnaque', 'fiable', 'confiance', 'donnees', 'confidentialite', 'rgpd'],
    question: 'AfriZone est-il sûr ?',
    answer:
      "Les vendeurs et les livreurs sont identifiés et validés manuellement avant d'exercer, avec pièce d'identité à l'appui. Les paiements passent par les opérateurs Mobile Money et Wave, et le protocole photo au départ et à la réception documente chaque transaction. Le détail du traitement de vos données figure dans la politique de confidentialité.",
    links: [
      { label: 'Confidentialité', to: '/confidentialite' },
      { label: 'CGU', to: '/cgu' },
    ],
  },
  {
    id: 'contact',
    keywords: ['contact', 'support', 'aide', 'assistance', 'probleme', 'humain', 'telephone'],
    question: 'Comment contacter le support ?',
    answer:
      "La page Contact permet d'écrire directement à l'équipe AfriZone. Pour un problème lié à une commande précise, pensez à indiquer son numéro (format AZ-…) : le traitement en sera nettement plus rapide.",
    links: [
      { label: 'Contacter AfriZone', to: '/contact' },
      { label: 'FAQ', to: '/faq' },
    ],
  },
];

export const QUICK_ACTIONS: Record<AssistantAudience, string[]> = {
  visiteur: [
    'Comment passer une commande ?',
    'Quels moyens de paiement acceptez-vous ?',
    'Comment devenir vendeur ?',
    'Comment envoyer un colis ?',
  ],
  client: [
    'Où est ma commande ?',
    'Comment payer avec Wave ?',
    'Comment laisser un avis ?',
    'Puis-je annuler une commande ?',
  ],
  vendeur: [
    'Comment publier un produit ?',
    'Comment traiter une commande ?',
    'Comment livrer moi-même ?',
    'Que signifient les badges ?',
  ],
  livreur: [
    'Comment gérer une course ?',
    'Comment partager ma position ?',
    'Comment terminer une livraison ?',
  ],
  admin: [
    'Comment valider un vendeur ?',
    'Comment assigner une course ?',
    'Que contient le tableau de bord ?',
  ],
};

const PATH_HINTS: Array<{ match: RegExp; hint: string }> = [
  { match: /^\/$/, hint: "L'utilisateur est sur la page d'accueil." },
  { match: /^\/catalogue/, hint: "L'utilisateur parcourt le catalogue." },
  { match: /^\/produit\//, hint: "L'utilisateur consulte une fiche produit." },
  { match: /^\/boutique\//, hint: "L'utilisateur consulte une boutique." },
  { match: /^\/panier/, hint: "L'utilisateur est dans son panier." },
  { match: /^\/checkout/, hint: "L'utilisateur est en train de payer (checkout)." },
  { match: /^\/commandes/, hint: "L'utilisateur consulte ses commandes." },
  { match: /^\/colis/, hint: "L'utilisateur est dans le service d'envoi de colis." },
  { match: /^\/suivi-livraison/, hint: "L'utilisateur suit une livraison en direct." },
  { match: /^\/suivi/, hint: "L'utilisateur suit un colis via son numéro de tracking." },
  { match: /^\/compte/, hint: "L'utilisateur gère son profil ou ses adresses." },
  { match: /^\/vendeur/, hint: "L'utilisateur est dans son espace vendeur." },
  { match: /^\/livreur/, hint: "L'utilisateur est dans son espace livreur." },
  { match: /^\/admin/, hint: "L'utilisateur est dans l'espace administration." },
  { match: /^\/auth/, hint: "L'utilisateur est sur une page de connexion ou d'inscription." },
];

export function describeContext(ctx: AssistantContext): string {
  const parts: string[] = [`Rôle : ${ctx.role}.`, `Page actuelle : ${ctx.path}.`];
  const hint = PATH_HINTS.find((h) => h.match.test(ctx.path));
  if (hint) parts.push(hint.hint);
  if (ctx.userName) parts.push(`Prénom/nom : ${ctx.userName}.`);
  if (ctx.country) parts.push(`Pays sélectionné : ${COUNTRY_LABELS[ctx.country] || ctx.country}.`);
  if (typeof ctx.cartCount === 'number' && ctx.cartCount > 0) {
    parts.push(`Articles dans le panier : ${ctx.cartCount}.`);
  }
  return parts.join(' ');
}

export function buildSystemPrompt(ctx: AssistantContext): string {
  return [
    "Tu es « Zoni », l'assistant officiel de la plateforme AfriZone. Tu réponds toujours en français,",
    "sur un ton chaleureux, clair et concis (3 à 6 phrases maximum, sans listes à puces sauf si l'utilisateur",
    'demande une procédure étape par étape).',
    '',
    "RÈGLES :",
    "- Base-toi uniquement sur les informations ci-dessous. Si tu ne sais pas, dis-le et oriente vers la page Contact.",
    "- N'invente jamais de prix, de délai, de promotion ni de fonctionnalité inexistante.",
    "- Cite les pages par leur nom lisible (« Mes commandes ») plutôt que par leur URL brute.",
    "- Adapte la réponse au rôle de l'utilisateur : ne propose pas d'action vendeur à un client.",
    "- Ne demande jamais de mot de passe, de code PIN Mobile Money ni de données bancaires.",
    '',
    '=== PRÉSENTATION DE LA PLATEFORME ===',
    PLATFORM_OVERVIEW,
    '',
    '=== PAGES DISPONIBLES ===',
    PLATFORM_ROUTES,
    '',
    '=== QUESTIONS FRÉQUENTES ===',
    KNOWLEDGE_TOPICS.map((t) => `Q: ${t.question}\nR: ${t.answer}`).join('\n\n'),
    '',
    '=== CONTEXTE DE LA SESSION ===',
    describeContext(ctx),
  ].join('\n');
}
