export const MAIN_OPERATIONS = [
    'Gestion globale',
    'Préparation',
    'Transport',
    'Traitement',
    'TGAP',
    'Déclassement',
    'Pénalités'
];

export const EXPANDED_OPERATIONS = [
    'Rachat',
    'Location', //->contenant
    'Maintenance', //->contenant
    'Mise à disposition', //->contenant
    'Non expliqués', 
    'Autres : Contenant', //->contenant
    'Autres'
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