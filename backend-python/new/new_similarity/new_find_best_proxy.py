import os
from supabase import create_client, Client
from typing import Dict, Any, Optional, Tuple
from .new_similarity import find_closest_neighbor


def get_supabase_client() -> Client:
    """Crée et retourne un client Supabase"""
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("NEXT_PUBLIC_SUPABASE_KEY")
    
    if not url or not key:
        raise ValueError("SUPABASE_URL et SUPABASE_ANON_KEY doivent être définis dans les variables d'environnement")
    
    return create_client(url, key)


def find_best_proxy_from_rag(raw_text: str, entreprise_id: Optional[int] = None):
    """
    Trouve le meilleur proxy dans la table bdd_rag basé sur la similarité TF-IDF du raw_text.
    
    Args:
        raw_text: Le texte brut à comparer
        entreprise_id: ID de l'entreprise pour filtrer (optionnel)
    
    Returns:
        Dict contenant:
        - found: bool - Si un voisin a été trouvé
        - raw_text: str - Le raw_text du voisin le plus proche
        - perfect_answer: dict - La perfect_answer du voisin le plus proche
        - similarity_score: float - Score de similarité
        - status: str - Statut de la recherche
        - neighbor_id: str - ID du voisin trouvé
    """
    
    try:
        # Créer le client Supabase
        supabase = get_supabase_client()
        
        # Construire la requête
        query = supabase.table('bdd_rag').select('id, raw_text, perfect_answer, document_type, pdf_infos_id')
        
        # Filtrer par entreprise si fournie
        if entreprise_id is not None:
            query = query.eq('entreprise_id', entreprise_id)
        
        # Exécuter la requête
        response = query.execute()
        
        if not response.data:
            return {
                'found': False,
                'raw_text': '',
                'perfect_answer': {},
                'similarity_score': 0.0,
                'status': 'Aucune donnée trouvée dans bdd_rag',
                'neighbor_id': None
            }
        
        # Extraire les données
        neighbor_texts = [row['raw_text'] for row in response.data if row['raw_text']]
        neighbor_ids = [row['id'] for row in response.data if row['raw_text']]
        
        if not neighbor_texts:
            return {
                'found': False,
                'raw_text': '',
                'perfect_answer': {},
                'similarity_score': 0.0,
                'status': 'Aucun raw_text valide trouvé dans bdd_rag',
                'neighbor_id': None
            }
        
        # Trouver le voisin le plus proche
        result = find_closest_neighbor(raw_text, neighbor_texts, neighbor_ids)
        
        # Si un voisin a été trouvé, récupérer ses données complètes
        if result['found'] and result['neighbor_id']:
            neighbor_data = next(
                (row for row in response.data if row['id'] == result['neighbor_id']), 
                None
            )
            
            if neighbor_data:
                return {
                    'found': True,
                    'raw_text': neighbor_data['raw_text'],
                    'perfect_answer': neighbor_data['perfect_answer'],
                    'similarity_score': result['similarity_score'],
                    'status': result['status'],
                    'neighbor_id': result['neighbor_id'],
                    'document_type': neighbor_data.get('document_type'),
                    'pdf_infos_id': neighbor_data.get('pdf_infos_id')
                }
        
        # Retourner le résultat même si pas de voisin trouvé
        return {
            'found': False,
            'raw_text': '',
            'perfect_answer': {},
            'similarity_score': result['similarity_score'],
            'status': result['status'],
            'neighbor_id': result['neighbor_id']
        }
        
    except Exception as e:
        return {
            'found': False,
            'raw_text': '',
            'perfect_answer': {},
            'similarity_score': 0.0,
            'status': f'Erreur lors de la recherche: {str(e)}',
            'neighbor_id': None
        }


