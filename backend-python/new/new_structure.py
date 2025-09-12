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
    
    # Extraire les données de base
    dechets = []
    dechet_list = gemini_data.get("dechet")
    if isinstance(dechet_list, list) and len(dechet_list) > 0:
        # Nouveau format: tableau d'objets dechet
        for d in dechet_list:
            if not isinstance(d, dict):
                continue
            dechets.append({
                "date": gemini_data.get("date", ""),
                "nom": d.get("nom_dechet", ""),
                "tonnage": d.get("poids_net", ""),
                "ced": clean_ced_code(d.get("code_ced", "")),
                "d_r": d.get("code_traitement", ""),
                "tour": d.get("nombre_de_tour", ""),
                "num_bon": gemini_data.get("num_bon", "")
            })
    elif isinstance(gemini_data.get("nom_dechet"), list):
        # Ancien format: champs parallèles sous forme de listes
        for i in range(len(gemini_data.get("nom_dechet", []))):
            dechets.append({
                "date": gemini_data.get("date", ""),
                "nom": gemini_data.get("nom_dechet", [""])[i] if i < len(gemini_data.get("nom_dechet", [])) else "",
                "tonnage": gemini_data.get("poids_net", [""])[i] if i < len(gemini_data.get("poids_net", [])) else "",
                "ced": clean_ced_code(gemini_data.get("code_ced", [""])[i] if i < len(gemini_data.get("code_ced", [])) else ""),
                "d_r": gemini_data.get("code_traitement", [""])[i] if i < len(gemini_data.get("code_traitement", [])) else "",
                "tour": gemini_data.get("nombre_de_tour", [""])[i] if i < len(gemini_data.get("nombre_de_tour", [])) else "",
                "num_bon": gemini_data.get("num_bon", "")
            })
    else:
        # Ancien format: valeurs scalaires simples
        dechets.append({
            "date": gemini_data.get("date", ""),
            "nom": gemini_data.get("nom_dechet", ""),
            "tonnage": gemini_data.get("poids_net", ""),
            "ced": clean_ced_code(gemini_data.get("code_ced", "")),
            "d_r": gemini_data.get("code_traitement", ""),
            "tour": gemini_data.get("nombre_de_tour", ""),
            "num_bon": gemini_data.get("num_bon", "")
        })
    
    return {
        "type_doc": "bon",
        "site_raw": gemini_data.get("nom_site", ""),
        "adresse_site": gemini_data.get("adresse_site", ""),
        "presta_raw": gemini_data.get("nom_prestataire", ""),
        "dechet": dechets
    }

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
        "dechet": dechets
    }







