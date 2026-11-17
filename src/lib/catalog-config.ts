/**
 * Catégories de produits AfriZone et champs de fiche produit propres à chacune.
 *
 * - Chaque catégorie propose ses sous-catégories et ses champs (taille, couleur,
 *   pointure, marque, modèle, type, matière, stockage, etc.).
 * - Un champ `variant` est un choix du CLIENT à l'achat (taille, couleur, pointure…) :
 *   le vendeur liste les valeurs disponibles, le client en sélectionne une, et le
 *   choix suit la commande jusqu'au vendeur et au livreur.
 * - Les valeurs sont stockées dans `products.attributes` (jsonb).
 *
 * Les 8 catégories historiques (Électronique, Mode, Maison, Beauté, Alimentation,
 * Sport, Livres, Auto) gardent EXACTEMENT leur nom : les produits existants restent valides.
 */

export type AttributeType = 'text' | 'textarea' | 'number' | 'select' | 'multi' | 'date';

export interface AttributeDef {
  /** Clé stable stockée dans `products.attributes`. */
  key: string;
  label: string;
  type: AttributeType;
  options?: readonly string[];
  /** `multi` seulement : autorise des valeurs saisies librement en plus des options. */
  allowCustom?: boolean;
  /** `multi` seulement : le client choisit UNE valeur parmi celles proposées. */
  variant?: boolean;
  /** Libellé affiché au client pour le choix (ex. « Taille »). Défaut : `label`. */
  choiceLabel?: string;
  /** Affiche une pastille de couleur à côté de chaque valeur. */
  swatches?: boolean;
  placeholder?: string;
  hint?: string;
}

export type ProductAttributeValue = string | string[];
export type ProductAttributes = Record<string, ProductAttributeValue>;

export interface CategoryDef {
  name: string;
  subcategories: readonly string[];
  attributes: readonly AttributeDef[];
}

/* ───────────────────────────  Valeurs prédéfinies  ─────────────────────── */

export const COLOR_OPTIONS = [
  'Noir',
  'Blanc',
  'Gris',
  'Rouge',
  'Bleu',
  'Vert',
  'Jaune',
  'Orange',
  'Rose',
  'Violet',
  'Marron',
  'Beige',
  'Doré',
  'Argenté',
  'Multicolore',
] as const;

const COLOR_HEX: Record<string, string> = {
  noir: '#111827',
  blanc: '#FFFFFF',
  gris: '#9CA3AF',
  rouge: '#DC2626',
  bleu: '#2563EB',
  vert: '#16A34A',
  jaune: '#FACC15',
  orange: '#F97316',
  rose: '#EC4899',
  violet: '#7C3AED',
  marron: '#92400E',
  beige: '#E7D3B0',
  doré: '#D4AF37',
  dore: '#D4AF37',
  argenté: '#C0C0C0',
  argente: '#C0C0C0',
};

/** Couleur d'aperçu d'une valeur (null si inconnue ou « Multicolore »). */
export function colorSwatchHex(name: string): string | null {
  return COLOR_HEX[name.trim().toLowerCase()] ?? null;
}

const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', 'Taille unique'] as const;

const KIDS_SIZES = [
  '0-3 mois',
  '3-6 mois',
  '6-12 mois',
  '12-18 mois',
  '2 ans',
  '3 ans',
  '4 ans',
  '5 ans',
  '6 ans',
  '8 ans',
  '10 ans',
  '12 ans',
  '14 ans',
] as const;

const SHOE_SIZES = Array.from({ length: 22 }, (_, i) => String(26 + i)); // 26 → 47

const GENDERS = ['Homme', 'Femme', 'Mixte', 'Garçon', 'Fille', 'Bébé'] as const;

const MATERIALS_CLOTHES = [
  'Coton',
  'Polyester',
  'Lin',
  'Soie',
  'Laine',
  'Jean',
  'Cuir',
  'Wax',
  'Bazin',
  'Dentelle',
  'Autre',
] as const;

const WARRANTIES = ['Aucune', '3 mois', '6 mois', '1 an', '2 ans', '3 ans', '5 ans'] as const;

