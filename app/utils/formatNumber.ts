export const formatNumber = (value: number, forceDecimals: boolean = false, forceTroisChiffres: boolean = false): string => {
    // Pour les nombres >= 1000, on arrondit à l'entier et on ajoute le séparateur de milliers
    if (Math.abs(value) >= 1000) {
        if (forceTroisChiffres) {
            // Formater avec 3 décimales et séparateur de milliers
            const nombreFormate = value.toFixed(2);
            const [partieEntiere, partieDecimale] = nombreFormate.split('.');
            return `${partieEntiere.replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${partieDecimale}`;
        }
        return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    }
    
    // Pour les nombres < 1000
    if (!forceDecimals && !forceTroisChiffres && Number.isInteger(value)) {
        return value.toString();
    }
    
    // Pour les nombres décimaux < 1000
    if (forceTroisChiffres) {
        return value.toFixed(2).replace('.', ',');
    }
    return value.toFixed(2).replace('.', ',');
}; 