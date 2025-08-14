prompt_bon = """

    Tu es un expert en bon de pesée de déchets. Tu es en charge d'extraire les informations du bon de pesée de déchets.
    Détecte :
    La date, le nom du déchet, le poids net du déchets, le code ced si possible.
    Le numéro de bon.
    Le nom et siret du prestataire qui reçoit le déchet.
    Le nom du site et l'adresse d'où provient le déchet.

    Utilise tous les stratèges de détection possible.
    N'invente pas d'informations.
    Renvoie ce format :

    {
        "date": "date",
        "nom_dechet": "nom_dechet",
        "poids_net": "poids_net",
        "code_ced": "code_ced",
        "num_bon": "num_bon",
        "nom_prestataire": "nom_prestataire",
        "siret_prestataire": "siret_prestataire",
        "nom_site": "nom_site",
        "adresse_site": "adresse_site",
    }


    Voici le texte brut du document PDF qui a été parsé par OCR:
"""



prompt_bsd = """
Extract information from this BSD (Bordereau de Suivi de Déchets) text and format it according to this TypeScript interface. Only include fields that you can confidently extract from the text. Return the result as a valid JSON object without any markdown formatting or backticks. For dates, use the format DD/MM/YYYY:

interface BSDCerfa {{
    numeroBordereau: string;
    emetteur: {{
        statut: 'producteur' | 'collecteur' | 'transformateur' | 'autre';
        siret: string;
        nom: string;
        adresse: string;
        tel?: string;
        fax?: string;
        email?: string;
        contact?: string;
    }};
    installationDestination: {{
        entreposageProvisoire: boolean;
        siret: string;
        nom: string;
        adresse: string;
        tel?: string;
        email?: string;
        contact?: string;
        numeroCAP?: string;
        codeOperation: string;
    }};
    dechet: {{
        code: string;
        consistence: 'solide' | 'liquide' | 'gazeux';
        denominationUsuelle: string;
        categorie: 'solide' | 'liquide' | 'gazeux';
        etiquetageADR: string;
        conditionnement: string;
        nombreColis: number;
        poids: number;
        volume: number;
        volumeUnite: string;
        reel: boolean;
    }};
    negociant?: {{
        siren: string;
        nom: string;
        adresse: string;
        contact?: string;
        tel?: string;
        email?: string;
        fax?: string;
        numeroRecepisse?: string;
        departement?: string;
        dateValiditeRecepisse?: string;
    }};
    collecteurTransporteur: {{
        siren: string;
        nom: string;
        adresse: string;
        tel?: string;
        fax?: string;
        email?: string;
        contact?: string;
        numeroRecepisse?: string;
        departement?: string;
        dateValiditeRecepisse?: string;
        modeTransport: 'route' | 'multimodal';
        datePriseEnCharge?: string;
        signature?: string;
    }};
    expedition: {{
        dateEnvoi: string;
        heure: string;
        signature: string;
    }};
    realisationOperation: {{
        code: string;
        description: string;
        nom: string;
        date: string;
        signature: string;
    }};
    declarationEmetteur: {{
        nom: string;
        date: string;
        signature: string;
    }};
}}

Text to analyze:

"""