const STORAGE_OPTIONS = ['8 Go', '16 Go', '32 Go', '64 Go', '128 Go', '256 Go', '512 Go', '1 To'] as const;
const RAM_OPTIONS = ['1 Go', '2 Go', '3 Go', '4 Go', '6 Go', '8 Go', '12 Go', '16 Go', '32 Go'] as const;
const YES_NO = ['Oui', 'Non'] as const;

/* ────────────────────────────  Champs réutilisables  ─────────────────────── */

const brand: AttributeDef = {
  key: 'brand',
  label: 'Marque',
  type: 'text',
  placeholder: 'Ex. Samsung, Nike, Tecno…',
};

const model: AttributeDef = {
  key: 'model',
  label: 'Modèle',
  type: 'text',
  placeholder: 'Ex. Galaxy A15, Air Max 90…',
};

const colors: AttributeDef = {
  key: 'colors',
  label: 'Couleurs disponibles',
  choiceLabel: 'Couleur',
  type: 'multi',
  options: COLOR_OPTIONS,
  allowCustom: true,
  variant: true,
  swatches: true,
  hint: 'Cochez toutes les couleurs en stock : le client en choisira une à l’achat.',
};

const colorSingle: AttributeDef = {
  key: 'color',
  label: 'Couleur',
  type: 'select',
  options: COLOR_OPTIONS,
};

const clothingSizes: AttributeDef = {
  key: 'sizes',
  label: 'Tailles disponibles',
  choiceLabel: 'Taille',
  type: 'multi',
  options: CLOTHING_SIZES,
  allowCustom: true,
  variant: true,
  hint: 'Cochez toutes les tailles en stock : le client en choisira une à l’achat.',
};

const kidsSizes: AttributeDef = {
  key: 'sizes',
  label: 'Tailles / âges disponibles',
  choiceLabel: 'Taille',
  type: 'multi',
  options: KIDS_SIZES,
  allowCustom: true,
  variant: true,
};

const freeSizes: AttributeDef = {
  key: 'sizes',
  label: 'Tailles / formats disponibles',
  choiceLabel: 'Taille',
  type: 'multi',
  allowCustom: true,
  variant: true,
  placeholder: 'Ex. S, M, L — 1 place, 2 places — 30 cm',
  hint: 'Tapez une valeur puis « Ajouter » : le client en choisira une à l’achat.',
};

const shoeSizes: AttributeDef = {
  key: 'shoeSizes',
  label: 'Pointures disponibles',
  choiceLabel: 'Pointure',
  type: 'multi',
  options: SHOE_SIZES,
  allowCustom: true,
  variant: true,
  hint: 'Cochez toutes les pointures en stock : le client en choisira une à l’achat.',
};

const gender: AttributeDef = {
  key: 'gender',
  label: 'Genre',
  type: 'select',
  options: GENDERS,
};

const material = (options: readonly string[]): AttributeDef => ({
  key: 'material',
  label: 'Matière',
  type: 'select',
  options,
});

const typeOf = (options: readonly string[], label = 'Type'): AttributeDef => ({
  key: 'type',
  label,
  type: 'select',
  options,
});

const warranty: AttributeDef = {
  key: 'warranty',
  label: 'Garantie',
  type: 'select',
  options: WARRANTIES,
};

const dimensions: AttributeDef = {
  key: 'dimensions',
  label: 'Dimensions',
  type: 'text',
  placeholder: 'Ex. 120 × 60 × 75 cm',
};

const power: AttributeDef = {
  key: 'power',
  label: 'Puissance',
  type: 'text',
  placeholder: 'Ex. 1500 W',
};

const origin: AttributeDef = {
  key: 'origin',
  label: 'Origine',
  type: 'text',
  placeholder: 'Ex. Burkina Faso, Chine, France…',
};

const expiryDate: AttributeDef = {
  key: 'expiryDate',
  label: 'Date de péremption / limite de consommation',
  type: 'date',
};

const volume: AttributeDef = {
  key: 'volume',
  label: 'Contenance',
  type: 'text',
  placeholder: 'Ex. 250 ml, 100 g',
};

