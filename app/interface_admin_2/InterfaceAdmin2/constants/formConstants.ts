export const MAIN_OPERATIONS = [
    'Préparation',
    'Transport',
    'Traitement',
    'Gestion global',
    'TGAP',
    'Déclassement'
];

export const EXPANDED_OPERATIONS = [
    'Rachat',
    'Contenant',
    'Non expliqués'
];

export const ALL_OPERATIONS = [...MAIN_OPERATIONS, ...EXPANDED_OPERATIONS];

export const UNITES = ['Tonne', 'Kg', 'Litre', 'M3', 'Forfait', 'Unité'];

export const DEFAULT_PRESTATAIRE = ['Inconnu'];
export const DEFAULT_NOM_DECHET = ['Inconnu'];
export const DEFAULT_CODE_CED = ['Inconnu'];
export const DEFAULT_LIEU_COLLECTE = ['Inconnu'];

export const TYPES_CONTENANTS = [
    'FUT',
    'GRV',
    'CITERNE',
    'BENNE',
    'PIPELINE',
    'AUTRE'
]; 