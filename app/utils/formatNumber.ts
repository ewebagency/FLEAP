export const formatNumber = (value: number, forceDecimals: boolean = false): string => {
    // Pour les nombres >= 1000, on arrondit à l'entier et on ajoute le séparateur de milliers
    if (Math.abs(value) >= 1000) {
        return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    }
    
    // Pour les nombres < 1000
    if (!forceDecimals && Number.isInteger(value)) {
        return value.toString();
    }
    
    // Pour les nombres décimaux < 1000
    return value.toFixed(2).replace('.', ',');
}; 