/** Ajouté à toutes les catégories : modèles / types / parfums au choix du client. */
export const GENERIC_VARIANTS: AttributeDef = {
  key: 'variants',
  label: 'Autres choix pour le client (modèle, type, parfum…)',
  choiceLabel: 'Modèle / type',
  type: 'multi',
  allowCustom: true,
  variant: true,
  placeholder: 'Ex. Modèle A, Modèle B',
  hint: 'Optionnel. Si votre produit existe en plusieurs modèles ou types au même prix, listez-les : le client en choisira un.',
};

/* ───────────────────────────────  Catégories  ───────────────────────────── */

export const CATEGORY_DEFS: readonly CategoryDef[] = [
  {
    name: 'Électronique',
    subcategories: ['TV & Audio', 'Casques & Écouteurs', 'Enceintes', 'Appareils photo & Caméras', 'Montres connectées', 'Drones', 'Accessoires électroniques'],
    attributes: [
      brand,
      model,
      typeOf(['Téléviseur', 'Enceinte', 'Casque / Écouteurs', 'Appareil photo', 'Caméra', 'Montre connectée', 'Accessoire', 'Autre']),
      colors,
      power,
      warranty,
    ],
  },
  {
    name: 'Téléphones & Tablettes',
    subcategories: ['Smartphones', 'Tablettes', 'Téléphones basiques', 'Coques & protections', 'Chargeurs & câbles', 'Batteries externes'],
    attributes: [
      brand,
      model,
      typeOf(['Smartphone', 'Tablette', 'Téléphone basique', 'Accessoire']),
      { key: 'storage', label: 'Stockage', type: 'select', options: STORAGE_OPTIONS },
      { key: 'ram', label: 'Mémoire RAM', type: 'select', options: RAM_OPTIONS },
      { key: 'network', label: 'Réseau', type: 'select', options: ['2G', '3G', '4G', '5G'] },
      { key: 'dualSim', label: 'Double SIM', type: 'select', options: YES_NO },
      colors,
      warranty,
    ],
  },
  {
    name: 'Informatique',
    subcategories: ['Ordinateurs portables', 'Ordinateurs de bureau', 'Écrans', 'Imprimantes & scanners', 'Disques & clés USB', 'Réseau & Wi-Fi', 'Claviers & souris', 'Fournitures de bureau'],
    attributes: [
      brand,
      model,
      typeOf(['Ordinateur portable', 'Ordinateur de bureau', 'Écran', 'Imprimante', 'Stockage', 'Réseau', 'Accessoire', 'Autre']),
      { key: 'processor', label: 'Processeur', type: 'text', placeholder: 'Ex. Intel Core i5, Ryzen 5' },
      { key: 'ram', label: 'Mémoire RAM', type: 'select', options: RAM_OPTIONS },
      { key: 'storage', label: 'Stockage', type: 'select', options: STORAGE_OPTIONS },
      { key: 'screenSize', label: 'Taille d’écran', type: 'text', placeholder: 'Ex. 15,6 pouces' },
      { key: 'os', label: 'Système', type: 'select', options: ['Windows', 'macOS', 'Linux', 'ChromeOS', 'Sans système'] },
      colors,
      warranty,
    ],
  },
  {
    name: 'Électroménager',
    subcategories: ['Réfrigérateurs & congélateurs', 'Climatiseurs & ventilateurs', 'Machines à laver', 'Cuisinières & fours', 'Mixeurs & robots', 'Bouilloires & cafetières', 'Fers à repasser', 'Aspirateurs'],
    attributes: [
      brand,
      model,
      typeOf(['Réfrigérateur', 'Congélateur', 'Climatiseur', 'Ventilateur', 'Machine à laver', 'Cuisinière', 'Four', 'Mixeur', 'Fer à repasser', 'Autre']),
      power,
      { key: 'capacity', label: 'Capacité', type: 'text', placeholder: 'Ex. 200 L, 7 kg' },
      dimensions,
      colors,
      warranty,
    ],
  },
  {
    name: 'Mode',
    subcategories: ['Vêtements femme', 'Vêtements homme', 'Vêtements enfant', 'Tenues traditionnelles', 'Costumes & tailleurs', 'Sous-vêtements', 'Vêtements de travail'],
    attributes: [
      brand,
      { ...model, label: 'Modèle / Style', placeholder: 'Ex. Slim, Oversize, Boubou brodé…' },
      typeOf(['T-shirt', 'Chemise', 'Robe', 'Jupe', 'Pantalon', 'Jean', 'Veste', 'Costume', 'Boubou', 'Ensemble', 'Pull / Sweat', 'Short', 'Autre']),
      gender,
      clothingSizes,
      colors,
      material(MATERIALS_CLOTHES),
    ],
  },
  {
    name: 'Chaussures & Maroquinerie',
    subcategories: ['Baskets', 'Sandales & tongs', 'Chaussures de ville', 'Bottes', 'Chaussures enfant', 'Sacs à main', 'Sacs à dos', 'Portefeuilles & ceintures', 'Valises & bagages'],
    attributes: [
      brand,
      model,
      typeOf(['Baskets', 'Sandales', 'Tongs', 'Mocassins', 'Chaussures de ville', 'Bottes', 'Sac à main', 'Sac à dos', 'Portefeuille', 'Ceinture', 'Valise', 'Autre']),
      gender,
      shoeSizes,
      colors,
      material(['Cuir', 'Daim', 'Toile', 'Synthétique', 'Caoutchouc', 'Textile', 'Autre']),
    ],
  },
  {
    name: 'Bijoux & Accessoires',
    subcategories: ['Montres', 'Colliers', 'Bracelets', 'Bagues', 'Boucles d’oreilles', 'Lunettes', 'Chapeaux & casquettes', 'Foulards & écharpes'],
    attributes: [
      brand,
      model,
      typeOf(['Montre', 'Collier', 'Bracelet', 'Bague', 'Boucles d’oreilles', 'Lunettes', 'Chapeau / Casquette', 'Foulard', 'Autre']),
      gender,
      material(['Or', 'Plaqué or', 'Argent', 'Acier inoxydable', 'Cuir', 'Perles', 'Bois', 'Plastique', 'Autre']),
      { ...freeSizes, label: 'Tailles (bague, bracelet…)', placeholder: 'Ex. 52, 54, 56 — S, M' },
      colors,
    ],
  },
  {
    name: 'Tissus & Pagnes',
    subcategories: ['Wax & pagnes', 'Bazin & brocart', 'Bogolan & tissus teints', 'Faso Dan Fani & Kita', 'Dentelle & voile', 'Tissu au mètre', 'Fournitures de couture'],
    attributes: [
      typeOf(['Wax', 'Bazin', 'Bogolan', 'Faso Dan Fani', 'Kita', 'Dentelle', 'Voile', 'Basin riche', 'Autre']),
      { ...brand, label: 'Marque / Fabricant', placeholder: 'Ex. Vlisco, Woodin, Hitarget…' },
      { key: 'pattern', label: 'Motif / Modèle', type: 'text', placeholder: 'Ex. Fleurs, Géométrique, Rayures…' },
      colors,
      material(['Coton', 'Polyester', 'Soie', 'Lin', 'Mélange', 'Autre']),
      { key: 'length', label: 'Longueur vendue', type: 'text', placeholder: 'Ex. 6 yards (1 pagne), 12 yards' },
      { key: 'width', label: 'Largeur', type: 'text', placeholder: 'Ex. 115 cm' },
    ],
  },
  {
    name: 'Maison',
    subcategories: ['Cuisine & vaisselle', 'Literie & linge', 'Décoration', 'Rangement', 'Éclairage', 'Nettoyage & entretien', 'Jardin & extérieur'],
    attributes: [
      brand,
      typeOf(['Vaisselle', 'Ustensile', 'Literie', 'Linge de maison', 'Décoration', 'Rangement', 'Éclairage', 'Entretien', 'Autre']),
      material(['Inox', 'Plastique', 'Verre', 'Céramique', 'Bois', 'Métal', 'Tissu', 'Coton', 'Autre']),
      freeSizes,
      colors,
      dimensions,
    ],
  },
  {
    name: 'Meubles & Décoration',
    subcategories: ['Canapés & fauteuils', 'Lits & matelas', 'Tables & chaises', 'Armoires & rangements', 'Bureaux', 'Décoration murale', 'Tapis & rideaux'],
    attributes: [
      brand,
      model,
      typeOf(['Canapé', 'Fauteuil', 'Lit', 'Matelas', 'Table', 'Chaise', 'Armoire', 'Bureau', 'Tapis', 'Rideau', 'Décoration', 'Autre']),
      material(['Bois', 'Métal', 'Tissu', 'Cuir', 'Simili cuir', 'Verre', 'Plastique', 'Rotin', 'Autre']),
      { key: 'seats', label: 'Nombre de places', type: 'text', placeholder: 'Ex. 3 places' },
      dimensions,
      colors,
    ],
  },
  {
    name: 'Beauté',
    subcategories: ['Soins du visage', 'Soins du corps', 'Cheveux & perruques', 'Maquillage', 'Parfums', 'Hygiène', 'Barbe & rasage', 'Ongles'],
    attributes: [
      brand,
      typeOf(['Crème', 'Lait / Lotion', 'Huile', 'Savon', 'Shampoing', 'Perruque / Mèches', 'Maquillage', 'Parfum', 'Déodorant', 'Autre']),
      volume,
      { key: 'skinType', label: 'Type de peau / cheveux', type: 'select', options: ['Tous types', 'Peau sèche', 'Peau grasse', 'Peau mixte', 'Peau sensible', 'Cheveux crépus', 'Cheveux défrisés'] },
      { key: 'shade', label: 'Teintes / parfums disponibles', choiceLabel: 'Teinte / parfum', type: 'multi', allowCustom: true, variant: true, placeholder: 'Ex. Caramel, Vanille, 1B…', hint: 'Le client en choisira un à l’achat.' },
      expiryDate,
    ],
  },
  {
    name: 'Santé & Bien-être',
    subcategories: ['Parapharmacie', 'Compléments alimentaires', 'Matériel médical', 'Tensiomètres & thermomètres', 'Plantes & produits naturels', 'Hygiène & soins'],
    attributes: [
      brand,
      typeOf(['Complément alimentaire', 'Matériel médical', 'Produit naturel', 'Hygiène', 'Parapharmacie', 'Autre']),
      volume,
      { key: 'usage', label: 'Mode d’emploi', type: 'textarea', placeholder: 'Indications d’utilisation' },
      expiryDate,
      warranty,
    ],
  },
  {
    name: 'Bébé & Enfants',
    subcategories: ['Vêtements bébé', 'Vêtements enfant', 'Jouets', 'Poussettes & sièges auto', 'Puériculture', 'Couches & hygiène', 'Fournitures scolaires'],
    attributes: [
      brand,
      typeOf(['Vêtement', 'Jouet', 'Poussette / Siège auto', 'Puériculture', 'Couches', 'Fourniture scolaire', 'Autre']),
      gender,
      { key: 'ageRange', label: 'Âge recommandé', type: 'select', options: ['0-6 mois', '6-12 mois', '1-3 ans', '3-6 ans', '6-10 ans', '10 ans et +'] },
      kidsSizes,
      colors,
      material(['Coton', 'Plastique', 'Bois', 'Peluche', 'Métal', 'Autre']),
    ],
  },
  {
    name: 'Alimentation',
    subcategories: ['Céréales & farines', 'Huiles & condiments', 'Fruits & légumes', 'Viandes & poissons', 'Boissons', 'Produits laitiers', 'Épices', 'Snacks & sucreries', 'Produits locaux transformés'],
    attributes: [
      brand,
      typeOf(['Céréale / Farine', 'Huile', 'Épice / Condiment', 'Fruit / Légume', 'Viande / Poisson', 'Boisson', 'Produit laitier', 'Snack / Sucrerie', 'Autre']),
      { key: 'netWeight', label: 'Poids / volume net', type: 'text', placeholder: 'Ex. 1 kg, 50 cl' },
      origin,
      { key: 'storage', label: 'Conservation', type: 'select', options: ['Température ambiante', 'Au frais', 'Congelé'] },
      { key: 'organic', label: 'Produit bio', type: 'select', options: YES_NO },
      expiryDate,
    ],
  },
  {
    name: 'Sport',
    subcategories: ['Football', 'Fitness & musculation', 'Running', 'Basket', 'Sports de combat', 'Camping & randonnée', 'Vêtements de sport', 'Chaussures de sport'],
    attributes: [
      brand,
      model,
      typeOf(['Vêtement de sport', 'Chaussures de sport', 'Ballon', 'Équipement fitness', 'Équipement de combat', 'Camping', 'Accessoire', 'Autre']),
      gender,
      clothingSizes,
      shoeSizes,
      colors,
      material(['Coton', 'Polyester', 'Cuir', 'Synthétique', 'Caoutchouc', 'Métal', 'Autre']),
    ],
  },
  {
    name: 'Livres',
    subcategories: ['Romans', 'Scolaire & universitaire', 'Religieux', 'Jeunesse', 'Bandes dessinées', 'Papeterie & fournitures', 'Développement personnel'],
    attributes: [
      { key: 'author', label: 'Auteur', type: 'text' },
      { key: 'publisher', label: 'Éditeur', type: 'text' },
      { key: 'language', label: 'Langue', type: 'select', options: ['Français', 'Anglais', 'Arabe', 'Langues locales', 'Autre'] },
      { key: 'format', label: 'Format', type: 'select', options: ['Broché', 'Relié', 'Poche', 'Cahier / Papeterie', 'Autre'] },
      { key: 'year', label: 'Année d’édition', type: 'number', placeholder: 'Ex. 2022' },
      { key: 'pages', label: 'Nombre de pages', type: 'number' },
      { key: 'isbn', label: 'ISBN', type: 'text', placeholder: 'Ex. 978-2-07-036822-8' },
    ],
  },
  {
    name: 'Jeux & Consoles',
    subcategories: ['Consoles', 'Jeux vidéo', 'Manettes & accessoires', 'Jeux de société', 'Jeux de plein air'],
    attributes: [
      brand,
      model,
      typeOf(['Console', 'Jeu vidéo', 'Manette', 'Jeu de société', 'Accessoire', 'Autre']),
      { key: 'platform', label: 'Plateforme', type: 'select', options: ['PlayStation', 'Xbox', 'Nintendo', 'PC', 'Mobile', 'Multi-plateformes', 'Autre'] },
      colors,
      warranty,
    ],
  },
  {
    name: 'Auto',
    subcategories: ['Pièces détachées', 'Pneus & jantes', 'Huiles & entretien', 'Accessoires auto', 'Autoradio & GPS', 'Batteries', 'Outils'],
    attributes: [
      brand,
      { ...model, label: 'Modèle / Référence', placeholder: 'Ex. Plaquettes avant AV-1234' },
      typeOf(['Pièce détachée', 'Pneu', 'Jante', 'Huile / Entretien', 'Batterie', 'Accessoire', 'Autoradio / GPS', 'Autre']),
      { key: 'compatibility', label: 'Véhicules compatibles', type: 'text', placeholder: 'Ex. Toyota Corolla 2010-2015' },
      { key: 'dimension', label: 'Dimension (pneu, jante…)', type: 'text', placeholder: 'Ex. 205/55 R16' },
      { key: 'year', label: 'Année', type: 'number', placeholder: 'Ex. 2018' },
      colors,
      warranty,
    ],
  },
  {
    name: 'Moto & Vélos',
    subcategories: ['Motos & scooters', 'Vélos', 'Casques & équipements', 'Pièces moto', 'Accessoires'],
    attributes: [
      brand,
      model,
      typeOf(['Moto', 'Scooter', 'Vélo', 'Casque', 'Pièce', 'Accessoire', 'Autre']),
      { key: 'engine', label: 'Cylindrée', type: 'text', placeholder: 'Ex. 125 cc' },
      { key: 'year', label: 'Année', type: 'number', placeholder: 'Ex. 2020' },
      { key: 'mileage', label: 'Kilométrage', type: 'text', placeholder: 'Ex. 12 000 km (occasion)' },
      { ...freeSizes, label: 'Tailles disponibles (casque, vélo…)', placeholder: 'Ex. S, M, L — 26", 28"' },
      colors,
      warranty,
    ],
  },
  {
    name: 'Bricolage & Outillage',
    subcategories: ['Outillage électroportatif', 'Outillage à main', 'Quincaillerie', 'Plomberie', 'Électricité', 'Peinture', 'Matériaux de construction', 'Sécurité & protection'],
    attributes: [
      brand,
      model,
      typeOf(['Outil électrique', 'Outil à main', 'Quincaillerie', 'Plomberie', 'Électricité', 'Peinture', 'Matériau', 'Protection', 'Autre']),
      { ...power, label: 'Puissance / Tension' },
      dimensions,
      material(['Acier', 'Inox', 'Aluminium', 'Plastique', 'Bois', 'Autre']),
      colors,
      warranty,
    ],
  },
  {
    name: 'Énergie & Solaire',
    subcategories: ['Panneaux solaires', 'Batteries', 'Onduleurs & régulateurs', 'Kits solaires', 'Lampes & lanternes solaires', 'Groupes électrogènes', 'Câbles & accessoires'],
    attributes: [
      brand,
      model,
      typeOf(['Panneau solaire', 'Batterie', 'Onduleur', 'Régulateur', 'Kit solaire', 'Lampe solaire', 'Groupe électrogène', 'Accessoire', 'Autre']),
      { ...power, label: 'Puissance (W)' },
      { key: 'capacity', label: 'Capacité (Ah / Wh)', type: 'text', placeholder: 'Ex. 100 Ah' },
      { key: 'voltage', label: 'Tension (V)', type: 'text', placeholder: 'Ex. 12 V' },
      dimensions,
      warranty,
    ],
  },
  {
    name: 'Agriculture & Élevage',
    subcategories: ['Semences & plants', 'Engrais & traitements', 'Matériel agricole', 'Irrigation', 'Alimentation animale', 'Volailles & petit élevage', 'Équipements d’élevage'],
    attributes: [
      typeOf(['Semences', 'Plants', 'Engrais', 'Traitement', 'Matériel', 'Irrigation', 'Aliment bétail / volaille', 'Animal', 'Autre']),
      brand,
      { key: 'variety', label: 'Variété / Espèce', type: 'text', placeholder: 'Ex. Maïs hybride, Poulet bicyclette' },
      { key: 'netWeight', label: 'Poids / quantité', type: 'text', placeholder: 'Ex. 25 kg, 100 poussins' },
      origin,
      expiryDate,
    ],
  },
  {
    name: 'Artisanat & Art',
    subcategories: ['Sculptures', 'Masques', 'Poterie', 'Paniers & vannerie', 'Peintures & tableaux', 'Instruments traditionnels', 'Décoration artisanale', 'Cuir artisanal'],
    attributes: [
      typeOf(['Sculpture', 'Masque', 'Poterie', 'Panier / Vannerie', 'Tableau', 'Instrument de musique', 'Décoration', 'Maroquinerie', 'Autre']),
      material(['Bois', 'Bronze / Laiton', 'Terre cuite', 'Cuir', 'Fibres naturelles', 'Perles', 'Tissu', 'Pierre', 'Autre']),
      dimensions,
      { ...origin, label: 'Origine / Artisan', placeholder: 'Ex. Bobo-Dioulasso — atelier Koné' },
      { key: 'handmade', label: 'Fabrication', type: 'select', options: ['Fait main', 'Semi-industriel'] },
      colors,
    ],
  },
];

