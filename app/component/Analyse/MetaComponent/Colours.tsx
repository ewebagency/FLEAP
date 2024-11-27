export const getColors = (nombre_couleurs: number) => {
    const colours_fonda = [
        'bg-blue-400', 'bg-blue-700',
        'bg-green-400', 'bg-green-700',
        'bg-purple-400', 'bg-purple-700',
        'bg-yellow-400', 'bg-yellow-700',
        'bg-pink-400', 'bg-pink-700',
        'bg-orange-400', 'bg-orange-700',
        'bg-teal-400', 'bg-teal-700',
        'bg-cyan-400', 'bg-cyan-700',
        'bg-indigo-400', 'bg-indigo-700',
        'bg-gray-400', 'bg-gray-700'
    ];
    return colours_fonda.slice(0, nombre_couleurs);
}

export const getChecked = (nombre_checked: number) => {
    const checked_liste = [];
    for (let i = 0; i < nombre_checked; i++) {
        checked_liste.push(false);
    }
    checked_liste[0] = true;
    return checked_liste;
}
