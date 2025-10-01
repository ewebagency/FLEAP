bon = {
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

bsd = {
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

facture = {
        "nom_prestataire": "nom_prestataire",
        "num_facture": "num_facture",

        "collecte" : {
                    "nom_site": "nom_site",
                    "num_bon": "num_bon",
                    "num_bsd": "num_bsd",
                    "date": "date",
                    "nom_dechet": "nom_dechet", 
                    "ced": "ced",
                    "contenant": "contenant",
                    "volume_m3": "volume_m3",
                    "prestations" : [ 
                                        {
                                        "type_presta": "type_presta",
                                        "unite": "unite",
                                        "quantite": "quantite",
                                        "prix_unitaire": "prix_unitaire",
                                        "montant_ht": "montant_ht",
                                        "tva_absolu": "tva_absolu",
                                        }
                                  ],
        },
        "montant_total_ht": "montant_total_ht"
    }

def clean_ced_code(ced_code: str) -> str:
    """
    Nettoie un code CED :
    - Si le code contient exactement 6 chiffres, le formate en 00 00 00
    - Sinon, retourne le code brut nettoyé (sans espaces, points, etc.)
    
    Args:
        ced_code: Code CED brut (peut contenir espaces, points, etc.)
    
    Returns:
        str: Code CED nettoyé
    """
    if not ced_code:
        return ""
    
    # Nettoyer le code : enlever espaces, points, tirets, etc.
    cleaned = ''.join(c for c in str(ced_code) if c.isdigit())
    
    # Si on a exactement 6 chiffres, formater en 00 00 00
    if len(cleaned) == 6:
        return f"{cleaned[0:2]} {cleaned[2:4]} {cleaned[4:6]}"
    
    # Sinon, retourner le code nettoyé
    return cleaned

def structure(type_doc: str, gemini_data: dict) :
    """
    Transforme les données JSON de Gemini en respectant la structure des interfaces TypeScript
    définies dans MetaDataInterface.ts
    
    Args:
        type_doc: "bon", "bsd", ou "facture"
        gemini_data: Données JSON brutes de Gemini
    
    Returns:
        dict: Données structurées selon l'interface TypeScript correspondante
    """
    
    if type_doc == "bon":
        return structure_bon(gemini_data)
    elif type_doc == "bsd":
        return structure_bsd(gemini_data)
    elif type_doc == "facture":
        return structure_facture(gemini_data)
    else:
        raise ValueError(f"Type de document non supporté: {type_doc}")

def structure_bon(gemini_data: dict):
    """Structure les données d'un bon de livraison"""
    
    # Extract common fields once
    date = gemini_data.get("date", "")
    num_bon = gemini_data.get("num_bon", "")
    site_raw = gemini_data.get("nom_site", "")
    adresse_site = gemini_data.get("adresse_site", "")
    presta_raw = gemini_data.get("nom_prestataire", "")
    
    # Build dechets list inline
    dechets = []
    dechet_list = gemini_data.get("dechet")
    
    if isinstance(dechet_list, list) and dechet_list:
        # New format: array of objects
        dechets = [{
            "date": date, "nom": d.get("nom_dechet", ""), "tonnage": d.get("poids_net", ""),
            "ced": clean_ced_code(d.get("code_ced", "")), "d_r": d.get("code_traitement", ""),
            "tour": d.get("nombre_de_tour", ""), "num_bon": num_bon
        } for d in dechet_list if isinstance(d, dict)]
    elif isinstance(gemini_data.get("nom_dechet"), list):
        # Old format: parallel lists
        nom_list = gemini_data.get("nom_dechet", [])
        dechets = [{
            "date": date, "nom": nom_list[i] if i < len(nom_list) else "",
            "tonnage": gemini_data.get("poids_net", [""])[i] if i < len(gemini_data.get("poids_net", [])) else "",
            "ced": clean_ced_code(gemini_data.get("code_ced", [""])[i] if i < len(gemini_data.get("code_ced", [])) else ""),
            "d_r": gemini_data.get("code_traitement", [""])[i] if i < len(gemini_data.get("code_traitement", [])) else "",
            "tour": gemini_data.get("nombre_de_tour", [""])[i] if i < len(gemini_data.get("nombre_de_tour", [])) else "",
            "num_bon": num_bon
        } for i in range(len(nom_list))]
    else:
        # Old format: scalar values
        dechets = [{
            "date": date, "nom": gemini_data.get("nom_dechet", ""), "tonnage": gemini_data.get("poids_net", ""),
            "ced": clean_ced_code(gemini_data.get("code_ced", "")), "d_r": gemini_data.get("code_traitement", ""),
            "tour": gemini_data.get("nombre_de_tour", ""), "num_bon": num_bon
        }]
    
    return {"type_doc": "bon", "site_raw": site_raw, "adresse_site": adresse_site, "presta_raw": presta_raw, "dechet": dechets}

def structure_bsd(gemini_data: dict) :
    """Structure les données d'un BSD"""
    
    # Extraire les données de base
    dechets = []
    if isinstance(gemini_data.get("nom_dechet"), list):
        # Cas où il y a plusieurs déchets
        for i in range(len(gemini_data.get("nom_dechet", []))):
            dechet = {
                "date": gemini_data.get("date", ""),
                "nom": gemini_data.get("nom_dechet", [""])[i] if i < len(gemini_data.get("nom_dechet", [])) else "",
                "tonnage": gemini_data.get("quantite_relle_tonne", [""])[i] if i < len(gemini_data.get("quantite_relle_tonne", [])) else "",
                "ced": clean_ced_code(gemini_data.get("code_ced", [""])[i] if i < len(gemini_data.get("code_ced", [])) else ""),
                "d_r": gemini_data.get("code_traitement", [""])[i] if i < len(gemini_data.get("code_traitement", [])) else "",
                "num_bsd": gemini_data.get("num_bsd", [""])[i] if i < len(gemini_data.get("num_bsd", [])) else "",
                "contenant": gemini_data.get("nom_contenant", [""])[i] if i < len(gemini_data.get("nom_contenant", [])) else "",
                "volume_m3": gemini_data.get("volume_m3", [""])[i] if i < len(gemini_data.get("volume_m3", [])) else ""
            }
            dechets.append(dechet)
    else:
        # Cas où il y a un seul déchet
        dechet = {
            "date": gemini_data.get("date", ""),
            "nom": gemini_data.get("nom_dechet", ""),
            "tonnage": gemini_data.get("quantite_relle_tonne", ""),
            "ced": clean_ced_code(gemini_data.get("code_ced", "")),
            "d_r": gemini_data.get("code_traitement", ""),
            "num_bsd": gemini_data.get("num_bsd", ""),
            "contenant": gemini_data.get("nom_contenant", ""),
            "volume_m3": gemini_data.get("volume_m3", "")
        }
        dechets.append(dechet)
    
    # Gérer les infos transporteur si présentes
    add_presta_raw = None
    if any(key in gemini_data for key in ["recepisse", "departement", "limite_validite", "nom_transporteur", "prenom_transporteur", "plaque_immatriculation"]):
        add_presta_raw = {
            "type": "transporteur",
            "adresse": "",
            "tel": "",
            "mail": "",
            "fax": "",
            "infos_transporteur": {
                "recepisse": gemini_data.get("recepisse", ""),
                "departement": gemini_data.get("departement", ""),
                "limite_validite": gemini_data.get("limite_validite", ""),
                "routier": ""
            }
        }
    
    return {
        "type_doc": "bsd",
        "site_raw": gemini_data.get("nom_site", ""),
        "presta_raw": gemini_data.get("nom_prestataire", ""),
        "add_presta_raw": add_presta_raw,
        "conformite": {
            "CAP": gemini_data.get("num_cap", ""),
            "ADR": gemini_data.get("mention_adr", "")
        },
        "dechet": dechets
    }

def structure_facture(gemini_data: dict) :
    """Structure les données d'une facture"""
    
    # Extraire les données de collecte (peut être une liste ou un dictionnaire)
    collecte_data = gemini_data.get("collecte", [])
    
    def compute_tonnage_from_prestations(prestations: list):
        """
        Si une seule prestation et l'unité indique des tonnes (T, Tonne, To),
        renvoyer la quantité comme tonnage (en chaîne). Sinon, renvoyer "".
        """
        def got_tonnage(presta: dict):
            unite = str(presta.get("unite", "")).strip().lower()
            if unite in {"t", "tonne", "to"}:
                return True
            return False
        
        try:
            somme_tonnage = 0
            prestations_avec_tonnage = 0
            
            for presta in prestations:
                if got_tonnage(presta):
                    qte = presta.get("quantite", 0)
                    try:
                        # Convertir la virgule en point pour le format français
                        qte_str = str(qte).replace(',', '.')
                        qte_float = float(qte_str)
                        somme_tonnage += qte_float
                        prestations_avec_tonnage += 1
                    except (ValueError, TypeError):
                        continue
            
            # Retourner la somme si on a trouvé au moins une prestation avec tonnage
            if prestations_avec_tonnage > 0:
                return str(somme_tonnage)
            else:
                return ""
                
        except Exception:
            return ""

    # Créer les déchets
    dechets = []
    
    # Traiter collecte_data selon son type
    if isinstance(collecte_data, list):
        # Si c'est une liste de collectes
        for collecte in collecte_data:
            # Créer les prestations pour cette collecte
            prestations = []
            if isinstance(collecte.get("prestations"), list):
                for presta in collecte.get("prestations", []):
                    prestation = {
                        "type_operation": presta.get("type_presta", ""),
                        "unite": presta.get("unite", ""),
                        "quantite": presta.get("quantite", 0),
                        "prix_unitaire": presta.get("prix_unitaire", 0),
                        "montant_ht": presta.get("montant_ht", 0),
                        "tva_absolute": presta.get("tva_absolu", 0)
                    }
                    prestations.append(prestation)
            
            # Créer l'objet facture pour cette collecte
            facture_obj = {
                "ligne": prestations,
            }
            
            # Créer le déchet pour cette collecte
            dechet = {
                "date": collecte.get("date", ""),
                "nom": collecte.get("nom_dechet", ""),
                "tonnage": compute_tonnage_from_prestations(prestations),
                "ced": clean_ced_code(collecte.get("ced", "")),
                "d_r": "",
                "num_bon": collecte.get("num_bon", ""),
                "num_bsd": collecte.get("num_bsd", ""),
                "contenant": collecte.get("contenant", ""),
                "volume_m3": collecte.get("volume_m3", ""),
                "declassement": collecte.get("declassement", ""),
                "facture": facture_obj
            }
            dechets.append(dechet)
    
    elif isinstance(collecte_data, dict):
        # Si c'est un dictionnaire unique (ancien format)
        # Créer les prestations
        prestations = []
        if isinstance(collecte_data.get("prestations"), list):
            for presta in collecte_data.get("prestations", []):
                prestation = {
                    "type_operation": presta.get("type_presta", ""),
                    "unite": presta.get("unite", ""),
                    "quantite": presta.get("quantite", 0),
                    "prix_unitaire": presta.get("prix_unitaire", 0),
                    "montant_ht": presta.get("montant_ht", 0),
                    "tva_absolute": presta.get("tva_absolu", 0)
                }
                prestations.append(prestation)
        
        # Créer l'objet facture
        facture_obj = {
            "ligne": prestations,
            "declassement": ""
        }
        
        # Créer le déchet
        dechet = {
            "date": collecte_data.get("date", ""),
            "nom": collecte_data.get("nom_dechet", ""),
            "tonnage": compute_tonnage_from_prestations(prestations),
            "ced": clean_ced_code(collecte_data.get("ced", "")),
            "d_r": "",
            "num_bon": collecte_data.get("num_bon", ""),
            "num_bsd": collecte_data.get("num_bsd", ""),
            "contenant": collecte_data.get("contenant", ""),
            "volume_m3": collecte_data.get("volume_m3", ""),
            "declassement": collecte_data.get("declassement", ""),
            "facture": facture_obj
        }
        dechets.append(dechet)
    
    # Utiliser le premier site comme site_raw (ou une valeur par défaut)
    site_raw = ""
    if dechets:
        if isinstance(collecte_data, list) and collecte_data:
            site_raw = collecte_data[0].get("nom_site", "")
        elif isinstance(collecte_data, dict):
            site_raw = collecte_data.get("nom_site", "")
    
    return {
        "type_doc": "facture",
        "site_raw": site_raw,
        "presta_raw": gemini_data.get("nom_prestataire", ""),
        "num_facture": gemini_data.get("num_facture", ""),
        "montant_total_ht": gemini_data.get("montant_total_ht", ""),
        "dechet": dechets
    }


# =============================================
# FONCTIONS DE TRANSFORMATION INVERSE (structured_data -> gemini_data)
# =============================================

def reverse_structure_bon(structured_data: dict) -> dict:
    """Reconstruit gemini_data à partir de structured_data pour un bon de livraison"""
    
    if not structured_data or structured_data.get("type_doc") != "bon":
        return {}
    
    dechets = structured_data.get("dechet", [])
    if not dechets:
        return {}
    
    # Prendre le premier déchet pour les champs communs
    first_dechet = dechets[0]
    
    # Reconstruire gemini_data
    gemini_data = {
        "date": first_dechet.get("date", ""),
        "num_bon": first_dechet.get("num_bon", ""),
        "nom_prestataire": structured_data.get("presta_raw", ""),
        "nom_site": structured_data.get("site_raw", ""),
        "adresse_site": structured_data.get("adresse_site", ""),
    }
    
    # Gérer les déchets (peut être un seul ou plusieurs)
    if len(dechets) == 1:
        # Format simple (un seul déchet)
        dechet = dechets[0]
        gemini_data.update({
            "nom_dechet": dechet.get("nom", ""),
            "poids_net": dechet.get("tonnage", ""),
            "code_ced": dechet.get("ced", ""),
            "code_traitement": dechet.get("d_r", ""),
            "nombre_de_tour": dechet.get("tour", "")
        })
    else:
        # Format liste (plusieurs déchets)
        gemini_data.update({
            "nom_dechet": [d.get("nom", "") for d in dechets],
            "poids_net": [d.get("tonnage", "") for d in dechets],
            "code_ced": [d.get("ced", "") for d in dechets],
            "code_traitement": [d.get("d_r", "") for d in dechets],
            "nombre_de_tour": [d.get("tour", "") for d in dechets]
        })
    
    return gemini_data


def reverse_structure_bsd(structured_data: dict) -> dict:
    """Reconstruit gemini_data à partir de structured_data pour un BSD"""
    
    if not structured_data or structured_data.get("type_doc") != "bsd":
        return {}
    
    dechets = structured_data.get("dechet", [])
    if not dechets:
        return {}
    
    # Prendre le premier déchet pour les champs communs
    first_dechet = dechets[0]
    
    # Reconstruire gemini_data
    gemini_data = {
        "date": first_dechet.get("date", ""),
        "nom_prestataire": structured_data.get("presta_raw", ""),
        "nom_site": structured_data.get("site_raw", ""),
    }
    
    # Ajouter les champs de conformité
    conformite = structured_data.get("conformite", {})
    if conformite:
        gemini_data.update({
            "num_cap": conformite.get("CAP", ""),
            "mention_adr": conformite.get("ADR", "")
        })
    
    # Gérer les infos transporteur
    add_presta_raw = structured_data.get("add_presta_raw")
    if add_presta_raw and add_presta_raw.get("type") == "transporteur":
        infos_transporteur = add_presta_raw.get("infos_transporteur", {})
        if infos_transporteur:
            gemini_data.update({
                "recepisse": infos_transporteur.get("recepisse", ""),
                "departement": infos_transporteur.get("departement", ""),
                "limite_validite": infos_transporteur.get("limite_validite", ""),
                "routier": infos_transporteur.get("routier", "")
            })
    
    # Gérer les déchets (peut être un seul ou plusieurs)
    if len(dechets) == 1:
        # Format simple (un seul déchet)
        dechet = dechets[0]
        gemini_data.update({
            "nom_dechet": dechet.get("nom", ""),
            "quantite_relle_tonne": dechet.get("tonnage", ""),
            "code_ced": dechet.get("ced", ""),
            "code_traitement": dechet.get("d_r", ""),
            "num_bsd": dechet.get("num_bsd", ""),
            "nom_contenant": dechet.get("contenant", ""),
            "volume_m3": dechet.get("volume_m3", "")
        })
    else:
        # Format liste (plusieurs déchets)
        gemini_data.update({
            "nom_dechet": [d.get("nom", "") for d in dechets],
            "quantite_relle_tonne": [d.get("tonnage", "") for d in dechets],
            "code_ced": [d.get("ced", "") for d in dechets],
            "code_traitement": [d.get("d_r", "") for d in dechets],
            "num_bsd": [d.get("num_bsd", "") for d in dechets],
            "nom_contenant": [d.get("contenant", "") for d in dechets],
            "volume_m3": [d.get("volume_m3", "") for d in dechets]
        })
    
    return gemini_data


def reverse_structure_facture(structured_data: dict) -> dict:
    """Reconstruit gemini_data à partir de structured_data pour une facture"""
    
    if not structured_data or structured_data.get("type_doc") != "facture":
        return {}
    
    dechets = structured_data.get("dechet", [])
    if not dechets:
        return {}
    
    # Reconstruire gemini_data
    gemini_data = {
        "nom_prestataire": structured_data.get("presta_raw", ""),
        "num_facture": structured_data.get("num_facture", ""),
        "montant_total_ht": structured_data.get("montant_total_ht", "")
    }
    
    # Reconstruire les collectes
    collectes = []
    for dechet in dechets:
        collecte = {
            "nom_site": structured_data.get("site_raw", ""),
            "num_bon": dechet.get("num_bon", ""),
            "num_bsd": dechet.get("num_bsd", ""),
            "date": dechet.get("date", ""),
            "nom_dechet": dechet.get("nom", ""),
            "ced": dechet.get("ced", ""),
            "contenant": dechet.get("contenant", ""),
            "volume_m3": dechet.get("volume_m3", ""),
            "declassement": dechet.get("declassement", "")
        }
        
        # Reconstruire les prestations
        facture = dechet.get("facture", {})
        lignes = facture.get("ligne", [])
        prestations = []
        
        for ligne in lignes:
            prestation = {
                "type_presta": ligne.get("type_operation", ""),
                "unite": ligne.get("unite", ""),
                "quantite": ligne.get("quantite", 0),
                "prix_unitaire": ligne.get("prix_unitaire", 0),
                "montant_ht": ligne.get("montant_ht", 0),
                "tva_absolu": ligne.get("tva_absolute", 0)
            }
            prestations.append(prestation)
        
        collecte["prestations"] = prestations
        collectes.append(collecte)
    
    # Si une seule collecte, utiliser le format simple
    if len(collectes) == 1:
        gemini_data.update(collectes[0])
    else:
        gemini_data["collecte"] = collectes
    
    return gemini_data


def reverse_structure(type_doc: str, structured_data: dict) -> dict:
    """
    Reconstruit gemini_data à partir de structured_data selon le type de document
    
    Args:
        type_doc: "bon", "bsd", ou "facture"
        structured_data: Données structurées (format TypeScript)
    
    Returns:
        dict: Données au format gemini_data
    """
    
    if type_doc == "bon":
        return reverse_structure_bon(structured_data)
    elif type_doc == "bsd":
        return reverse_structure_bsd(structured_data)
    elif type_doc == "facture":
        return reverse_structure_facture(structured_data)
    else:
        raise ValueError(f"Type de document non supporté: {type_doc}")







