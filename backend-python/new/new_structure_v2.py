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


def bool_to_string(value) -> str:
    """
    Convertit un booléen en string "true" ou "false"
    Gère aussi les strings et autres types
    
    Args:
        value: La valeur à convertir (bool, str, etc.)
    
    Returns:
        str: "true" ou "false"
    """
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, str):
        # Si c'est déjà une string, normaliser
        if value.lower() in ["true", "1", "yes", "oui"]:
            return "true"
        elif value.lower() in ["false", "0", "no", "non", ""]:
            return "false"
    # Par défaut, retourner "false"
    return "false"


def structure(type_doc: str, gemini_data: dict):
    """
    Transforme les données JSON de Gemini (v2) en respectant la structure des interfaces TypeScript
    
    Args:
        type_doc: "bon", "bsd", ou "facture"
        gemini_data: Données JSON brutes de Gemini (nouveau format)
    
    Returns:
        dict: Données structurées selon l'interface TypeScript correspondante
    """
    
    if type_doc == "bon":
        return structure_bon_v2(gemini_data)
    elif type_doc == "bsd":
        return structure_bsd_v2(gemini_data)
    elif type_doc == "facture":
        return structure_facture_v2(gemini_data)
    else:
        raise ValueError(f"Type de document non supporté: {type_doc}")


def structure_bon_v2(gemini_data: dict):
    """Structure les données d'un bon de livraison (version 2)"""
    
    # Vérifier que gemini_data est bien un dictionnaire
    if not isinstance(gemini_data, dict):
        print(f"❌ ERREUR: gemini_data n'est pas un dict: {type(gemini_data)}")
        print(f"❌ Contenu: {gemini_data}")
        raise ValueError(f"gemini_data doit être un dictionnaire, reçu: {type(gemini_data)}")
    
    # Extract common fields
    date = gemini_data.get("date", "")
    num_bon = gemini_data.get("num_bon", "")
    site_raw = gemini_data.get("site_raw", "")
    adresse_site = gemini_data.get("adresse_site", "")
    presta_raw = gemini_data.get("presta_raw", "")
    
    # Nouveaux champs v2 (racine)
    type_bon = gemini_data.get("type_bon", "")
    immatriculation = gemini_data.get("immatriculation", "")
    recepisse = gemini_data.get("recepisse", "")
    nom_prestataire_2 = gemini_data.get("nom_prestataire_2", "")
    role_prestataire_2 = gemini_data.get("role_prestataire_2", "")
    
    # Build dechets list
    dechets = []
    dechet_list = gemini_data.get("dechet")
    
    if isinstance(dechet_list, list) and dechet_list:
        # New format: array of objects
        dechets = [{
            "date": date,
            "nom": d.get("nom_dechet", ""),
            "tonnage": d.get("poids_net", ""),
            "ced": clean_ced_code(d.get("code_ced", "")),
            "d_r": d.get("code_traitement", ""),
            "tour": d.get("nombre_de_tour", ""),
            "num_bon": num_bon,
            # Nouveaux champs v2 (niveau déchet)
            "nom_contenant": d.get("nom_contenant", ""),
            "volume_m3": d.get("volume_m3", ""),
            "nombre_colis": d.get("nombre_colis", ""),
            "flag_rep": bool_to_string(d.get("flag_rep", ""))
        } for d in dechet_list if isinstance(d, dict)]
    elif isinstance(gemini_data.get("nom_dechet"), list):
        # Old format: parallel lists (rétrocompatibilité)
        nom_list = gemini_data.get("nom_dechet", [])
        dechets = [{
            "date": date,
            "nom": nom_list[i] if i < len(nom_list) else "",
            "tonnage": gemini_data.get("poids_net", [""])[i] if i < len(gemini_data.get("poids_net", [])) else "",
            "ced": clean_ced_code(gemini_data.get("code_ced", [""])[i] if i < len(gemini_data.get("code_ced", [])) else ""),
            "d_r": gemini_data.get("code_traitement", [""])[i] if i < len(gemini_data.get("code_traitement", [])) else "",
            "tour": gemini_data.get("nombre_de_tour", [""])[i] if i < len(gemini_data.get("nombre_de_tour", [])) else "",
            "num_bon": num_bon,
            # Nouveaux champs v2 avec rétrocompatibilité
            "nom_contenant": gemini_data.get("nom_contenant", [""])[i] if isinstance(gemini_data.get("nom_contenant"), list) and i < len(gemini_data.get("nom_contenant", [])) else "",
            "volume_m3": gemini_data.get("volume_m3", [""])[i] if isinstance(gemini_data.get("volume_m3"), list) and i < len(gemini_data.get("volume_m3", [])) else "",
            "nombre_colis": gemini_data.get("nombre_colis", [""])[i] if isinstance(gemini_data.get("nombre_colis"), list) and i < len(gemini_data.get("nombre_colis", [])) else "",
            "flag_rep": bool_to_string(gemini_data.get("flag_rep", [""])[i] if isinstance(gemini_data.get("flag_rep"), list) and i < len(gemini_data.get("flag_rep", [])) else "")
        } for i in range(len(nom_list))]
    else:
        # Old format: scalar values (rétrocompatibilité)
        dechets = [{
            "date": date,
            "nom": gemini_data.get("nom_dechet", ""),
            "tonnage": gemini_data.get("poids_net", ""),
            "ced": clean_ced_code(gemini_data.get("code_ced", "")),
            "d_r": gemini_data.get("code_traitement", ""),
            "tour": gemini_data.get("nombre_de_tour", ""),
            "num_bon": num_bon,
            # Nouveaux champs v2
            "nom_contenant": gemini_data.get("nom_contenant", ""),
            "volume_m3": gemini_data.get("volume_m3", ""),
            "nombre_colis": gemini_data.get("nombre_colis", ""),
            "flag_rep": bool_to_string(gemini_data.get("flag_rep", ""))
        }]
    
    return {
        "type_doc": "bon",
        "site_raw": site_raw,
        "adresse_site": adresse_site,
        "presta_raw": presta_raw,
        # Nouveaux champs v2 (racine)
        "type_bon": type_bon,
        "immatriculation": immatriculation,
        "recepisse": recepisse,
        "nom_prestataire_2": nom_prestataire_2,
        "role_prestataire_2": role_prestataire_2,
        "dechet": dechets
    }


