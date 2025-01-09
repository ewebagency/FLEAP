export function estimerCarbone(ced:string, valorisationCode:string, poids:number) {
    //console.log('estimerCarbone appelé avec:', { ced, valorisationCode, poids });
    
    // Si les paramètres sont invalides, on utilise des valeurs par défaut
    if (!ced || !poids) {
        //console.warn('Paramètres manquants, utilisation des valeurs par défaut:', { ced, valorisationCode, poids });
        return '0.00 kg CO₂';
    }

    // Valeur par défaut pour valorisationCode si non défini
    const operationCode = valorisationCode || 'default';
    const quantite = poids > 0 ? poids : 0;

    // Facteurs d'émission carbone par valorisation/élimination (kg CO₂/tonne)
    const FACTEURS_CARBONE = {
        'D1': 500,  // Mise en décharge
        'D10': 400, // Incinération sans valorisation
        'R1': 100,  // Incinération avec valorisation énergétique
        'R5': 50,   // Recyclage
        'default': 300, // Valeur par défaut si code inconnu
    };

    // Sélection du facteur d'émission
    const facteur = FACTEURS_CARBONE[operationCode as keyof typeof FACTEURS_CARBONE] || FACTEURS_CARBONE['default'];

    // Calcul des émissions carbone
    const emissionsCarbone = quantite * facteur; // kg CO₂

    return `${emissionsCarbone.toFixed(2)} kg CO₂`;
}
