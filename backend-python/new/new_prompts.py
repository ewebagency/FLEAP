
#prompt, json_interface = get_prompt(type, parse_or_ocr, liste_nom_a_eviter=["adresse", "nom", "siret" "emetteur"])

#(Si tu l'as tu peux aussi mettre son adresse, téléphone,  mail et son type (transporteur, destinataire, courtier, négotiant))
prompt_bon = """
    Tu es un expert en bon de livraison de déchets. Tu es en charge d'extraire les informations de ce bon.
    Détecte :
        La date, le nom du déchet, le poids net du déchets (en tonne, fait la conversion si besoin)
        Si possible : le code ced, le code de traitement (D1, R5..), le nombre de tour
        Le numéro de bon.
        Le nom du prestataire qui collecte le déchet (celui qui a édité le bon, souvent en haut à gauche)
        Le nom du site, le lieu d'origine du déchet.

    Utilise tous les stratèges de détection possible.
    N'invente pas d'informations, laisse "" si tu ne sais pas.
    Renvoie ce format json :

    {
        "date": "date",
        "nom_dechet": "nom_dechet",
        "poids_net": "poids_net",
        "code_ced": "code_ced",
        "code_traitement": "code_traitement",
        "nombre_de_tour":"nombre_de_tour",
        "num_bon": "num_bon",
        "nom_prestataire": "nom_prestataire",
        "nom_site": "nom_site",
    }
"""

#(Si tu l'as tu peux aussi mettre son adresse, téléphone,  mail et son type (transporteur, destinataire, courtier, négotiant))
prompt_bsd = """
    Tu es un expert en bordereau de suivi déchet (BSD). Tu es en charge d'extraire les informations de ce BSD.
    Détecte :
        La date de collecte, le nom du déchet, la quantité réelle présentée du déchet (en tonne, fait la conversion si besoin)
        Le code ced, le code de traitement (=code D/R : D1, R5..), le nom du contenant, son volume (converti en m3 )
        Le numéro de bsd
        Le nom du prestataire qui collecte le déchet.
        Le nom du site, le lieu d'origine du déchet.
        Si disponible : le numéro de CAP et la mention ADR.
        Si les infos du transporteur sont disponibles : le récépissé, le département, la limite de validité, le nom prénom du transporteur, sa plaque d'immatriculation.

    Utilise tous les stratèges de détection possible.
    N'invente pas d'informations, laisse "" si tu ne sais pas.
    Renvoie ce format json :

    {
        "date": "date",
        "nom_dechet": "nom_dechet",
        "quantite_relle_tonne": "quantite_relle_tonne",
        "code_ced": "code_ced",
        "code_traitement": "code_traitement",
        "nom_contenant": "nom_contenant",
        "volume_m3": "volume_m3",
        "num_bsd": "num_bsd",
        "nom_prestataire": "nom_prestataire",
        "nom_site": "nom_site",
        "num_cap":"num_cap",
        "mention_adr":"mention_adr",

        "recepisse": "recepisse",
        "departement": "departement",
        "limite_validite": "limite_validite",
        "nom_transporteur": "nom_transporteur",
        "prenom_transporteur": "prenom_transporteur",
        "plaque_immatriculation": "plaque_immatriculation",
    }
"""

prompt_facture = """
    Tu es un expert en facture de déchet. Tu es en charge d'extraire les informations de cette facture.
    Fait attention aux colonnes et aux lignes, c'est important pour s'y retrouver.
    Détecte :
        Le nom du prestataire qui a édité la facture, le numéro de facture
        Pour chaque collecte de déchet identifie :
            Le nom du site/point de collecte, le numéro du bon (BE, BL) et/ou le numéro de BSD, la date
            Le nom du déchet, son code CED, le nom du contenant et son volume en m3
            S'il y a un déclassement (True/False)
            Puis pour chaque prestation liée à ce déchet identifie :
                Le type de prestation (rotation, transport, traitement...), l'unité (T:tonnes U:unité, L:Litre...), la quantité (tonnage, nombre de tour..), le prix unitaire (P.U), le montant total HT, et la tva en €
        
        A la fin détecte également le montant total HT en bas de la facture

    Utilise tous les stratèges de détection possible.
    N'invente pas d'informations, laisse "" si tu ne sais pas.
    Renvoie ce format json :

    {
        "nom_prestataire": "nom_prestataire",
        "num_facture": "num_facture",

        "collecte": [
                    {
                    "nom_site": "nom_site",
                    "num_bon": "num_bon",
                    "num_bsd": "num_bsd",
                    "date": "date",
                    "nom_dechet": "nom_dechet", 
                    "ced": "ced",
                    "contenant": "contenant",
                    "volume_m3": "volume_m3",
                    "declassement": "declassement",
                    "prestations": [
                                    {
                                    "type_presta": "type_presta",
                                    "unite": "unite",
                                    "quantite": "quantite",
                                    "prix_unitaire": "prix_unitaire",
                                    "montant_ht": "montant_ht",
                                    "tva_absolu": "tva_absolu"
                                    }
                                ]
                    }
                ]
        },
        "montant_total_ht": "montant_total_ht"
    }
"""


def prompt_ne_pas_mettre(liste_nom_a_eviter) :
    avertissement = "\n\nAttention, ces informations sont celles du producteur de déchets, elles ne nous intéressent pas : "
    for nom in liste_nom_a_eviter:
        avertissement += f"{nom}, "
    return avertissement

def prompt_parse_ocr(parse_or_ocr) :
    if parse_or_ocr == "parse" :
        return "\n\nVoici le texte brut du pdf extrait par parsing :"
    elif parse_or_ocr == "ocr" :
        return "\n\nVoici le texte brut du pdf extrait par ocr :"
    elif parse_or_ocr == "mindee" :
        return "\n\nVoici le texte brut du pdf extrait par l'ocr de mindee :"
    else :
        return "\n\nVoici le texte brut du pdf"


prompts = {
    "bon": prompt_bon,
    "bsd": prompt_bsd,
    "facture": prompt_facture,
}


def get_specific_prompt(type, liste_nom_a_eviter, parse_or_ocr):
    specific_main_prompt = prompts[type]
    specific_main_prompt += prompt_ne_pas_mettre(liste_nom_a_eviter)
    specific_main_prompt += prompt_parse_ocr(parse_or_ocr)

    return specific_main_prompt#, json_interface