def find_best_proxy_by_document_type(raw_text: str, document_type: str, entreprise_id: Optional[int] = None) :
    """
    Trouve le meilleur proxy dans la table bdd_rag filtré par type de document.
    
    Args:
        raw_text: Le texte brut à comparer
        document_type: Type de document (bon, bsd, facture)
        entreprise_id: ID de l'entreprise pour filtrer (optionnel)
    
    Returns:
        Dict contenant les mêmes champs que find_best_proxy_from_rag
    """
    
    try:
        # Créer le client Supabase
        supabase = get_supabase_client()
        
        # Construire la requête avec filtre sur le type de document
        query = supabase.table('bdd_rag').select('id, raw_text, perfect_answer, document_type, pdf_infos_id')
        query = query.eq('document_type', document_type)
        
        # Filtrer par entreprise si fournie
        if entreprise_id is not None:
            query = query.eq('entreprise_id', entreprise_id)
        
        # Exécuter la requête
        response = query.execute()
        
        if not response.data:
            return {
                'found': False,
                'raw_text': '',
                'perfect_answer': {},
                'similarity_score': 0.0,
                'status': f'Aucune donnée trouvée pour le type de document: {document_type}',
                'neighbor_id': None
            }
        
        # Extraire les données
        neighbor_texts = [row['raw_text'] for row in response.data if row['raw_text']]
        neighbor_ids = [row['id'] for row in response.data if row['raw_text']]
        
        if not neighbor_texts:
            return {
                'found': False,
                'raw_text': '',
                'perfect_answer': {},
                'similarity_score': 0.0,
                'status': f'Aucun raw_text valide trouvé pour le type: {document_type}',
                'neighbor_id': None
            }
        
        # Trouver le voisin le plus proche
        result = find_closest_neighbor(raw_text, neighbor_texts, neighbor_ids)
        
        # Si un voisin a été trouvé, récupérer ses données complètes
        if result['found'] and result['neighbor_id']:
            neighbor_data = next(
                (row for row in response.data if row['id'] == result['neighbor_id']), 
                None
            )
            
            if neighbor_data:
                return {
                    'found': True,
                    'raw_text': neighbor_data['raw_text'],
                    'perfect_answer': neighbor_data['perfect_answer'],
                    'similarity_score': result['similarity_score'],
                    'status': result['status'],
                    'neighbor_id': result['neighbor_id'],
                    'document_type': neighbor_data.get('document_type'),
                    'pdf_infos_id': neighbor_data.get('pdf_infos_id')
                }
        
        # Retourner le résultat même si pas de voisin trouvé
        return {
            'found': False,
            'raw_text': '',
            'perfect_answer': {},
            'similarity_score': result['similarity_score'],
            'status': result['status'],
            'neighbor_id': result['neighbor_id']
        }
        
    except Exception as e:
         return {
             'found': False,
             'raw_text': '',
             'perfect_answer': {},
             'similarity_score': 0.0,
             'status': f'Erreur lors de la recherche par type: {str(e)}',
             'neighbor_id': None
         }


def create_best_prompt_example(entreprise_id: int, document_type: str, raw_text: str):
    """
    Crée un prompt d'exemple basé sur le document le plus similaire trouvé dans la base RAG.
    
    Args:
        entreprise_id: ID de l'entreprise pour filtrer
        document_type: Type de document (bon, bsd, facture)
        raw_text: Le texte brut du document à traiter
    
    Returns:
        dict: {"prompt": str, "found_example": bool}
    """
    
    try:
        # Trouver le meilleur proxy dans la base RAG
        result = find_best_proxy_by_document_type(raw_text, document_type, entreprise_id)
        
        if result['found'] and result['perfect_answer']:
            # Formater le prompt avec l'exemple trouvé
            prompt = (
                f"\n\n Voici un document similaire sur lequel te baser : {result['raw_text']} "
                f"\n La réponse parfaite pour ce document est : {result['perfect_answer']}"
            )
            
            print(f"✅ Exemple trouvé avec score de similarité: {result['similarity_score']:.3f}")
            return {"prompt": prompt, "found_example": True}
        else:
            # Aucun exemple trouvé
            print(f"⚠️ Aucun exemple trouvé pour le type {document_type}: {result['status']}")
            return {"prompt": "Fait au mieux", "found_example": False}
            
    except Exception as e:
        print(f"❌ Erreur lors de la création du prompt d'exemple: {str(e)}")
        return {"prompt": f"Erreur lors de la recherche d'exemple: {str(e)}", "found_example": False}
