
#prompt, json_interface = get_prompt(type, parse_or_ocr, liste_nom_a_eviter=["adresse", "nom", "siret" "emetteur"])

#(Si tu l'as tu peux aussi mettre son adresse, téléphone,  mail et son type (transporteur, destinataire, courtier, négotiant))
prompt_bon = """
    Tu es un expert en bon de livraison de déchets. Tu es en charge d'extraire les informations de ce bon.
    Détecte :
        La date
        Le numéro de bon (si il y a 'ticket' c'est en le numero en dessous, ou Pesée n°:...)
        Le nom du prestataire qui collecte le déchet (celui qui a édité le bon, souvent en haut à gauche)
        Le nom du site (Origine parfois). (L'adresse du site si tu le trouves)
        Puis pour chaque déchet identifie :
            le nom du déchet, le poids net du déchets (en tonne, fait la conversion si besoin)
            Si possible : le code ced, le code de traitement (D1, R5..), le nombre de tour

    Utilise tous les stratèges de détection possible.
    N'invente pas d'informations, laisse "" si tu ne sais pas.
    Renvoie ce format json :

    {
        "date": "date",
        "num_bon": "num_bon",
        "nom_prestataire": "nom_prestataire",
        "nom_site": "nom_site",
        "adresse_site": "adresse_site",
        "dechet": [
            {
                "nom_dechet": "nom_dechet",
                "poids_net": "poids_net",
                "code_ced": "code_ced",
                "code_traitement": "code_traitement",
                "nombre_de_tour":"nombre_de_tour",
            }
        ]
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
            Puis pour chaque ligne comptable liée à ce déchet identifie :
                Le type de prestation (libellé du déchet, rotation, transport, traitement...), l'unité (T:tonnes U:unité, L:Litre...), la quantité (tonnage, nombre de tour..), le prix unitaire (P.U), le montant total HT, et la tva en €
                Prend l'information même si le montant HT est 0
        
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


def get_specific_prompt(doc_type, liste_nom_a_eviter, parse_or_ocr):
    # Importer V2 depuis main pour avoir une seule source de vérité
    try:
        from main import V2
    except ImportError:
        # Fallback si main n'est pas disponible (ex: tests)
        V2 = False
    
    # Sélectionner le dictionnaire de prompts selon la version
    if V2:
        selected_prompts = new_prompts
    else:
        selected_prompts = prompts
    
    specific_main_prompt = selected_prompts[doc_type]
    specific_main_prompt += prompt_ne_pas_mettre(liste_nom_a_eviter)
    specific_main_prompt += prompt_parse_ocr(parse_or_ocr)

    return specific_main_prompt#, json_interface


# ===== NOUVEAUX PROMPTS =====

new_prompt_bon = """
    Tu es un expert en bon de livraison de déchets. Tu es en charge d'extraire les informations de ce bon.
    Détecte :
        La date -> au format YYYY-MM-DD
        Le numéro de bon (si il y a 'ticket' c'est en le numero en dessous, ou Pesée n°:...)
        Le nom du prestataire qui a édité le bon (celui qui collecte le déchet, souvent en haut à gauche)
        Le nom du site (Origine, chantier, localisation - attention à ne pas confondre avec le nom du client). (L'adresse du site si tu le trouves)
        Le type de bon (livraison, transport, pesée... extrait le type tel qu'il apparaît sur le document)
        L'immatriculation du véhicule (si disponible)
        Le récépissé du transporteur (si disponible)
        
        **IMPORTANT - Prestataire 2** : S'il y a un 2ème prestataire professionnel (transporteur ou destinataire) :
            - Mets son nom et son rôle ('transporteur' ou 'destinataire')
            - NE CONFONDS PAS avec le producteur du déchet (CLIENT, émetteur, site d'origine) qui n'est PAS un prestataire
            - En cas de doute, laisse vide plutôt que de te tromper
        
        Puis pour chaque déchet identifie :
            le nom du déchet, le poids net du déchets (en tonne, fait la conversion si besoin)
            le nom du contenant, le volume en m3 (converti en m3 si besoin), le nombre de colis
            Si possible : le code ced, le code de traitement (D1, R5..), le nombre de tour
            Le flag REP (true si tu trouves les mentions REP, PMCB ou Valobat sur le bon, false sinon)


    Utilise tous les stratèges de détection possible.
    N'invente pas d'informations, laisse "" si tu ne sais pas.
    Renvoie ce format json :

    {
        "date": "date",
        "num_bon": "num_bon",
        "presta_raw": "presta_raw",
        "nom_prestataire_2": "nom_prestataire_2",
        "role_prestataire_2": "role_prestataire_2",
        "site_raw": "site_raw",
        "adresse_site": "adresse_site",
        "type_bon": "type_bon",
        "immatriculation": "immatriculation",
        "recepisse": "recepisse",
        "dechet": [
            {
                "nom_dechet": "nom_dechet",
                "poids_net": "poids_net",
                "nom_contenant": "nom_contenant",
                "volume_m3": "volume_m3",
                "nombre_colis": "nombre_colis",
                "code_ced": "code_ced",
                "code_traitement": "code_traitement",
                "nombre_de_tour": "nombre_de_tour",
                "flag_rep": "flag_rep"
            }
        ]
    }
"""

new_prompt_bsd = """
    Tu es un expert en bordereau de suivi déchet (BSD). Tu es en charge d'extraire les informations de ce BSD.
    
    Détecte :
        Le numéro du bordereau
        
        **IMPORTANT - Émetteur du déchet (site d'origine)** : Il s'agit du producteur du déchet (Producteur, Collecteur, Transformateur, ou Autre détenteur)
            - Ce n'est PAS un prestataire professionnel, c'est le client/site qui produit le déchet
            - Extrait : son type, son nom, son adresse
        
        Les informations du déchet :
            Le code CED (rubrique), la dénomination usuelle, la consistance (solide, liquide ou gazeux)
            La mention ADR (transport de matières dangereuses)
            Le type de conditionnement/contenant (benne, citerne, etc.), le nombre de colis
            Le volume en m3
            Le flag REP (true si tu trouves les mentions REP, PMCB ou Valobat sur le BSD, false sinon)
        
        Les informations du négociant (si présent) :
            Son SIREN, nom, adresse, numéro de récépissé, département, date de validité
        
        **IMPORTANT - Transporteur (prestataire 2)** :
            Son nom, adresse, numéro de récépissé, département, date de validité
            Le mode de transport (Routier, Maritime, Ferroviaire, etc.)
            Si c'est un transport multimodal (true/false)
        
        **IMPORTANT - Installation de destination (prestataire principal)** :
            Un BSD contient potentiellement 3 sections d'installation :
            (1) Installation prévue (cadre 2)
            (2) Installation ayant reçu l'expédition (cadre 10)
            (3) Installation de destination ultérieure (cadre 12)
            
            → Priorise l'installation de destination ultérieure (3) si elle existe
            → Sinon, prends l'installation de réception (2)
            → Sinon, prends l'installation prévue (1)
            
            Extrait : le nom et adresse de cette installation
        
        Les informations sur l'exutoire (provenant des différentes sections d'installation de destination) :
            Prévue:
                S'il y a entreposage provisoire (true/false)
                Le N° de CAP (uniquement dans installation prévue pour le coup)
            Reçue :
                Si le lot a été accepté (true/false)
                Le motif de refus éventuel
                TRES IMPORTANT : la quantité réelle présentées du déchet en tonne -> dans dechet_quantite
            Ultérieure :
                Le code traitement D/R (ex: D1, R5...)
        
        **IMPORTANT - Date du BSD** :
            Priorise la date de réalisation de l'opération D/R si disponible
            Sinon, prends la date de présentation à l'installation
            Sinon, prends la date de prise en charge par le transporteur
            
        Renvoie toutes les dates au format YYYY-MM-DD

    Utilise tous les stratèges de détection possible.
    N'invente pas d'informations, laisse "" si tu ne sais pas.
    Renvoie ce format json :

    {
        "bordereau_id": "bordereau_id",
        
        "type_emetteur": "type_emetteur",
        "site_raw": "site_raw",
        "adresse_site": "adresse_site",
        
        "dechet_rubrique": "dechet_rubrique",
        "dechet_denomination": "dechet_denomination",
        "dechet_consistance": "dechet_consistance",
        "dechet_mention_reglementaire": "dechet_mention_reglementaire",
        "dechet_conditionnement": "dechet_conditionnement",
        "dechet_nombre_colis": "dechet_nombre_colis",
        "dechet_volume_m3": "dechet_volume_m3",
        "dechet_quantite": "dechet_quantite",
        "dechet_date": "dechet_date",
        "flag_rep": "flag_rep",
        
        "negociant_siren": "negociant_siren",
        "negociant_nom": "negociant_nom",
        "negociant_adresse": "negociant_adresse",
        "negociant_recepisse_numero": "negociant_recepisse_numero",
        "negociant_departement": "negociant_departement",
        "negociant_validite": "negociant_validite",
        
        "nom_prestataire_2": "nom_prestataire_2",
        "adresse_presta_2": "adresse_presta_2",
        "recepisse_presta_2": "recepisse_presta_2",
        "departement_presta_2": "departement_presta_2",
        "validite_presta_2": "validite_presta_2",
        "mode_transport": "mode_transport",
        "multimodal": "multimodal",
        
        "presta_raw": "presta_raw",
        "adresse_presta_raw": "adresse_presta_raw",
        
        "exutoire_entreposage": "exutoire_entreposage",
        "exutoire_CAP": "exutoire_CAP",
        "exutoire_lot_accepte": "exutoire_lot_accepte",
        "exutoire_motif_refus": "exutoire_motif_refus",
        "exutoire_operation_code": "exutoire_operation_code"
    }
"""

new_prompt_facture = """
    Tu es un expert en facture de déchet. Tu es en charge d'extraire les informations de cette facture.
    Fait attention aux colonnes et aux lignes, c'est important pour s'y retrouver.
    Détecte :
        Le nom du prestataire qui collecte le déchet (celui qui a édité la facture, souvent en haut à gauche ou il y a son mail en footer de facture, attention à ne pas confondre avec le client !)
        
        **IMPORTANT - Prestataire 2** : S'il y a un 2ème prestataire professionnel (transporteur ou destinataire) :
            - Mets son nom et son rôle ('transporteur' ou 'destinataire')
            - NE CONFONDS PAS avec le client/site facturé qui n'est PAS un prestataire
            - En cas de doute, laisse vide plutôt que de te tromper
        
        Le numéro de facture
        Le type de facture brut tel qu'écrit sur le document (Facture, Avoir, Rachat...)
        La date de fin de période de facturation
        La date de début de période de facturation (si disponible)
        Le numéro de contrat, le numéro de compte, le numéro client (si disponibles)
        
        Pour chaque collecte de déchet identifie :
            Le nom du site/point de collecte, l'adresse du site (en dessous du nom_site)
            Le numéro du bon (BE, BL, N° Dossier) et/ou le numéro de BSD, la date lié au déchet (si tu as une période et que c'est un contenant met la date de début de période)
            La description (nom) du déchet, son code CED (3 couples de chiffres : ** ** **), le nom du contenant et son volume en m3
            Le nombre de colis
            Le flag REP pour ce déchet (true si tu trouves les mentions REP, PMCB ou Valobat, false sinon)
            
            Puis pour chaque ligne comptable liée à ce déchet identifie :
                Le type de prestation (libellé du déchet, rotation, transport, traitement...), l'unité (T:tonnes U:unité, L:Litre, J:Jour...(si c'est un nombre non entier, c'est surement T, sinon U)), la quantité (tonnage, nombre de tour..), le prix unitaire (P.U), le montant total HT et la tva en pourcentage
                Si c'est un avoir/rachat pour cette ligne (true/false)
                S'il y a un déclassement pour cette ligne (true/false)
                Prend l'information même si le montant HT est 0
        
        A la fin détecte également le montant total HT et TTC en bas de la facture

    Toutes les dates sont au format YYYY-MM-DD
    Les champs chiffres ne doivent pas contenir d'unité (€, EUR), un champ chiffre vide (ou NA) doit etre un 0
    
    Attention parfois la 1ère ligne indique tous les numéros de bon qui vont suivre à la suite (B1, B2, B3, etc.), dans ce cas tu dois les attribuer UN par UN à la ligne correspondante, dans l'ordre.
    Parfois le tonnage de chaque ligne est aggrégée pour le montant ht, dans ce cas tu dois le décomposer en ligne par ligne
    Utilise tous les stratèges de détection possible.
    N'invente pas d'informations, laisse "" si tu ne sais pas.
    Renvoie ce format json :

    {
        "presta_raw": "presta_raw",
        "nom_prestataire_2": "nom_prestataire_2",
        "role_prestataire_2": "role_prestataire_2",
        "num_facture": "num_facture",
        "type_facture": "type_facture",
        "date_fin_periode": "date_fin_periode",
        "date_debut_periode": "date_debut_periode",
        "num_contrat": "num_contrat",
        "num_compte": "num_compte",
        "num_client": "num_client",

        "collecte": [
                    {
                    "site_raw": "site_raw",
                    "adresse_site": "adresse_site",
                    "num_bon": "num_bon",
                    "num_bsd": "num_bsd",
                    "date": "date",
                    "nom_dechet": "nom_dechet", 
                    "ced": "ced",
                    "contenant": "contenant",
                    "volume_m3": "volume_m3",
                    "nombre_colis": "nombre_colis",
                    "flag_rep": "flag_rep",
                    "prestations": [
                                    {
                                    "type_presta": "type_presta",
                                    "unite": "unite",
                                    "quantite": "quantite",
                                    "prix_unitaire": "prix_unitaire",
                                    "montant_ht": "montant_ht",
                                    "tva_pourcentage": "tva_pourcentage",
                                    "avoir": "avoir",
                                    "declassement": "declassement"
                                    }
                                ]
                    }
                ]
        },

        "total_ttc": "total_ttc",
        "montant_total_ht": "montant_total_ht"
    }
"""


# Dictionnaire des nouveaux prompts v2
new_prompts = {
    "bon": new_prompt_bon,
    "bsd": new_prompt_bsd,
    "facture": new_prompt_facture,
}