export const CATEGORY_NAMES: readonly string[] = CATEGORY_DEFS.map((c) => c.name);

/** Champs proposés pour une catégorie hors liste (ancienne donnée / saisie libre admin). */
const FALLBACK_ATTRIBUTES: readonly AttributeDef[] = [
  brand,
  model,
  colorSingle,
  { key: 'material', label: 'Matière', type: 'text' },
  dimensions,
];

export function getCategoryDef(name: string | null | undefined): CategoryDef | null {
  if (!name) return null;
  return CATEGORY_DEFS.find((c) => c.name === name) ?? null;
}

export function subcategoriesFor(category: string): readonly string[] {
  return getCategoryDef(category)?.subcategories ?? [];
}

/** Champs de la fiche produit pour une catégorie (+ choix génériques). */
export function attributesForCategory(category: string): AttributeDef[] {
  const def = getCategoryDef(category);
  const base = def ? def.attributes : FALLBACK_ATTRIBUTES;
  const list = [...base];
  if (!list.some((a) => a.key === GENERIC_VARIANTS.key)) list.push(GENERIC_VARIANTS);
  return list;
}

/* ───────────────────────  Normalisation / affichage  ────────────────────── */

function isEmptyValue(v: unknown): boolean {
  if (v == null) return true;
  if (Array.isArray(v)) return v.filter((x) => String(x).trim()).length === 0;
  return String(v).trim() === '';
}