def structure_bsd_v2(gemini_data: dict):
    """Structure les données d'un BSD (version 2 - format aplati)"""
    
    # Vérifier que gemini_data est bien un dictionnaire
    if not isinstance(gemini_data, dict):
        print(f"❌ ERREUR: gemini_data n'est pas un dict: {type(gemini_data)}")
        print(f"❌ Contenu: {gemini_data}")
        raise ValueError(f"gemini_data doit être un dictionnaire, reçu: {type(gemini_data)}")
    
    # Extraire les données de base (format aplati v2)
    bordereau_id = gemini_data.get("bordereau_id", "")
    
    # Données émetteur (= site)
    type_emetteur = gemini_data.get("type_emetteur", "")
    site_raw = gemini_data.get("site_raw", "")
    adresse_site = gemini_data.get("adresse_site", "")
    
    # Données déchet
    dechet_rubrique = gemini_data.get("dechet_rubrique", "")
    dechet_denomination = gemini_data.get("dechet_denomination", "")
    dechet_consistance = gemini_data.get("dechet_consistance", "")
    dechet_mention_reglementaire = gemini_data.get("dechet_mention_reglementaire", "")
    dechet_conditionnement = gemini_data.get("dechet_conditionnement", "")
    dechet_nombre_colis = gemini_data.get("dechet_nombre_colis", "")
    dechet_volume_m3 = gemini_data.get("dechet_volume_m3", "")
    dechet_quantite = gemini_data.get("dechet_quantite", "")
    dechet_date = gemini_data.get("dechet_date", "")  # Date avec priorité faite par LLM
    flag_rep = gemini_data.get("flag_rep", "")
    
    # Données négociant
    negociant_siren = gemini_data.get("negociant_siren", "")
    negociant_nom = gemini_data.get("negociant_nom", "")
    negociant_adresse = gemini_data.get("negociant_adresse", "")
    negociant_recepisse_numero = gemini_data.get("negociant_recepisse_numero", "")
    negociant_departement = gemini_data.get("negociant_departement", "")
    negociant_validite = gemini_data.get("negociant_validite", "")
    
    # Données transporteur (= prestataire 2)
    nom_prestataire_2 = gemini_data.get("nom_prestataire_2", "")
    adresse_presta_2 = gemini_data.get("adresse_presta_2", "")
    recepisse_presta_2 = gemini_data.get("recepisse_presta_2", "")
    departement_presta_2 = gemini_data.get("departement_presta_2", "")
    validite_presta_2 = gemini_data.get("validite_presta_2", "")
    mode_transport = gemini_data.get("mode_transport", "")
    multimodal = gemini_data.get("multimodal", "")
    
    # Installation de destination (= prestataire principal)
    presta_raw = gemini_data.get("presta_raw", "")
    adresse_presta_raw = gemini_data.get("adresse_presta_raw", "")
    
    # Info exutoire
    exutoire_entreposage = gemini_data.get("exutoire_entreposage", "")
    exutoire_CAP = gemini_data.get("exutoire_CAP", "")
    exutoire_lot_accepte = gemini_data.get("exutoire_lot_accepte", "")
    exutoire_motif_refus = gemini_data.get("exutoire_motif_refus", "")
    exutoire_operation_code = gemini_data.get("exutoire_operation_code", "")
    
    # Créer le déchet pour structured_data
    dechet = {
        "date": dechet_date,  # Date avec priorité faite par LLM
        "nom": dechet_denomination,
        "tonnage": dechet_quantite,
        "ced": clean_ced_code(dechet_rubrique),
        "d_r": exutoire_operation_code,
        "num_bsd": bordereau_id,
        "contenant": dechet_conditionnement,
        "volume_m3": dechet_volume_m3,
        # Nouveaux champs v2
        "nombre_colis": dechet_nombre_colis,
        "consistance": dechet_consistance,
        "flag_rep": bool_to_string(flag_rep)
    }
    
    # Gérer les infos transporteur (= prestataire 2)
    add_presta_raw = None
    if nom_prestataire_2 or any([recepisse_presta_2, departement_presta_2, validite_presta_2]):
        add_presta_raw = {
            "type": "transporteur",
            "nom": nom_prestataire_2,
            "adresse": adresse_presta_2,
            "tel": "",
            "mail": "",
            "fax": "",
            "infos_transporteur": {
                "recepisse": recepisse_presta_2,
                "departement": departement_presta_2,
                "limite_validite": validite_presta_2,
                "routier": mode_transport,
                "multimodal": multimodal
            }
        }
    
    # Gérer les infos négociant
    negociant_raw = None
    if any([negociant_siren, negociant_nom, negociant_recepisse_numero]):
        negociant_raw = {
            "type": "negociant",
            "nom": negociant_nom,
            "adresse": negociant_adresse,
            "siren": negociant_siren,
            "recepisse": negociant_recepisse_numero,
            "departement": negociant_departement,
            "validite": negociant_validite
        }
    
    return {
        "type_doc": "bsd",
        "site_raw": site_raw,  # Site d'origine
        "adresse_site": adresse_site,  # Adresse site
        "type_emetteur": type_emetteur,  # Type d'émetteur
        "presta_raw": presta_raw,  # Installation destination = Prestataire principal
        "nom_prestataire_2": nom_prestataire_2,  # Transporteur = Prestataire 2
        "role_prestataire_2": "transporteur",  # Rôle fixe
        "add_presta_raw": add_presta_raw,  # Infos transporteur
        "negociant_raw": negociant_raw,
        "conformite": {
            "CAP": exutoire_CAP,
            "ADR": dechet_mention_reglementaire
        },
        "exutoire": {
            "entreposage": exutoire_entreposage,
            "lot_accepte": exutoire_lot_accepte,
            "motif_refus": exutoire_motif_refus
        },
        "dechet": [dechet]
    }


