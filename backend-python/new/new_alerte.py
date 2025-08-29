def find(word, mapping):
    l_meta_nom = mapping.keys()
    for meta_nom in l_meta_nom:
        for w in mapping[meta_nom]:
            if word==w: #on pourrait faire correspondance flou là
                return meta_nom
    return None
    

def alerte_function(alerte_type: bool, confidence: dict, structured_response, pdfInfos, clusterParams):
    TRESH_BRUTE = 80
    TRESH_SPEC = 80
    TRESH_BRUTE_HANDWRITTEN = 70
    TRESH_SPEC_HANDWRITTEN = 70

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

    if confidence["brute"]<TRESH_BRUTE:
        stop = True
        message.append("Le document n'est pas suffisament lisible.")
    if confidence["spec"]<TRESH_SPEC:
        stop = True
        message.append("Le document n'est pas suffisament compréhensible.")
    if confidence["handwritten"][1]:
        stop = True
        message.append("Le document contient trop de texte écrit à la main.")

    
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
    