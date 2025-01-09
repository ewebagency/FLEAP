// Nouveau fichier pour la logique financière
export interface WastePricing {
    code: string;
    pricePerTon: number;
}

// Prix par tonne selon le code CED (à ajuster selon vos besoins réels)
export const wastePricing: WastePricing[] = [
    { "code": "15 01 01", "pricePerTon": -150 }, // Papier/carton (revenu)
    { "code": "15 01 02", "pricePerTon": -100 }, // Plastique recyclé
    { "code": "20 01 02", "pricePerTon": -80 },  // Verre (revenu)
    { "code": "20 01 10", "pricePerTon": 300 },  // Textiles contaminés
    { "code": "20 01 21*", "pricePerTon": 800 }, // Tubes fluorescents
    { "code": "20 03 01", "pricePerTon": 250 },  // Déchets municipaux non triés
    { "code": "20 03 07", "pricePerTon": 100 },  // Déchets encombrants triés
    { "code": "16 02 14", "pricePerTon": 400 },  // Équipements électriques hors DEEE
    { "code": "16 05 04*", "pricePerTon": 1200 }, // Gaz contenus dans des conteneurs sous pression
    { "code": "20 01 35", "pricePerTon": 450 },  // DEEE non triés
    { "code": "15 01 07", "pricePerTon": 50 },   // Verre d'emballage non recyclable
    { "code": "19 12 04", "pricePerTon": 75 },   // Plastiques issus de tri mécano-biologique
    { "code": "19 12 10", "pricePerTon": 150 },  // Déchets combustibles issus de tri
    { "code": "20 01 27*", "pricePerTon": 1000 }, // Peintures, encres et colles contenant des substances dangereuses
    { "code": "17 06 05*", "pricePerTon": 1200 }, // Matériaux de construction contenant de l'amiante
    { "code": "19 08 01", "pricePerTon": 80 },   // Boues issues du traitement des eaux
    { "code": "20 03 99", "pricePerTon": 300 },  // Déchets municipaux divers
    { "code": "19 02 04", "pricePerTon": 600 }   // Boues non dangereuses issues de traitement physico-chimique
];


export const calculateFinancialAmount = (weight: number, wasteCode: string): number => {
    const pricing = wastePricing.find(p => wasteCode.replaceAll(' ', '').replace('*', '') === p.code.replaceAll(' ', '').replace('*', ''));
    if (!pricing) {
        // Prix par défaut si le code n'est pas trouvé
        return weight * 100; // 100€/tonne par défaut
    }
    return weight * pricing.pricePerTon;
}; 