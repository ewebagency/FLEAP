def safe_float(value, default=0.0):
    """
    Convertit une valeur en float en gérant les virgules comme séparateurs décimaux
    """
    if value is None:
        return default
    
    try:
        # Nettoyer la chaîne (enlever espaces, remplacer virgules par points)
        if isinstance(value, str):
            cleaned = str(value).replace(',', '.').replace(' ', '').strip()
            return float(cleaned)
        else:
            return float(value)
    except (ValueError, TypeError):
        return default

def find(word, mapping):
    # Vérification de sécurité pour éviter les erreurs NoneType
    if mapping is None:
        return None
    if not isinstance(mapping, dict):
        return None
    
    l_meta_nom = mapping.keys()
    for meta_nom in l_meta_nom:
        if isinstance(mapping[meta_nom], list):
            for w in mapping[meta_nom]:
                if word==w: #on pourrait faire correspondance flou là
                    return meta_nom
    return None

# ===== FONCTIONS D'ALERTE MODULAIRES =====

def alerte_tonnage(tonnage_str: str):
    """
    Vérifie si le tonnage est un nombre valide entre 0 et 50
    """
    if not tonnage_str or tonnage_str.strip() == "":
        return True, "Tonnage manquant"
    
    try:
        # Nettoyer la chaîne (enlever espaces, virgules, etc.)
        tonnage_clean = str(tonnage_str).replace(',', '.').replace(' ', '').strip()
        tonnage_float = float(tonnage_clean)
        
        if tonnage_float < 0:
            return True, f"Tonnage négatif: {tonnage_float}"
        elif tonnage_float > 50:
            return True, f"Tonnage trop élevé: {tonnage_float} (max: 50)"
        else:
            return False, ""
            
    except (ValueError, TypeError):
        return True, f"Tonnage non numérique: {tonnage_str}"

def alerte_date(date_str: str):
    """
    Vérifie la présence d'une date valide
    
    """
    if not date_str or date_str.strip() == "":
        return True, "Date manquante"
    
    # Vérifier si la date contient au moins des chiffres
    if not any(c.isdigit() for c in str(date_str)):
        return True, f"Date invalide (pas de chiffres): {date_str}"
    
    return False, ""

def alerte_num_bsd(num_bsd: str):
    """
    Vérifie qu'un numéro BSD contient au moins 5 chiffres consécutifs
    """
    if not num_bsd or num_bsd.strip() == "":
        return True, "Numéro BSD manquant"
    
    # Extraire tous les chiffres
    chiffres = ''.join(c for c in str(num_bsd) if c.isdigit())
    
    if len(chiffres) < 5:
        return True, f"Numéro BSD insuffisant (moins de 5 chiffres): {num_bsd}"
    
    return False, ""

def alerte_num_bon(num_bon: str):
    """
    Vérifie qu'un numéro de bon contient au moins 5 chiffres consécutifs
    """
    if not num_bon or num_bon.strip() == "":
        return True, "Numéro de bon manquant"
    
    # Extraire tous les chiffres
    chiffres = ''.join(c for c in str(num_bon) if c.isdigit())
    
    if len(chiffres) < 5:
        return True, f"Numéro de bon insuffisant (moins de 5 chiffres): {num_bon}"
    
    return False, ""

def alerte_num_facture(num_facture: str):
    """
    Vérifie qu'un numéro de facture contient au moins 5 chiffres consécutifs
    """
    if not num_facture or num_facture.strip() == "":
        return True, "Numéro de facture manquant"
    
    # Extraire tous les chiffres
    chiffres = ''.join(c for c in str(num_facture) if c.isdigit())
    
    if len(chiffres) < 5:
        return True, f"Numéro de facture insuffisant (moins de 5 chiffres): {num_facture}"
    
    return False, ""

def alerte_ced(ced_code: str):
    """
    Vérifie qu'un code CED contient exactement 6 chiffres
    """
    if not ced_code or ced_code.strip() == "":
        return True, "Code CED manquant"
    
    # Extraire tous les chiffres
    chiffres = ''.join(c for c in str(ced_code) if c.isdigit())
    
    if len(chiffres) != 6:
        return True, f"Code CED invalide (doit contenir exactement 6 chiffres): {ced_code} (trouvé: {len(chiffres)})"
    
    return False, ""

