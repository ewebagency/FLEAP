

export const ExtractInfosFromTextOCR = (text:string) => {

    // Récupérer tous les textes entre chaque occurrence de "Dossier"
    const dossierTexts = [];
    const dossierRegex = /Dossier(.*?)Dossier/sg; // Utiliser 'g' pour trouver toutes les occurrences
    let match;
    while ((match = dossierRegex.exec(text)) !== null) {
        dossierTexts.push(match[1].trim()); // Ajouter le texte trouvé au tableau
    }

    // Variables pour stocker les résultats
    const results = dossierTexts.map((dossierText) => {
        const dossierNumberMatch = dossierText.match(/N° (\w+)/);
        const dossierNumber = dossierNumberMatch ? dossierNumberMatch[1] : null;

        const uppercaseLineMatch = dossierText.match(/N°\s*\w+\s*\[NEWLINE\](.*?)\[NEWLINE\]/);
        const uppercaseLine = uppercaseLineMatch ? uppercaseLineMatch[1].trim() : null;

        const matterLineMatch = dossierText.match(/Matière\s*:\s*(.*?)(?=\[NEWLINE])/);
        const matterLine = matterLineMatch ? matterLineMatch[0].trim() : null;

        const cedMatch = matterLine.match(/CED\s*(\d+)/);
        const cedNumber = cedMatch ? cedMatch[1] : null; // Récupère le numéro CED

        const minusLineMatch = dossierText.match(/Matière\s*:\s*.*?\[NEWLINE\](.*?)\[NEWLINE\]/);
        const minusLine = minusLineMatch ? minusLineMatch[1].trim() : null;
        const {description_minus, type_minus, total_ht_minus, prix_unitaire_minus,quantite_minus, tva_minus} = extractDetailsMinus(minusLine);

        const plusLineMatch = dossierText.match(/Matière\s*:\s*.*?\[NEWLINE\].*?\[NEWLINE\](.*?)\[NEWLINE\]/);
        let plusLine = plusLineMatch ? plusLineMatch[1].trim() : null;
        // ----> Vérification pour le nombre de chiffres consécutifs
        if (plusLine && (plusLine.match(/(\d{2})/g) || []).length < 3) {
            // Si moins de 3 groupes de 2 chiffres, prendre la ligne suivante
            const nextLineMatch = dossierText.match(/Matière\s*:\s*.*?\[NEWLINE\].*?\[NEWLINE\].*?\[NEWLINE\](.*?)\[NEWLINE\]/);
            plusLine = nextLineMatch ? nextLineMatch[1].trim() : plusLine; // garde la plusLine actuelle si pas de ligne suivante
        }
        const {description_plus, type_plus, total_ht_plus, prix_unitaire_plus, quantite_plus} = extractDetailsPlus(plusLine);

        return {
            dossierNumber,
            uppercaseLine,
            matterLine,
            cedNumber,
            plusLine,
                description_plus, type_plus, total_ht_plus, prix_unitaire_plus, quantite_plus,
            minusLine,
                description_minus, type_minus, total_ht_minus, prix_unitaire_minus,quantite_minus, tva_minus
        };
    });

    console.log(results);

    // Affichage des résultats
    const factureMatches = text.match(/Facture N° (\w{10})/);
    const facture = factureMatches ? factureMatches[1] : null;
    const facturation_periode = text.match(/Période de facturation : (\d{2}\/\d{2}\/\d{4}) au (\d{2}\/\d{2}\/\d{4})/);

    return results;
}



function extractDetailsMinus(line) {
    // Supprimer les espaces en trop et séparer la ligne par les espaces ou |
    const parts_bon_sens = line.trim().split(/[\s|]+/);
    const description_minus = parts_bon_sens.slice(0,parts_bon_sens.length-3).join(' ');
    const parts = parts_bon_sens.reverse();
  
    // Trouver le type (Fixe ou UP)
    const type_minus = parts[2]

    // Trouver le premier nombre 
    const total_ht_minus = parts[0]
  
    // Prendre le deuxième chiffre à gauche s'il existe
    const prix_unitaire_minus = parts[1] || null;

    const quantite_minus = parts[3] || null;
    const tva_minus = parts[4] || null;

  
    return {
        description_minus,
        type_minus, // Rendre le type en minuscule
        total_ht_minus,
        prix_unitaire_minus,
        quantite_minus,
        tva_minus,
    };
}

function extractDetailsPlus(line) {
    // Supprimer les espaces en trop et séparer la ligne par les espaces ou |
    const parts_bon_sens = line.trim().split(/[\s|]+/);
    const description_plus = parts_bon_sens.slice(0,parts_bon_sens.length-4).join(' ');
    const parts = parts_bon_sens.reverse();
  
    // Trouver le type (Fixe ou UP)
    const type_plus = parts[2]

    // Trouver le premier nombre 
    const total_ht_plus = parts[0]
  
    // Prendre le deuxième chiffre à gauche s'il existe
    const prix_unitaire_plus = parts[1] || null;

    const quantite_plus = parts[3] || null;
    //const tva_plus = parts[4] || null;

  
    return {
        description_plus,
        type_plus, // Rendre le type en minuscule
        total_ht_plus,
        prix_unitaire_plus,
        quantite_plus,
    };
}

function extractDetails(line) {
    // Supprimer les espaces en trop et séparer la ligne par les espaces ou |
    const parts = line.trim().split(/[\s|]+/);
  
    // Trouver le type (Fixe ou UP)
    const type = parts.find(part => /Fixe|UP/i.test(part)) || '';
  
    // Récupérer les chiffres en commençant par la fin
    const numbers = parts.filter(part => /^\d+[,\.]?\d*$/.test(part)).reverse(); // Garde que les nombres et inverse
  
    // Trouver le premier nombre 
    const total_ht = numbers[0]
  
    // Prendre le deuxième chiffre à gauche s'il existe
    const prix_unitaire = numbers[1] || null;

    const quantite = numbers[2] || null;
     const tva = numbers[3] || null;
  
    return {
        type: type.toLowerCase(), // Rendre le type en minuscule
        numbers,
        total_ht,
        prix_unitaire,
        quantite,
        tva
    };
}