/** Retire les champs vides et ceux qui n'appartiennent pas à la catégorie. */
export function cleanAttributes(
  category: string,
  raw: ProductAttributes | null | undefined
): ProductAttributes {
  const out: ProductAttributes = {};
  if (!raw) return out;
  for (const def of attributesForCategory(category)) {
    const v = raw[def.key];
    if (isEmptyValue(v)) continue;
    if (Array.isArray(v)) {
      const items = [...new Set(v.map((x) => String(x).trim()).filter(Boolean))];
      if (items.length) out[def.key] = items;
    } else {
      out[def.key] = String(v).trim();
    }
  }
  return out;
}

/** Lit `products.attributes` (jsonb) de façon défensive. */
export function parseAttributes(value: unknown): ProductAttributes {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: ProductAttributes = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (Array.isArray(v)) {
      const items = v.map((x) => String(x)).filter((x) => x.trim());
      if (items.length) out[k] = items;
    } else if (v != null && String(v).trim() !== '') {
      out[k] = String(v);
    }
  }
  return out;
}

export function attributeToText(def: AttributeDef, value: ProductAttributeValue): string {
  if (Array.isArray(value)) return value.join(', ');
  if (def.type === 'date') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('fr-FR');
  }
  return value;
}

export interface ProductSpecRow {
  key: string;
  label: string;
  value: string;
}

