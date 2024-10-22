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
    //const tva_plus = parts[4] || null;

  
    return {
        description_minus,
        type_minus, // Rendre le type en minuscule
        total_ht_minus,
        prix_unitaire_minus,
        quantite_minus,
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
    const tva_plus = parts[4] || null;

  
    return {
        description_plus,
        type_plus, // Rendre le type en minuscule
        total_ht_plus,
        prix_unitaire_plus,
        quantite_plus,
        tva_plus
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



const TestOcr = () => {
    const text = `
        & suee Facture N° D035134220 EPar Pages[NEWLINE]Période de facturation : 01/01/2023 au 31/01/2023[NEWLINE]SITA OISE[NEWLINE]AGENCE ENTREPRISES OISE[NEWLINE]200 Rue des Ormelts[NEWLINE]60126 LONGUEIL STE MARIE OLEON[NEWLINE]Téléphone: “0965321010 AUATTENTION DE MM[NEWLINE]Mai: contact sommepasdecalsi.rv@suez.com j[NEWLINE]Adresse de votre siège: RUE DES RIVES DE L'OISE RUE DES RIVES DE L'OISE[NEWLINE]60280 VENETTE BP 20609[NEWLINE]60280 VENETTE[NEWLINE][Da | raie NPTVA Intracommunautaire Mode de règlement [Eeréance —][NEWLINE]31012023 | _6848-271484 jp... M Enèque | 01/04/2023[NEWLINE]Résumé des prestations effectuées. 7 TS 1 A ET[NEWLINE]Attestations de valorisation 7 flux : les attestations seront mises à[NEWLINE]clspostion courant mars 2023 à nos client concernés[NEWLINE]Contacts[NEWLINE]Récupérer un document : Rendez-vous sur[NEWLINE]htos:/espace-entrepises-rvsuez 17[NEWLINE]Transmettre un avis de virement : encaissements.lyon.rv@suez.com[NEWLINE]Transmettre votre facture de rachat matière:[NEWLINE]facturetournisseur nv fr@svez com[NEWLINE]ACTIROB[NEWLINE]NVENETTE 60280[NEWLINE]Dossier N° D037009848[NEWLINE]ACTIROB COLLECTE PELICAN 3M3 DIB[NEWLINE]Matière : Déchets non recyclables en mélange (CED 200301.)[NEWLINE]- Collecte & Transfert Conteneur pélican3 20% 4,00 | UP 63,94 255,76[NEWLINE]m3 20%,[NEWLINE]PTOAP POlEDIESSIM3-G.1SO8NOX8Valo-E-N 4,00 | Fixe 260 1440[NEWLINE]ATELIER DIOL[NEWLINE]NVENETTE 60280[NEWLINE]Dossier N° D037009851[NEWLINE]ATELIER DIOL - 1 BAC 770L DIB[NEWLINE]- Passage véhicule 20% 20% 500 | UP 1330 69,00[NEWLINE] [PAGE_BREAK] & suee Facture N° D035134220 EPar Pagez6[NEWLINE]Période de facturation : 01/01/2023 au 31/01/2023[NEWLINE]SITA OISE[NEWLINE]AGENCE ENTREPRISES OISE[NEWLINE]200 Rue des Ormelts[NEWLINE]60126 LONGUEIL STE MARIE OLEON[NEWLINE]Téléphone: “0965321010 AUATTENTION DE MM[NEWLINE]Mai: contact sommepasdecalsi.rv@suez.com j[NEWLINE]Adresse de votre siège: RUE DES RIVES DE L'OISE RUE DES RIVES DE L'OISE[NEWLINE]60280 VENETTE BP 20609[NEWLINE]60280 VENETTE[NEWLINE][Da | raie NPTVA Intracommunautaire Mode de règlement [Eeréance —][NEWLINE]31012023 | _6848-271484 jp... M Enèque | 01/04/2023[NEWLINE]Résumé des prestations effectuées. 7 TS 1 A ET[NEWLINE]MONTANT DU REPORT 339,16[NEWLINE]Matière : Déchets non recyclables en mélange (CED 200301.)[NEWLINE]- Collecte & Transfert Bac roulant 770 L 20% 500 | uP 1691 2455[NEWLINE]20%[NEWLINE]“- TGAP Bac 770 L -150 Nox Energ. -E-N 5,00 | Fice 082 460[NEWLINE]CANTINE[NEWLINE]NVENETTE 60280[NEWLINE]Dossier N° D037009850[NEWLINE]CANTINE -3 BACS 1000. DIB[NEWLINE]Matière : Déchets non recyclables en mélange (CED 200301.)[NEWLINE]- Colecte & Transfert Bac rouant 1000 L 20% 1400 | UP 1921 268,94[NEWLINE]20%[NEWLINE]“- TGAP Bac 1000 L - SO Nox Energ. E-N 1400 | Fe 120 1650[NEWLINE]CHARGEMENT PS[NEWLINE]NVENETTE 60280[NEWLINE]Dossier N° D037009855[NEWLINE]CHARGEMENT PS -2 BACS 770L DIB[NEWLINE]Matière : Déchets non recyclables en mélange (CED 200199.)[NEWLINE]- Colecte & Transfert Bac roulant 770 L 20% 400 | UP 1691 8764[NEWLINE]20%[NEWLINE]“- TGAP Bac 770 L -150 Nox Energ. -E-N 4,00 | Fixe 082 208[NEWLINE] [PAGE_BREAK] & suee Facture N° D035134220 EPar Pagese[NEWLINE]Période de facturation : 01/01/2023 au 31/01/2023[NEWLINE]SITA OISE[NEWLINE]AGENCE ENTREPRISES OISE[NEWLINE]200 Rue des Ormelts[NEWLINE]60126 LONGUEIL STE MARIE OLEON[NEWLINE]Téléphone: “0965321010 AUATTENTION DE MM[NEWLINE]Mai: contact sommepasdecalsi.rv@suez.com j[NEWLINE]Adresse de votre siège: RUE DES RIVES DE L'OISE RUE DES RIVES DE L'OISE[NEWLINE]60280 VENETTE BP 20609[NEWLINE]60280 VENETTE[NEWLINE][Da | raie NPTVA Intracommunautaire Mode de règlement [Eeréance —][NEWLINE]31012023 | _6848-271484 jp... M Enèque | 01/04/2023[NEWLINE]Résumé des prestations effectuées. 7 TS 1 A ET[NEWLINE]MONTANT DU REPORT 7537[NEWLINE]COUR CENTRAL[NEWLINE]NVENETTE 60280[NEWLINE]Dossier N° D037009856[NEWLINE]COUR CENTRAL - 1 BAC 1000L DIB[NEWLINE]Matière : Déchets non recyclables en mélange (CED 200301.)[NEWLINE]- Colecte & Transfert Bac rouant 1000 L 20% 200 | UP 1921 2842[NEWLINE]20%[NEWLINE]“- TGAP Bac 1000 L - SO Nox Energ. E-N 2,00 | Fixe 120 240[NEWLINE]LABO CONTROLE[NEWLINE]NVENETTE 60280[NEWLINE]Dossier N° D037009854[NEWLINE]LABO CONTROLE - 1 BAC 770L DIB[NEWLINE]Matière : Déchets non recyclables en mélange (CED 200301.)[NEWLINE]- Colecte & Transfert Bac routant 770 L 20% 5,00 | uP 1691 2455[NEWLINE]20%[NEWLINE]“- TGAP Bac 770 L -150 Nox Energ. -E-N 5,00 | Fice 082 460[NEWLINE]LABO R&D[NEWLINE]NVENETTE 60280[NEWLINE] [PAGE_BREAK] & suee Facture N° D035134220 EPar Page4e[NEWLINE]Période de facturation : 01/01/2023 au 31/01/2023[NEWLINE]SITA OISE[NEWLINE]AGENCE ENTREPRISES OISE[NEWLINE]200 Rue des Ormelts[NEWLINE]60126 LONGUEIL STE MARIE OLEON[NEWLINE]Téléphone: “0965321010 AUATTENTION DE MM[NEWLINE]Mai: contact sommepasdecalsi.rv@suez.com j[NEWLINE]Adresse de votre siège: RUE DES RIVES DE L'OISE RUE DES RIVES DE L'OISE[NEWLINE]60280 VENETTE BP 20609[NEWLINE]60280 VENETTE[NEWLINE][Da | raie NPTVA Intracommunautaire Mode de règlement [Eeréance —][NEWLINE]31012023 | _6848-271484 jp... M Enèque | 01/04/2023[NEWLINE]Résumé des prestations effectuées. 7 TS 1 A ET[NEWLINE]MONTANT DU REPORT 015,34[NEWLINE]Dossier N° D037009849[NEWLINE]LABO R&D PELICAN 3M3 DIE[NEWLINE]Matière : Déchets non recyclables en mélange (CED 200301.)[NEWLINE]- Colecte & Transert Conteneur pélicans 20% 500 | uP Cr 31970[NEWLINE]m3 20%,[NEWLINE]PTOAP POlEDIESSIM3-G.1SO8NOX8Valo-E-N 5,00 | Fice 260 18,00[NEWLINE]MAGASIN[NEWLINE]NVENETTE 60280[NEWLINE]Dossier N° D037009852[NEWLINE]MAGASIN - 1 BAC 770L DIB[NEWLINE]Matière : Déchets non recyclables en mélange (CED 200301.)[NEWLINE]- Colecte & Transfert Bac routant 770 L 20% 5,00 | uP 1691 2455[NEWLINE]20%[NEWLINE]“- TGAP Bac 770 L -150 Nox Energ. -E-N 5,00 | Fice 082 460[NEWLINE]MOUVEMENT BIS[NEWLINE]NVENETTE 60280[NEWLINE]Dossier N° D037009858[NEWLINE]MOUVEMENT 1 BIS - 1 BAC 770L DIB[NEWLINE]Matière : Déchets non recyclables en mélange (CED 200301.)[NEWLINE] [PAGE_BREAK] & suee Facture N° D035134220 EPar Pages6[NEWLINE]Période de facturation : 01/01/2023 au 31/01/2023[NEWLINE]SITA OISE[NEWLINE]AGENCE ENTREPRISES OISE[NEWLINE]200 Rue des Ormelts[NEWLINE]60126 LONGUEIL STE MARIE OLEON[NEWLINE]Téléphone: “0965321010 AUATTENTION DE MM[NEWLINE]Mai: contact sommepasdecalsi.rv@suez.com j[NEWLINE]Adresse de votre siège: RUE DES RIVES DE L'OISE RUE DES RIVES DE L'OISE[NEWLINE]60280 VENETTE BP 20609[NEWLINE]60280 VENETTE[NEWLINE][Da | raie NPTVA Intracommunautaire Mode de règlement [Eeréance —][NEWLINE]31012023 | _6848-271484 jp... M Enèque | 01/04/2023[NEWLINE]Résumé des prestations effectuées. 7 TS 1 A ET[NEWLINE]MONTANT DU REPORT 13421[NEWLINE]- Colecte & Transfert Bac roulant 770 L 20% 200 | UP 1691 382[NEWLINE]20%[NEWLINE]* TGAP Bac 770 L -150 Nox Energ. E-N 2,00 | Fixe 082 104[NEWLINE]MOUVEMENTS[NEWLINE]NVENETTE 60280[NEWLINE]Dossier N° D037009857[NEWLINE]MOUVEMENTS 1 - 1 BAC 1000L DIB[NEWLINE]Matière : Déchets non recyclables en mélange (CED 200199.)[NEWLINE]- Colecte & Transfert Bac rouant 1000 L 20% 400 | UP 1921 7684[NEWLINE]20%[NEWLINE]“- TGAP Bac 1000 L - SO Nox Energ. E-N 4,00 | Fixe 120 480[NEWLINE]PS (couloir)[NEWLINE]NVENETTE 60280[NEWLINE]Dossier N° D037009853[NEWLINE]PS (couloir) - 1 BAC 1000L DIB[NEWLINE]Matière : Déchets non recyclables en mélange (CED 200199.)[NEWLINE]- Colecte & Transfert Bac roulant 1000 L 20% 500 | uP 1921 95,05[NEWLINE]20%[NEWLINE]* TGAP Bac 1000 L - SO Nox Energ. E-N 5,00 | Fice 120 600[NEWLINE]VESTIAIRE[NEWLINE] [PAGE_BREAK] & suee Facture N° D035134220 EPar Pages6[NEWLINE]Période de facturation : 01/01/2023 au 31/01/2023[NEWLINE]SITA OISE[NEWLINE]AGENCE ENTREPRISES OISE[NEWLINE]200 Rue des Ormelels[NEWLINE]60126 LONGUEIL STE MARIE OLEON[NEWLINE]Téléphone: “0965321010 AUATTENTION DE MM[NEWLINE]Mai: contact sommepasdecalsi.rv@suez.com ![NEWLINE]Adresse de votre siège: RUE DES RIVES DE L'OISE RUE DES RIVES DE LISE[NEWLINE]60280 VENETTE BP 20609[NEWLINE]60280 VENETTE[NEWLINE][Be | Wien NE TVA Intacommunautaire Mode de réglement [Echéance —_][NEWLINE]31012023 | _6848-271484 jp... |'Enèque || 0104/2023[NEWLINE]Résumé des prestations effectuées. 7 TS 1 A ET[NEWLINE]MONTANT DU REPORT 156154[NEWLINE]NENETTE 60280[NEWLINE]Dossier N° D037009859[NEWLINE]VESTIAIRE PS DIOL - 1 BAC 770L DIB[NEWLINE]Matière : Déchets non recyclables en mélange (CED 200301.)[NEWLINE]- Colecte & Transfert Bac roulant 770 L 20% 500 | UP 1691 8455[NEWLINE]20%[NEWLINE]“- TGAP Bac 770 L -150 Nox Energ. -E-N 5,00 | Fice 032 460[NEWLINE]Dossier N° D037009878[NEWLINE]VESTIAIRE MOUVEMENT - 1 BAC 770L DIB,[NEWLINE]Matière : Déchets non recyclables en mélange (CED 200301.)[NEWLINE]- Colecte & Transtert Bac roulant 770 L 20% 5,00 | uP 1691 4,55[NEWLINE]20%[NEWLINE]“- TGAP Bac 770 L -150 Nox Energ. -E-N 5,00 | Fice 032 460[NEWLINE]Votre contact facturation[NEWLINE]onactsommepasdecaias ni@svez com[NEWLINE]TotalHT 172984[NEWLINE]MomantTre Be Ge[NEWLINE]172984 | 20% 247,97 200721[NEWLINE]Montant dû TTC[NEWLINE]2.087,81[NEWLINE]Totalht | | Totai Tva Net à payer TTC - EUR[NEWLINE]173984 [| 347,87 2.087,81 Merci d'adresser votre règlement[NEWLINE]accompagné du coupon étaha)e[NEWLINE]+ à l'adresse suivante[NEWLINE]Emo ares EPP[NEWLINE]nie 1004 Once guet 00122 ac avparner SITA OISE[NEWLINE]ee Pres 20eoiteaes TSA 20057[NEWLINE]RASE A1ST6 BLOIS CEDEX 9[NEWLINE]A encaissement N°pièce: D035134220[NEWLINE]ne po pme TE Se se apps N° Gient: 6848-271434[NEWLINE]és 13e ous dr égrtontarare m Échéance : 01/04/2023[NEWLINE]TE Corn is ane sis Montant TTC: 208781 | EUR[NEWLINE]SE EEE 0 de Or Pot SET LONGUE STE RE ie fr re poeme RE pe[NEWLINE]FETES TS QUE ZT EE EE race es[NEWLINE]DAS D capte S0 0 rs RC oECoT4 APE 112 EE te pat[NEWLINE] [PAGE_BREAK]`;

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
        const {description_minus, type_minus, total_ht_minus, prix_unitaire_minus,quantite_minus} = extractDetailsMinus(minusLine);

        const plusLineMatch = dossierText.match(/Matière\s*:\s*.*?\[NEWLINE\].*?\[NEWLINE\](.*?)\[NEWLINE\]/);
        let plusLine = plusLineMatch ? plusLineMatch[1].trim() : null;
        // ----> Vérification pour le nombre de chiffres consécutifs
        if (plusLine && (plusLine.match(/(\d{2})/g) || []).length < 3) {
            // Si moins de 3 groupes de 2 chiffres, prendre la ligne suivante
            const nextLineMatch = dossierText.match(/Matière\s*:\s*.*?\[NEWLINE\].*?\[NEWLINE\].*?\[NEWLINE\](.*?)\[NEWLINE\]/);
            plusLine = nextLineMatch ? nextLineMatch[1].trim() : plusLine; // garde la plusLine actuelle si pas de ligne suivante
        }
        const {description_plus, type_plus, total_ht_plus, prix_unitaire_plus, quantite_plus, tva_plus} = extractDetailsPlus(plusLine);

        return {
            dossierNumber,
            uppercaseLine,
            matterLine,
            cedNumber,
            plusLine,
                description_plus, type_plus, total_ht_plus, prix_unitaire_plus, quantite_plus, tva_plus,
            minusLine,
                description_minus, type_minus, total_ht_minus, prix_unitaire_minus,quantite_minus
        };
    });

    // Affichage des résultats
    const factureMatches = text.match(/Facture N° (\w{10})/);
    const facture = factureMatches ? factureMatches[1] : null;
    const facturation_periode = text.match(/Période de facturation : (\d{2}\/\d{2}\/\d{4}) au (\d{2}\/\d{2}\/\d{4})/);

    return (
        <div>
            <div>Facture : {facture}</div>
            <div>Période de facturation : {facturation_periode ? `${facturation_periode[1]} au ${facturation_periode[2]}` : 'Non spécifiée'}</div>

            {/* Affichage de tous les textes extraits */}
            <div className="my-6">
                {results.length > 0 ? (
                    results.map((result, index) => (
                        <div key={index} className="border-1 border-black rounded-lg p-3">
                            <h4>Dossier {index + 1} :</h4>
                            <div>Numéro de dossier : {result.dossierNumber}</div>
                            <div>Ligne en majuscules : {result.uppercaseLine}</div>
                            <div>Ligne Matière : {result.matterLine}</div>
                            <div>CED : {result.cedNumber}</div>
                            <div>Ligne avec + : {result.plusLine}</div>
                            <div className="pl-3 text-xs">description : {result.description_plus}</div>
                            <div className="pl-3 text-xs">tva : {result.tva_plus}</div>
                            <div className="pl-3 text-xs">quantite : {result.quantite_plus}</div>
                            <div className="pl-3 text-xs">type : {result.type_plus}</div>
                            <div className="pl-3 text-xs">prix_unitaire : {result.prix_unitaire_plus}</div>
                            <div className="pl-3 text-xs">total_ht : {result.total_ht_plus}</div>
                            
                            <div>Ligne avec - : {result.minusLine}</div>
                            <div className="pl-3 text-xs">description_minus : {result.description_minus}</div>
                            <div className="pl-3 text-xs">type_minus : {result.type_minus}</div>
                            <div className="pl-3 text-xs">total_ht_minus : {result.total_ht_minus}</div>
                            <div className="pl-3 text-xs">prix_unitaire_minus : {result.prix_unitaire_minus}</div>
                            <div className="pl-3 text-xs">quantite_minus : {result.quantite_minus}</div>
                            <hr />
                        </div>
                    ))
                ) : (
                    <p>Aucun texte de dossier trouvé.</p>
                )}
            </div>
        </div>
    );
};

export default TestOcr;