def structure_facture_v2(gemini_data: dict):
    """Structure les données d'une facture (version 2)"""
    
    # Vérifier que gemini_data est bien un dictionnaire
    if not isinstance(gemini_data, dict):
        print(f"❌ ERREUR: gemini_data n'est pas un dict: {type(gemini_data)}")
        print(f"❌ Contenu: {gemini_data}")
        raise ValueError(f"gemini_data doit être un dictionnaire, reçu: {type(gemini_data)}")
    
    # Extraire les données de collecte (peut être une liste ou un dictionnaire)
    collecte_data = gemini_data.get("collecte", [])
    
    # Nouveaux champs v2 (racine)
    nom_prestataire_2 = gemini_data.get("nom_prestataire_2", "")
    role_prestataire_2 = gemini_data.get("role_prestataire_2", "")
    type_facture = gemini_data.get("type_facture", "")
    date_fin_periode = gemini_data.get("date_fin_periode", "")
    date_debut_periode = gemini_data.get("date_debut_periode", "")
    num_contrat = gemini_data.get("num_contrat", "")
    num_compte = gemini_data.get("num_compte", "")
    num_client = gemini_data.get("num_client", "")
    total_ttc = gemini_data.get("total_ttc", "")
    
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
                        # Champs V2
                        "tva_pourcentage": presta.get("tva_pourcentage", 0),
                        "avoir": bool_to_string(presta.get("avoir", "")),
                        "declassement": bool_to_string(presta.get("declassement", ""))
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
                # Nouveaux champs v2
                "nom_site": collecte.get("site_raw", ""),
                "adresse_site": collecte.get("adresse_site", ""),
                "nombre_colis": collecte.get("nombre_colis", ""),
                "flag_rep": bool_to_string(collecte.get("flag_rep", "")),
                "facture": facture_obj
            }
            dechets.append(dechet)
    
    elif isinstance(collecte_data, dict):
        # Si c'est un dictionnaire unique (ancien format - rétrocompatibilité)
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
                    # Champs V2
                    "tva_pourcentage": presta.get("tva_pourcentage", 0),
                    "avoir": bool_to_string(presta.get("avoir", "")),
                    "declassement": bool_to_string(presta.get("declassement", ""))
                }
                prestations.append(prestation)
        
        # Créer l'objet facture
        facture_obj = {
            "ligne": prestations,
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
            # Nouveaux champs v2
            "nom_site": collecte_data.get("site_raw", ""),
            "adresse_site": collecte_data.get("adresse_site", ""),
            "nombre_colis": collecte_data.get("nombre_colis", ""),
            "flag_rep": bool_to_string(collecte_data.get("flag_rep", "")),
            "facture": facture_obj
        }
        dechets.append(dechet)
    
    # Utiliser le premier site comme site_raw (ou une valeur par défaut)
    site_raw = ""
    if dechets:
        site_raw = dechets[0].get("nom_site", "")
    
    return {
        "type_doc": "facture",
        "site_raw": site_raw,
        "presta_raw": gemini_data.get("presta_raw", ""),
        "num_facture": gemini_data.get("num_facture", ""),
        "montant_total_ht": gemini_data.get("montant_total_ht", ""),
        # Nouveaux champs v2 (racine)
        "nom_prestataire_2": nom_prestataire_2,
        "role_prestataire_2": role_prestataire_2,
        "type_facture": type_facture,
        "date_fin_periode": date_fin_periode,
        "date_debut_periode": date_debut_periode,
        "num_contrat": num_contrat,
        "num_compte": num_compte,
        "num_client": num_client,
        "total_ttc": total_ttc,
        "dechet": dechets
    }