def alerte_calcul_facture(quantite, prix_unitaire, montant):
    """
    Vérifie que quantité * prix_unitaire = montant (avec tolérance)
    """
    try:
        # Utiliser safe_float pour gérer les virgules comme séparateurs décimaux
        qty_float = safe_float(quantite)
        prix_float = safe_float(prix_unitaire)
        montant_float = safe_float(montant)
        
        calcul_attendu = qty_float * prix_float
        # Tolérance de 0.01 pour les erreurs d'arrondi
        if abs(calcul_attendu - montant_float) > 0.01:
            return True, f"Calcul incorrect: {qty_float} × {prix_float} = {calcul_attendu} ≠ {montant_float}"
        return False, ""
    except (TypeError, ValueError):
        return True, f"Valeurs non numériques: qty={quantite}, prix={prix_unitaire}, montant={montant}"

def alerte_somme_facture(prestations: list, montant_total):
    """
    Vérifie que la somme des montants des prestations = montant_total
    """
    try:
        somme_calculee = 0
        for presta in prestations:
            if isinstance(presta, dict) and 'montant_ht' in presta:
                # Utiliser safe_float pour gérer les virgules comme séparateurs décimaux
                somme_calculee += safe_float(presta['montant_ht'])
        
        # Utiliser safe_float pour le montant total aussi
        montant_total_float = safe_float(montant_total)
        
        # Tolérance de 0.01 pour les erreurs d'arrondi
        if abs(somme_calculee - montant_total_float) > 0.01:
            return True, f"Somme incorrecte: {somme_calculee} ≠ {montant_total_float}"
        return False, ""
    except (TypeError, ValueError):
        return True, f"Erreur de calcul de somme: prestations={prestations}, total={montant_total}"
    

