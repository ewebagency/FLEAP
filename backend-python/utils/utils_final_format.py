from typing import Dict, Any, List
from datetime import datetime


#=============Utils=============
# Fonction helper pour nettoyer les valeurs
def clean_value(value: Any):
    if value is None or value == "" or value == "null":
        return ""
    return str(value).strip()

# Fonction helper pour convertir le poids
def parse_weight(weight_str: str):
    if not weight_str:
        return 0.0
    try:
        # Enlève "T" et remplace la virgule par un point
        weight_clean = weight_str.replace("T", "").replace(",", ".").strip()
        return float(weight_clean)
    except:
        return 0.0

# Fonction helper pour formater la date
def format_date(date_str: str):
    if not date_str:
        return ""
    
    # Nettoyer la chaîne de date
    date_str = str(date_str).strip()
    
    # Essayer différents formats de date
    date_formats = [
        '%Y-%m-%d',      # 2025-07-17
        '%d/%m/%Y',      # 17/07/2025
        '%d-%m-%Y',      # 17-07-2025
        '%Y/%m/%d',      # 2025/07/17
    ]
    
    for date_format in date_formats:
        try:
            date_obj = datetime.strptime(date_str, date_format)
            result = date_obj.strftime("%Y-%m-%d")  # Garder en YYYY-MM-DD pour les inputs HTML5
            
            return result
        except ValueError:
            continue
    
    # Si aucun format ne fonctionne, retourner la date originale
    #print(f"❌ format_date: aucun format reconnu, retourne original: '{date_str}'")
    return date_str

# Fonction helper pour vérifier les correspondances parfaites et enrichir les données
def check_perfect_matches_and_enrich(bon_data: Dict[str, Any], known_data: Dict[str, List[Any]]):
    """
    Vérifie les correspondances parfaites entre les données extraites et les known_words.
    Enrichit les données avec les caractéristiques supplémentaires si correspondance parfaite.
    
    Args:
        bon_data: Données extraites par Gemini
        known_data: Base de données des entités connues
        
    Returns:
        Tuple (données enrichies, perfect_extract)
    """
    perfect_extract = False
    enriched_data = bon_data.copy()
    
    # Vérifier la correspondance parfaite du nom du site
    site_match = None
    if 'sites' in known_data and bon_data.get('nom_site'):
        for site in known_data['sites']:
            if site.get('nom') and site['nom'].strip().lower() == bon_data['nom_site'].strip().lower():
                site_match = site
                break
    
    # Vérifier la correspondance parfaite du nom du prestataire
    prestataire_match = None
    if 'prestataires' in known_data and bon_data.get('nom_prestataire'):
        for prestataire in known_data['prestataires']:
            if prestataire.get('nomBoite') and prestataire['nomBoite'].strip().lower() == bon_data['nom_prestataire'].strip().lower():
                prestataire_match = prestataire
                break
    
    # Enrichir les données si correspondance parfaite trouvée
    if site_match:
        print(f"✅ Correspondance parfaite site trouvée: {site_match['nom']}")
        # Enrichir avec les données du site
        if not enriched_data.get('siret_site') and site_match.get('siret'):
            enriched_data['siret_site'] = site_match['siret']
        if not enriched_data.get('adresse_site') and site_match.get('adresseSiege'):
            enriched_data['adresse_site'] = site_match['adresseSiege']
    
    if prestataire_match:
        print(f"✅ Correspondance parfaite prestataire trouvée: {prestataire_match['nomBoite']}")
        # Enrichir avec les données du prestataire
        if not enriched_data.get('siret_prestataire') and prestataire_match.get('siret'):
            enriched_data['siret_prestataire'] = prestataire_match['siret']
        if not enriched_data.get('adresse_prestataire') and prestataire_match.get('adresse'):
            enriched_data['adresse_prestataire'] = prestataire_match['adresse']
        if not enriched_data.get('nom_prenom_prestataire') and prestataire_match.get('nomPrenom'):
            enriched_data['nom_prenom_prestataire'] = prestataire_match['nomPrenom']
        if not enriched_data.get('email_prestataire') and prestataire_match.get('email'):
            enriched_data['email_prestataire'] = prestataire_match['email']
    
    # Vérifier si l'extraction est parfaite
    # Conditions: correspondance parfaite site ET prestataire, date présente, nom déchet présent, tonnage cohérent
    has_perfect_site = site_match is not None
    has_perfect_prestataire = prestataire_match is not None
    has_date = bool(bon_data.get('date') and bon_data['date'].strip())
    has_waste_name = bool(bon_data.get('nom_dechet') and bon_data['nom_dechet'].strip())
    has_coherent_weight = bool(bon_data.get('poids_net') and parse_weight(bon_data['poids_net']) > 0)
    
    perfect_extract = (has_perfect_site and has_perfect_prestataire and 
                      has_date and has_waste_name and has_coherent_weight)
    
    if perfect_extract:
        print("🎯 EXTRACTION PARFAITE: Toutes les conditions sont remplies!")
    else:
        print("⚠️ Extraction non parfaite:")
        print(f"  - Site parfait: {has_perfect_site}")
        print(f"  - Prestataire parfait: {has_perfect_prestataire}")
        print(f"  - Date présente: {has_date}")
        print(f"  - Nom déchet présent: {has_waste_name}")
        print(f"  - Tonnage cohérent: {has_coherent_weight}")
    
    return enriched_data, perfect_extract
