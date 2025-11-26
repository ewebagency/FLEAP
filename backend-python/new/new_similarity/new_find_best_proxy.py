import os
from typing import Any, Dict, Optional

from supabase import Client, create_client

from .new_similarity import find_closest_neighbor
from .new_similarity_v2 import find_closest_neighbor_retrieval_rerank


USE_RETRIEVAL_RERANK_V2 = True


def get_supabase_client() -> Client:
    """Crée et retourne un client Supabase"""
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("NEXT_PUBLIC_SUPABASE_KEY")
    
    if not url or not key:
        raise ValueError("NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_KEY doivent être définis dans les variables d'environnement")
    
    return create_client(url, key)


def find_best_proxy_from_rag(raw_text: str, entreprise_id: Optional[int] = None) -> Dict[str, Any]:
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
        query = supabase.table('bdd_rag').select(
            'id, raw_text, perfect_answer, document_type, pdf_infos_id, force_image, prompt, embedding'
        )
        
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
        rows = [row for row in response.data if row.get('raw_text')]
        neighbor_texts = [row['raw_text'] for row in rows]
        neighbor_ids = [row['id'] for row in rows]
        neighbor_embeddings = [row.get('embedding') for row in rows]
        
        if not neighbor_texts:
            return {
                'found': False,
                'raw_text': '',
                'perfect_answer': {},
                'similarity_score': 0.0,
                'status': 'Aucun raw_text valide trouvé dans bdd_rag',
                'neighbor_id': None
            }
        
        # Trouver le voisin le plus proche (mode v1 ou v2)
        if USE_RETRIEVAL_RERANK_V2:
            if all(isinstance(vec, list) for vec in neighbor_embeddings):
                result = find_closest_neighbor_retrieval_rerank(
                    raw_text,
                    neighbor_texts,
                    neighbor_ids,
                    neighbor_embeddings=neighbor_embeddings,  # type: ignore[arg-type]
                )
            else:
                result = find_closest_neighbor_retrieval_rerank(
                    raw_text,
                    neighbor_texts,
                    neighbor_ids,
                )
        else:
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
                    'pdf_infos_id': neighbor_data.get('pdf_infos_id'),
                    'force_image': neighbor_data.get('force_image', False),
                    'prompt': neighbor_data.get('prompt')
                }
        
        # Retourner le résultat même si pas de voisin trouvé
        return {
            'found': False,
            'raw_text': '',
            'perfect_answer': {},
            'similarity_score': result['similarity_score'],
            'status': result['status'],
            'neighbor_id': result['neighbor_id'],
            'force_image': False,
            'prompt': None
        }
        
    except Exception as e:
        return {
            'found': False,
            'raw_text': '',
            'perfect_answer': {},
            'similarity_score': 0.0,
            'status': f'Erreur lors de la recherche: {str(e)}',
            'neighbor_id': None,
            'force_image': False,
            'prompt': None
        }


def find_best_proxy_by_document_type(
    raw_text: str, document_type: str, entreprise_id: Optional[int] = None
) -> Dict[str, Any]:
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
        query = supabase.table('bdd_rag').select(
            'id, raw_text, perfect_answer, document_type, pdf_infos_id, force_image, prompt, embedding'
        )
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
        rows = [row for row in response.data if row.get('raw_text')]
        neighbor_texts = [row['raw_text'] for row in rows]
        neighbor_ids = [row['id'] for row in rows]
        neighbor_embeddings = [row.get('embedding') for row in rows]
        
        if not neighbor_texts:
            return {
                'found': False,
                'raw_text': '',
                'perfect_answer': {},
                'similarity_score': 0.0,
                'status': f'Aucun raw_text valide trouvé pour le type: {document_type}',
                'neighbor_id': None
            }
        
        # Trouver le voisin le plus proche (mode v1 ou v2)
        if USE_RETRIEVAL_RERANK_V2:
            if all(isinstance(vec, list) for vec in neighbor_embeddings):
                result = find_closest_neighbor_retrieval_rerank(
                    raw_text,
                    neighbor_texts,
                    neighbor_ids,
                    neighbor_embeddings=neighbor_embeddings,  # type: ignore[arg-type]
                )
            else:
                result = find_closest_neighbor_retrieval_rerank(
                    raw_text,
                    neighbor_texts,
                    neighbor_ids,
                )
        else:
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
                    'pdf_infos_id': neighbor_data.get('pdf_infos_id'),
                    'force_image': neighbor_data.get('force_image', False),
                    'prompt': neighbor_data.get('prompt')
                }
        
        # Retourner le résultat même si pas de voisin trouvé
        return {
            'found': False,
            'raw_text': '',
            'perfect_answer': {},
            'similarity_score': result['similarity_score'],
            'status': result['status'],
            'neighbor_id': result['neighbor_id'],
            'force_image': False,
            'prompt': None
        }
        
    except Exception as e:
         return {
             'found': False,
             'raw_text': '',
             'perfect_answer': {},
             'similarity_score': 0.0,
             'status': f'Erreur lors de la recherche par type: {str(e)}',
             'neighbor_id': None,
             'force_image': False,
             'prompt': None
         }


