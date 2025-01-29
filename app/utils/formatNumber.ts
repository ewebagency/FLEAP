export const formatNumber = (value: number, forceDecimals: boolean = false): string => {
    // Pour les nombres entiers (si forceDecimals est false)
    if (!forceDecimals && Number.isInteger(value)) {
        return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    }
    
    // Pour les nombres décimaux
    return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}; 