# =============================================
# FONCTIONS DE TRANSFORMATION INVERSE (structured_data -> gemini_data)
# =============================================

def reverse_structure_bon_v2(structured_data: dict) -> dict:
    """Reconstruit gemini_data à partir de structured_data pour un bon de livraison (v2)"""
    
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
        "presta_raw": structured_data.get("presta_raw", ""),
        "site_raw": structured_data.get("site_raw", ""),
        "adresse_site": structured_data.get("adresse_site", ""),
        # Nouveaux champs v2 (racine)
        "type_bon": structured_data.get("type_bon", ""),
        "immatriculation": structured_data.get("immatriculation", ""),
        "recepisse": structured_data.get("recepisse", ""),
        "nom_prestataire_2": structured_data.get("nom_prestataire_2", ""),
        "role_prestataire_2": structured_data.get("role_prestataire_2", ""),
    }
    
    # Gérer les déchets - utiliser le format array d'objets
    gemini_data["dechet"] = []
    for dechet in dechets:
        dechet_obj = {
            "nom_dechet": dechet.get("nom", ""),
            "poids_net": dechet.get("tonnage", ""),
            "code_ced": dechet.get("ced", ""),
            "code_traitement": dechet.get("d_r", ""),
            "nombre_de_tour": dechet.get("tour", ""),
            # Nouveaux champs v2 (niveau déchet)
            "nom_contenant": dechet.get("nom_contenant", ""),
            "volume_m3": dechet.get("volume_m3", ""),
            "nombre_colis": dechet.get("nombre_colis", ""),
            "flag_rep": dechet.get("flag_rep", "")
        }
        gemini_data["dechet"].append(dechet_obj)
    
    return gemini_data