/** Lignes « Caractéristiques » d'un produit (champs renseignés uniquement). */
export function specRows(category: string, attrs: ProductAttributes): ProductSpecRow[] {
  const rows: ProductSpecRow[] = [];
  for (const def of attributesForCategory(category)) {
    const v = attrs[def.key];
    if (isEmptyValue(v)) continue;
    rows.push({ key: def.key, label: def.label, value: attributeToText(def, v as ProductAttributeValue) });
  }
  return rows;
}

export interface VariantGroup {
  key: string;
  /** Libellé affiché au client et enregistré dans la commande (ex. « Taille »). */
  label: string;
  values: string[];
  swatches: boolean;
}

/** Choix que le client doit faire pour ce produit (taille, couleur, pointure…). */
export function variantGroups(category: string, attrs: ProductAttributes): VariantGroup[] {
  const groups: VariantGroup[] = [];
  for (const def of attributesForCategory(category)) {
    if (!def.variant) continue;
    const v = attrs[def.key];
    if (!Array.isArray(v) || v.length === 0) continue;
    groups.push({
      key: def.key,
      label: def.choiceLabel ?? def.label,
      values: v,
      swatches: !!def.swatches,
    });
  }
  return groups;
}

/** Choix du client : { Taille: 'M', Couleur: 'Noir' } — libellés lisibles, conservés dans la commande. */
export type SelectedOptions = Record<string, string>;

export function parseSelectedOptions(value: unknown): SelectedOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: SelectedOptions = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v != null && String(v).trim() !== '') out[k] = String(v);
  }
  return out;
}

/** Clé stable pour comparer deux jeux d'options (fusion des lignes du panier). */
export function selectedOptionsKey(options: SelectedOptions | null | undefined): string {
  if (!options) return '';
  return Object.keys(options)
    .sort()
    .map((k) => `${k}=${options[k]}`)
    .join('|');
}

export function selectedOptionsText(options: SelectedOptions | null | undefined): string {
  if (!options) return '';
  return Object.entries(options)
    .map(([k, v]) => `${k} : ${v}`)
    .join(' · ');
}
