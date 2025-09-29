import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from typing import Tuple, Optional, List, Dict, Any

# Seuils de similarité
SEUIL_MIN_MATCH = 0.43
SEUIL_MAX_NON_MATCH = 0.18

def calculate_tfidf_similarity(text1: str, text2: str):
    """
    Calcule la similarité TF-IDF entre deux textes.
    Returns: Score de similarité entre 0 et 1
    """
    # Vectorisation TF-IDF
    vectorizer = TfidfVectorizer()
    tfidf_matrix = vectorizer.fit_transform([text1, text2])
    
    # Calcul de la similarité cosinus
    similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
    
    return float(similarity)

def find_closest_neighbor(subject_text: str, neighbor_texts: List[str], neighbor_ids: Optional[List[Any]] = None):
    """
    Trouve le voisin le plus proche d'un texte sujet dans une liste de textes voisins.
    """
    if not neighbor_texts:
        return {
            'found': False,
            'neighbor_id': None,
            'similarity_score': 0.0,
            'status': 'Aucun voisin fourni'
        }
    
    # Si pas d'IDs fournis, utiliser les indices
    if neighbor_ids is None:
        neighbor_ids = list(range(len(neighbor_texts)))
    
    if len(neighbor_texts) != len(neighbor_ids):
        raise ValueError("Le nombre de textes voisins doit correspondre au nombre d'IDs")
    
    # Calcul des similarités avec tous les voisins
    similarities = []
    for neighbor_text in neighbor_texts:
        similarity = calculate_tfidf_similarity(subject_text, neighbor_text)
        similarities.append(similarity)
    
    # Trouver le meilleur score et son index
    best_score = max(similarities)
    best_index = similarities.index(best_score)
    best_neighbor_id = neighbor_ids[best_index]
    
    # Déterminer le statut selon les seuils
    if best_score >= SEUIL_MIN_MATCH:
        status = "Voisin trouvé (score élevé)"
        found = True
    elif best_score <= SEUIL_MAX_NON_MATCH:
        status = "Aucun voisin trouvé (score trop faible)"
        found = False
    else:
        status = "Voisin potentiel (score intermédiaire)"
        found = False
    
    return {
        'found': found,
        'neighbor_id': best_neighbor_id if found else None,
        'similarity_score': best_score,
        'status': status
    }