def reverse_structure_bsd_v2(structured_data: dict) -> dict:
    """Reconstruit gemini_data à partir de structured_data pour un BSD (v2)"""
    
    if not structured_data or structured_data.get("type_doc") != "bsd":
        return {}
    
    dechets = structured_data.get("dechet", [])
    if not dechets:
        return {}
    
    # Prendre le premier déchet pour les données
    first_dechet = dechets[0]
    
    # Reconstruire gemini_data (format aplati)
    gemini_data = {
        "bordereau_id": first_dechet.get("num_bsd", ""),
    }
    
    # Données émetteur (depuis site_raw)
    gemini_data.update({
        "type_emetteur": structured_data.get("type_emetteur", ""),
        "site_raw": structured_data.get("site_raw", ""),
        "adresse_site": structured_data.get("adresse_site", "")
    })
    
    # Données déchet
    gemini_data.update({
        "dechet_rubrique": first_dechet.get("ced", ""),
        "dechet_denomination": first_dechet.get("nom", ""),
        "dechet_consistance": first_dechet.get("consistance", ""),
        "dechet_conditionnement": first_dechet.get("contenant", ""),
        "dechet_nombre_colis": first_dechet.get("nombre_colis", ""),
        "dechet_volume_m3": first_dechet.get("volume_m3", ""),
        "dechet_quantite": first_dechet.get("tonnage", ""),
        "dechet_date": first_dechet.get("date", ""),
        "flag_rep": first_dechet.get("flag_rep", "")
    })
    
    # Données négociant
    negociant_raw = structured_data.get("negociant_raw", {})
    if negociant_raw:
        gemini_data.update({
            "negociant_siren": negociant_raw.get("siren", ""),
            "negociant_nom": negociant_raw.get("nom", ""),
            "negociant_adresse": negociant_raw.get("adresse", ""),
            "negociant_recepisse_numero": negociant_raw.get("recepisse", ""),
            "negociant_departement": negociant_raw.get("departement", ""),
            "negociant_validite": negociant_raw.get("validite", "")
        })
    
    # Données transporteur (depuis prestataire 2)
    gemini_data.update({
        "nom_prestataire_2": structured_data.get("nom_prestataire_2", ""),
        "adresse_presta_2": "",  # Non stockée
    })
    
    add_presta_raw = structured_data.get("add_presta_raw", {})
    if add_presta_raw and add_presta_raw.get("type") == "transporteur":
        infos_transporteur = add_presta_raw.get("infos_transporteur", {})
        gemini_data.update({
            "adresse_presta_2": add_presta_raw.get("adresse", ""),
            "recepisse_presta_2": infos_transporteur.get("recepisse", ""),
            "departement_presta_2": infos_transporteur.get("departement", ""),
            "validite_presta_2": infos_transporteur.get("limite_validite", ""),
            "mode_transport": infos_transporteur.get("routier", ""),
            "multimodal": infos_transporteur.get("multimodal", "")
        })
    
    # Installation de destination (depuis presta_raw)
    gemini_data.update({
        "presta_raw": structured_data.get("presta_raw", ""),
        "adresse_presta_raw": ""  # Non stockée séparément
    })
    
    # Info exutoire
    exutoire = structured_data.get("exutoire", {})
    conformite = structured_data.get("conformite", {})
    gemini_data.update({
        "exutoire_entreposage": exutoire.get("entreposage", ""),
        "exutoire_CAP": conformite.get("CAP", ""),
        "exutoire_lot_accepte": exutoire.get("lot_accepte", ""),
        "exutoire_motif_refus": exutoire.get("motif_refus", ""),
        "exutoire_operation_code": first_dechet.get("d_r", "")
    })
    
    return gemini_data


