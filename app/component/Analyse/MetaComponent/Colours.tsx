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
        'bg-gray-400', 'bg-gray-700',
        'bg-red-400', 'bg-red-700',
        'bg-amber-400', 'bg-amber-700',
        'bg-lime-400', 'bg-lime-700',
        'bg-emerald-400', 'bg-emerald-700',
        'bg-sky-400', 'bg-sky-700'
    ];
    return colours_fonda.slice(0, nombre_couleurs);
}

export const getChecked = (nombre_checked: number) => {
    const checked_liste = [];
    for (let i = 0; i < nombre_checked-1; i++) {
        checked_liste.push(true);
    }
    checked_liste.push(true); //Pour Autres
    return checked_liste;
}


export const tailwindToRgb = (tailwindColor: string): string => {
    const colorMap: { [key: string]: string } = {
        'blue-400': 'rgb(96, 165, 250)',
        'blue-700': 'rgb(29, 78, 216)',
        'green-400': 'rgb(74, 222, 128)',
        'green-700': 'rgb(21, 128, 61)',
        'purple-400': 'rgb(192, 132, 252)',
        'purple-700': 'rgb(126, 34, 206)',
        'yellow-400': 'rgb(250, 204, 21)',
        'yellow-700': 'rgb(161, 98, 7)',
        'pink-400': 'rgb(244, 114, 182)',
        'pink-700': 'rgb(190, 24, 93)',
        'orange-400': 'rgb(251, 146, 60)',
        'orange-700': 'rgb(194, 65, 12)',
        'teal-400': 'rgb(45, 212, 191)',
        'teal-700': 'rgb(15, 118, 110)',
        'cyan-400': 'rgb(34, 211, 238)',
        'cyan-700': 'rgb(14, 116, 144)',
        'indigo-400': 'rgb(129, 140, 248)',
        'indigo-700': 'rgb(67, 56, 202)',
        'gray-400': 'rgb(156, 163, 175)',
        'gray-700': 'rgb(55, 65, 81)',
        'red-400': 'rgb(248, 113, 113)',
        'red-700': 'rgb(185, 28, 28)',
        'amber-400': 'rgb(251, 191, 36)',
        'amber-700': 'rgb(180, 83, 9)',
        'lime-400': 'rgb(163, 230, 53)',
        'lime-700': 'rgb(77, 124, 15)',
        'emerald-400': 'rgb(52, 211, 153)',
        'emerald-700': 'rgb(4, 120, 87)',
        'sky-400': 'rgb(56, 189, 248)',
        'sky-700': 'rgb(3, 105, 161)',
    };
    return colorMap[tailwindColor.replace('bg-', '')] || 'rgb(156, 163, 175)';
};

export const tailwindToRgba = (tailwindColor: string, alpha: number = 1): string => {
    const rgb = tailwindToRgb(tailwindColor);
    return rgb.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
};