from typing import Dict, Any, List
from prompts import prompt_bon, prompt_bsd
from .utils_final_format import transform_bon_to_bsd_cerfa, transform_bsd_to_bsd_cerfa

# Configuration des types de documents
DOCUMENT_TYPES = {
    "bon": {
        "prompt": prompt_bon,
        "transformer": transform_bon_to_bsd_cerfa,
        "description": "Bon de pesée de déchets"
    },
    "bsd": {
        "prompt": prompt_bsd,
        "transformer": transform_bsd_to_bsd_cerfa,
        "description": "Bordereau de Suivi de Déchets"
    }
}

def get_document_config(doc_type: str):
    """
    Récupère la configuration pour un type de document donné.
    
    Args:
        doc_type: Type de document ('bon', 'bsd', 'facture')
        
    Returns:
        Configuration du document avec prompt et transformer
    """
    if doc_type not in DOCUMENT_TYPES:
        raise ValueError(f"Type de document non supporté: {doc_type}")
    
    return DOCUMENT_TYPES[doc_type]

def get_prompt(doc_type: str, entreprise_name: str = None):
    """
    Récupère le prompt pour un type de document.
    
    Args:
        doc_type: Type de document
        entreprise_name: Nom de l'entreprise cliente (optionnel)
        
    Returns:
        Prompt à utiliser pour l'extraction
    """
    config = get_document_config(doc_type)
    if not config["prompt"]:
        raise ValueError(f"Pas de prompt défini pour le type: {doc_type}")
    
    base_prompt = config["prompt"]
    
    # Si c'est un bon et qu'on a le nom de l'entreprise, personnaliser le prompt
    if doc_type == "bon" and entreprise_name:
        # Ajouter une instruction spécifique pour éviter la confusion
        entreprise_warning = f"""
        Attention "{entreprise_name}" et son adresse c'est l'entreprise cliente, rien à voir avec le site        
        """
        #Attention : le nom "{entreprise_name}" et son adresse associée correspondent à l'entreprise producteur de déchets.
        #Ce nom N'A RIEN À VOIR avec le site de collecte des déchets, ne les confonds pas.
        
        prompt_with_warning = base_prompt.split("Le nom du site, le lieu d'origine du déchet.")[0] + entreprise_warning + base_prompt.split("Le nom du site, le lieu d'origine du déchet.")[1]
        
        #return base_prompt #si on ne veut pas mettre l'avertissement du nom d'entreprise
        return prompt_with_warning
    
    return base_prompt

def get_transformer(doc_type: str):
    """
    Récupère la fonction de transformation pour un type de document.
    
    Args:
        doc_type: Type de document
        
    Returns:
        Fonction de transformation
    """
    config = get_document_config(doc_type)
    return config["transformer"]

import json

def transform_document_data(doc_type: str, extracted_data, known_data: Dict[str, List[Any]] = None):
    """
    Transforme les données extraites selon le type de document.
    
    Args:
        doc_type: Type de document
        extracted_data: Données extraites par Gemini (peut être une chaîne JSON ou un dict)
        known_data: Base de données des entités connues pour enrichissement
        
    Returns:
        Données au format BSDCerfa
    """
    # Si extracted_data est une chaîne JSON, la parser
    if isinstance(extracted_data, str):
        try:
            extracted_data = json.loads(extracted_data)
        except json.JSONDecodeError as e:
            raise ValueError(f"Impossible de parser les données JSON: {e}")
    
    transformer = get_transformer(doc_type)
    
    # Passer les known_data à la fonction de transformation si elle les accepte
    if doc_type == "bon":
        return transformer(extracted_data, known_data)
    else:
        return transformer(extracted_data)