def reverse_structure_facture_v2(structured_data: dict) -> dict:
    """Reconstruit gemini_data à partir de structured_data pour une facture (v2)"""
    
    if not structured_data or structured_data.get("type_doc") != "facture":
        return {}
    
    dechets = structured_data.get("dechet", [])
    if not dechets:
        return {}
    
    # Reconstruire gemini_data
    gemini_data = {
        "presta_raw": structured_data.get("presta_raw", ""),
        "num_facture": structured_data.get("num_facture", ""),
        "montant_total_ht": structured_data.get("montant_total_ht", ""),
        # Nouveaux champs v2 (racine)
        "nom_prestataire_2": structured_data.get("nom_prestataire_2", ""),
        "role_prestataire_2": structured_data.get("role_prestataire_2", ""),
        "type_facture": structured_data.get("type_facture", ""),
        "date_fin_periode": structured_data.get("date_fin_periode", ""),
        "date_debut_periode": structured_data.get("date_debut_periode", ""),
        "num_contrat": structured_data.get("num_contrat", ""),
        "num_compte": structured_data.get("num_compte", ""),
        "num_client": structured_data.get("num_client", ""),
        "total_ttc": structured_data.get("total_ttc", "")
    }
    
    # Reconstruire les collectes
    collectes = []
    for dechet in dechets:
        collecte = {
            "site_raw": dechet.get("nom_site", ""),
            "adresse_site": dechet.get("adresse_site", ""),
            "num_bon": dechet.get("num_bon", ""),
            "num_bsd": dechet.get("num_bsd", ""),
            "date": dechet.get("date", ""),
            "nom_dechet": dechet.get("nom", ""),
            "ced": dechet.get("ced", ""),
            "contenant": dechet.get("contenant", ""),
            "volume_m3": dechet.get("volume_m3", ""),
            # Nouveaux champs v2
            "nombre_colis": dechet.get("nombre_colis", ""),
            "flag_rep": dechet.get("flag_rep", "")
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
                # Champs V2
                "tva_pourcentage": ligne.get("tva_pourcentage", 0),
                "avoir": ligne.get("avoir", ""),
                "declassement": ligne.get("declassement", "")
            }
            prestations.append(prestation)
        
        collecte["prestations"] = prestations
        collectes.append(collecte)
    
    # Utiliser le format array de collectes
    gemini_data["collecte"] = collectes
    
    return gemini_data


def reverse_structure(type_doc: str, structured_data: dict) -> dict:
    """
    Reconstruit gemini_data à partir de structured_data selon le type de document (v2)
    
    Args:
        type_doc: "bon", "bsd", ou "facture"
        structured_data: Données structurées (format TypeScript)
    
    Returns:
        dict: Données au format gemini_data v2
    """
    
    if type_doc == "bon":
        return reverse_structure_bon_v2(structured_data)
    elif type_doc == "bsd":
        return reverse_structure_bsd_v2(structured_data)
    elif type_doc == "facture":
        return reverse_structure_facture_v2(structured_data)
    else:
        raise ValueError(f"Type de document non supporté: {type_doc}")