def alerte_function(alerte_type: bool, confidence: dict, structured_response, pdfInfos, clusterParams):
    TRESH_BRUTE = 80
    TRESH_SPEC = 80
    TRESH_BRUTE_HANDWRITTEN = 70
    TRESH_SPEC_HANDWRITTEN = 70

    # Vérifications de sécurité pour éviter les erreurs NoneType
    if pdfInfos is None:
        pdfInfos = {}
    if clusterParams is None:
        clusterParams = {}
    if structured_response is None:
        structured_response = {}
    if confidence is None:
        confidence = {"brute": 0, "spec": 0, "handwritten": [0, False]}

    # Accéder aux valeurs du dictionnaire pdfInfos
    site_user = pdfInfos.get('site_siret_plus', [])
    presta_user = pdfInfos.get('provider')
    
    if len(site_user) > 1: 
        print("---- Attention plusieurs sites sur ce doc ---")

    # Accéder aux valeurs du dictionnaire clusterParams
    mapping_site = clusterParams.get('data', {}).get('params_mapping_site', {})
    mapping_presta = clusterParams.get('data', {}).get('params_mapping_presta', {})
    
    # Accéder aux valeurs du dictionnaire structured_response
    site_raw = structured_response.get('site_raw', '')
    presta_raw = structured_response.get('presta_raw', '')
    site_detected = find(site_raw, mapping_site)
    presta_detected = find(presta_raw, mapping_presta)

    stop = False
    message = []


    if alerte_type:
        stop = True
        message.append("Le type de document n'est pas reconnu comme ce qui a été annoncé par l'utilisateur.")

    if confidence.get("brute", 0) < TRESH_BRUTE:
        stop = True
        message.append("Le document n'est pas suffisament lisible.")
    if confidence.get("spec", 0) < TRESH_SPEC:
        stop = True
        message.append("Le document n'est pas suffisament compréhensible.")
    
    # Vérification sécurisée pour handwritten
    handwritten_data = confidence.get("handwritten", [0, False])
    if isinstance(handwritten_data, list) and len(handwritten_data) > 1 and handwritten_data[1]:
        stop = True
        message.append("Le document contient trop de texte écrit à la main.")

    large_word_ok = confidence.get("large_word_review_llm_can_understand", True)
    if not large_word_ok:
        reason = confidence.get("large_word_review_reason", "Le document risque d'être mal compris.")
        stop = True
        message.append(f"Lecture OCR douteuse: {reason}")

    # ===== NOUVELLES ALERTES MODULAIRES =====
    # Ces alertes peuvent être facilement activées/désactivées en modifiant les variables ci-dessous
    ENABLE_ALERTE_TONNAGE = True
    ENABLE_ALERTE_DATE = True
    ENABLE_ALERTE_NUM_BSD = True
    ENABLE_ALERTE_NUM_BON = True
    ENABLE_ALERTE_NUM_FACTURE = True
    ENABLE_ALERTE_CED = True
    ENABLE_ALERTE_CALCUL_FACTURE = True
    ENABLE_ALERTE_SOMME_FACTURE = True

    # Vérifications des nouvelles alertes
    if structured_response and isinstance(structured_response, dict):
        type_doc = structured_response.get('type_doc', '')
        dechets = structured_response.get('dechet', [])
        
        # Alerte tonnage pour tous les déchets
        if ENABLE_ALERTE_TONNAGE and dechets:
            for dechet in dechets:
                if isinstance(dechet, dict) and 'tonnage' in dechet:
                    alerte, msg = alerte_tonnage(dechet['tonnage'])
                    if alerte:
                        stop = True
                        message.append(f"Tonnage: {msg}")
        
        # Alerte date pour tous les déchets
        if ENABLE_ALERTE_DATE and dechets:
            for dechet in dechets:
                if isinstance(dechet, dict) and 'date' in dechet:
                    alerte, msg = alerte_date(dechet['date'])
                    if alerte:
                        stop = True
                        message.append(f"Date: {msg}")
        
        # Alerte CED pour tous les déchets
        if ENABLE_ALERTE_CED and dechets:
            for dechet in dechets:
                if isinstance(dechet, dict) and 'ced' in dechet:
                    alerte, msg = alerte_ced(dechet['ced'])
                    if alerte:
                        stop = True
                        message.append(f"Code CED: {msg}")
        
        # Alerte num_bsd pour tous les déchets
        if ENABLE_ALERTE_NUM_BSD and dechets:
            for dechet in dechets:
                if isinstance(dechet, dict) and 'num_bsd' in dechet:
                    alerte, msg = alerte_num_bsd(dechet['num_bsd'])
                    if alerte:
                        stop = True
                        message.append(f"Numéro BSD: {msg}")
        
        # Alerte num_bon pour tous les déchets
        if ENABLE_ALERTE_NUM_BON and dechets:
            for dechet in dechets:
                if isinstance(dechet, dict) and 'num_bon' in dechet:
                    alerte, msg = alerte_num_bon(dechet['num_bon'])
                    if alerte:
                        stop = True
                        message.append(f"Numéro de bon: {msg}")
        
        # Alerte num_facture (pour les factures)
        if ENABLE_ALERTE_NUM_FACTURE and type_doc == 'facture' and 'num_facture' in structured_response:
            alerte, msg = alerte_num_facture(structured_response['num_facture'])
            if alerte:
                stop = True
                message.append(f"Numéro de facture: {msg}")
        
        # Alertes spécifiques aux factures
        if type_doc == 'facture' and dechets:
            for dechet in dechets:
                if isinstance(dechet, dict) and 'facture' in dechet:
                    facture = dechet['facture']
                    if isinstance(facture, dict) and 'ligne' in facture:
                        prestations = facture['ligne']
                        
                        # Alerte calcul facture pour chaque prestation
                        if ENABLE_ALERTE_CALCUL_FACTURE and prestations:
                            for presta in prestations:
                                if isinstance(presta, dict) and all(key in presta for key in ['quantite', 'prix_unitaire', 'montant_ht']):
                                    # Utiliser safe_float pour gérer les virgules comme séparateurs décimaux
                                    qty = safe_float(presta['quantite'])
                                    prix = safe_float(presta['prix_unitaire'])
                                    montant = safe_float(presta['montant_ht'])
                                    alerte, msg = alerte_calcul_facture(qty, prix, montant)
                                    if alerte:
                                        stop = True
                                        message.append(f"Calcul facture: {msg}")
        
        # Alerte somme facture (nécessite montant_total dans structured_response)
        if ENABLE_ALERTE_SOMME_FACTURE and type_doc == 'facture':
            montant_total = structured_response.get('montant_total_ht', 0)
            if montant_total and dechets:
                for dechet in dechets:
                    if isinstance(dechet, dict) and 'facture' in dechet:
                        facture = dechet['facture']
                        if isinstance(facture, dict) and 'ligne' in facture:
                            prestations = facture['ligne']
                            alerte, msg = alerte_somme_facture(prestations, montant_total)
                            if alerte:
                                stop = True
                                message.append(f"Somme facture: {msg}")
                            break  # On vérifie seulement le premier déchet pour la somme totale

    
    if stop == False:
        # Vérification du site seulement si site_user n'est pas vide
        if site_user and len(site_user) > 0:
            if site_detected == None:
                stop = True
                message.append("Le site n'a pas été détecté")
            else:
                if site_detected != site_user[0]:
                    stop = True
                    message.append("Le site détecté n'est pas le même que celui donné par le user")

        # Vérification du prestataire seulement si presta_user n'est pas None
        if presta_user:
            if presta_detected == None:
                stop = True
                message.append("Le prestataire n'a pas été détecté")
            else:
                if presta_detected != presta_user:
                    stop = True
                    message.append("Le prestataire détecté n'est pas le même que celui donné par le user")



    
    return {
        "stop" : stop, 
        "message" : "\n".join(message)
        }
    