#=============================================


def transform_bon_to_bsd_cerfa(bon_data: Dict[str, Any], known_data: Dict[str, List[Any]] = None):
    """
    Transforme les données extraites d'un bon de pesée en format BSDCerfa.
    Les champs manquants sont laissés vides.
    
    Args:
        bon_data: Dictionnaire contenant les données extraites du bon
        known_data: Base de données des entités connues pour enrichissement
        
    Returns:
        Dictionnaire au format BSDCerfa avec perfect_extract
    """
    
    # Vérifier les correspondances parfaites et enrichir les données
    if known_data:
        enriched_data, perfect_extract = check_perfect_matches_and_enrich(bon_data, known_data)
    else:
        enriched_data = bon_data
        perfect_extract = False
    
    bsd_cerfa = {
        "numeroBordereau": clean_value(enriched_data.get("num_bon", "")),
        "emetteur": {
            "statut": "producteur",
            "siret": clean_value(enriched_data.get("siret_site", "")),
            "nom": clean_value(enriched_data.get("nom_site", "")),
            "adresse": clean_value(enriched_data.get("adresse_site", "")),
            "telephone": "",
            "fax": "",
            "email": "",
            "contact": ""
        },
        "installationDestination": {
            "entreposageProvisoire": False,
            "siret": clean_value(enriched_data.get("siret_prestataire", "")),
            "nom": clean_value(enriched_data.get("nom_prestataire", "")),
            "adresse": clean_value(enriched_data.get("adresse_prestataire", "")),
            "telephone": "",
            "email": clean_value(enriched_data.get("email_prestataire", "")),
            "contact": clean_value(enriched_data.get("nom_prenom_prestataire", "")),
            "numeroCAP": "",
            "codeOperation": ""  # Valeur par défaut pour décharge
        },
        "dechet": {
            "code": clean_value(enriched_data.get("code_ced", "")),
            "consistence": "solide",  # Valeur par défaut
            "denominationUsuelle": clean_value(enriched_data.get("nom_dechet", "")),
            "categorie": "",  # Valeur par défaut
            "etiquetageADR": "",
            "conditionnement": "",  # Valeur par défaut pour gravillon
            "nombreColis": 1,  # Valeur par défaut
            "poids": parse_weight(enriched_data.get("poids_net", "")),
            "volume": 0,
            "volumeUnite": "",
            "reel": True
        },
        "negociant": "",  # Pas d'info dans le bon
        "collecteurTransporteur": {
            "siren": "",  # Pas d'info dans le bon
            "nom": clean_value(enriched_data.get("nom_prestataire", "")),
            "adresse": clean_value(enriched_data.get("adresse_prestataire", "")),
            "telephone": "",
            "fax": "",
            "email": clean_value(enriched_data.get("email_prestataire", "")),
            "contact": clean_value(enriched_data.get("nom_prenom_prestataire", "")),
            "numeroRecepisse": "",
            "departement": "",
            "dateValiditeRecepisse": "",
            "modeTransport": "route",
            "datePriseEnCharge": "",
            "signature": ""
        },
        "expedition": {
            "dateEnvoi": format_date(enriched_data.get("date", "")),
            "heure": "",
            "signature": ""
        },
        "realisationOperation": {
            "code": "",
            "description": "",
            "nom": clean_value(enriched_data.get("nom_prestataire", "")),
            "date": format_date(enriched_data.get("date", "")),
            "signature": ""
        },
        "declarationEmetteur": {
            "nom": clean_value(enriched_data.get("nom_site", "")),
            "date": format_date(enriched_data.get("date", "")),
            "signature": ""
        },
        "perfect_extract": perfect_extract
    }
    
    return bsd_cerfa

def transform_bsd_to_bsd_cerfa(bsd_data: Dict[str, Any]):
    """
    Transforme les données extraites d'un BSD en format BSDCerfa.
    Cette fonction peut être étendue selon les besoins.
    
    Args:
        bsd_data: Dictionnaire contenant les données extraites du BSD
        
    Returns:
        Dictionnaire au format BSDCerfa
    """
    # Pour l'instant, on retourne les données telles quelles
    # Cette fonction peut être étendue selon les besoins spécifiques
    return bsd_data