def create_best_prompt_example(entreprise_id: int, document_type: str, raw_text: str, liste_nom_a_eviter: list[str] = None, parse_or_ocr: str = "parse") -> Dict[str, Any]:
    """
    Crée un prompt d'exemple basé sur le document le plus similaire trouvé dans la base RAG.
    
    Args:
        entreprise_id: ID de l'entreprise pour filtrer
        document_type: Type de document (bon, bsd, facture)
        raw_text: Le texte brut du document à traiter
        liste_nom_a_eviter: Liste des noms à éviter (pour les suffixes du prompt)
        parse_or_ocr: Méthode d'extraction (parse, ocr, mindee)
    
    Returns:
        dict: {
            "prompt_text": str,  # Le prompt complet avec suffixes
            "prompt_rag_used": bool,  # Si un prompt RAG personnalisé a été utilisé
            "found_example": bool,  # Si un exemple RAG a été trouvé
            "force_image": bool,
            "rag_example_id": str | None,
            "example_prompt": str  # Le prompt d'exemple à ajouter après le prompt principal
        }
    """
    
    try:
        from new.new_prompts import get_specific_prompt, prompt_ne_pas_mettre, prompt_parse_ocr
        
        # Trouver le meilleur proxy dans la base RAG
        result = find_best_proxy_by_document_type(raw_text, document_type, entreprise_id)
        
        # Vérifier si un prompt RAG personnalisé existe
        prompt_rag_personnalise = result.get('prompt')
        prompt_rag_used = False
        
        # Ajouter les suffixes (toujours ajoutés après, qu'on utilise RAG ou pas)
        suffixes = prompt_ne_pas_mettre(liste_nom_a_eviter or []) + prompt_parse_ocr(parse_or_ocr)
        
        # Construire le prompt principal (RAG personnalisé ou par défaut)
        if prompt_rag_personnalise and prompt_rag_personnalise.strip():
            prompt_rag_used = True
            print(f"\n✅ Prompt RAG personnalisé trouvé - ID: {result.get('neighbor_id')}")
            # Le prompt RAG remplace seulement la partie principale (new_prompt_bon/bsd/facture), on ajoute les suffixes après
            prompt_text = prompt_rag_personnalise + suffixes
        else:
            # Utiliser le prompt par défaut (qui inclut déjà les suffixes via get_specific_prompt)
            prompt_text = get_specific_prompt(document_type, liste_nom_a_eviter or [], parse_or_ocr)
        
        # Gérer l'exemple RAG (document similaire)
        if result['found']:
            neighbor_id = result.get('neighbor_id')
            has_perfect_answer = result.get('perfect_answer') and isinstance(result.get('perfect_answer'), dict) and len(result.get('perfect_answer', {})) > 0
            
            if has_perfect_answer:
                print(f"\n✅ Exemple trouvé - Similarité: {result['similarity_score']:.3f}")
                
                # Logger si force_image détecté depuis RAG
                force_image_from_rag = result.get('force_image', False)
                if force_image_from_rag:
                    print(f"🖼️ 🖼️ 🖼️ 📚 DÉTECTION RAG -> Force_Image, ID: {neighbor_id}")
                
                example_prompt = f"\n\n Voici un document similaire sur lequel te baser : {result['raw_text']} \n La réponse parfaite pour ce document est : {result['perfect_answer']}"
                
                return {
                    "prompt_text": prompt_text,
                    "prompt_rag_used": prompt_rag_used,
                    "found_example": True,
                    "force_image": force_image_from_rag,
                    "rag_example_id": neighbor_id,
                    "example_prompt": example_prompt
                }
            else:
                # Voisin trouvé mais pas de perfect_answer : on retourne quand même le rag_example_id pour lier le PDF au RAG
                print(f"\n⚠️ Voisin trouvé (ID: {neighbor_id}) mais sans perfect_answer - Similarité: {result['similarity_score']:.3f}")
                
                # Logger si force_image détecté depuis RAG
                force_image_from_rag = result.get('force_image', False)
                if force_image_from_rag:
                    print(f"🖼️ 🖼️ 🖼️ 📚 DÉTECTION RAG -> Force_Image, ID: {neighbor_id}")
                
                # Retourner le rag_example_id pour lier le PDF au RAG existant, mais sans exemple dans le prompt
                return {
                    "prompt_text": prompt_text,
                    "prompt_rag_used": prompt_rag_used,
                    "found_example": False,  # Pas d'exemple à utiliser dans le prompt
                    "force_image": force_image_from_rag,
                    "rag_example_id": neighbor_id,  # Mais on retourne quand même l'ID pour lier le PDF
                    "example_prompt": ""
                }
        else:
            print(f"⚠️ Aucun voisin trouvé pour le type {document_type}: {result['status']}")
            return {
                "prompt_text": prompt_text,
                "prompt_rag_used": prompt_rag_used,
                "found_example": False,
                "force_image": False,
                "rag_example_id": None,
                "example_prompt": ""
            }
            
    except Exception as e:
        print(f"❌ Erreur lors de la création du prompt d'exemple: {str(e)}")
        # En cas d'erreur, retourner le prompt par défaut
        try:
            from new.new_prompts import get_specific_prompt
            prompt_text_default = get_specific_prompt(document_type, liste_nom_a_eviter or [], parse_or_ocr)
        except:
            prompt_text_default = "Erreur lors de la création du prompt"
        
        return {
            "prompt_text": prompt_text_default,
            "prompt_rag_used": False,
            "found_example": False,
            "force_image": False,
            "rag_example_id": None,
            "example_prompt": ""
        }
