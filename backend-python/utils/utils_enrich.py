import re
import unicodedata
import math
from typing import Dict, List, Any
from rapidfuzz import fuzz

# Configuration
N_BEST_MATCHES = 10

def sigmoid(x: float):
    """Fonction sigmoid simple."""
    return 1 / (1 + math.exp(-x/100))

def sigmoid100(x: float, centre: float = 0.3, pente: float = 10):
    """Fonction sigmoid normalisée entre 0 et 100."""
    return 100 / (1 + math.exp(-pente * (x - centre)))

def score_group_unordered(similarities: List[float], positions: List[int], 
                         tokens: List[str], gamma: float = 8.0, k: float = 10, 
                         alpha: float = 10, beta: float = 0.5, min_len: int = 2):
    """
    Calcule un score 0–100 basé sur similarités et proximité dans le texte.
    
    Args:
        similarities: Scores de similarité pour chaque mot
        positions: Positions des mots dans le texte
        tokens: Les mots correspondants
        gamma: Paramètre de transformation non-linéaire
        k: Paramètre de proximité
        alpha: Pente de la sigmoid
        beta: Centre de la sigmoid
        min_len: Longueur minimale des mots à considérer
        
    Returns:
        Score global entre 0 et 100
    """
    # Filtrer les mots courts ou numériques
    filtered = [(s, p, t) for s, p, t in zip(similarities, positions, tokens) 
                if len(t) >= min_len and not t.isdigit()]
    
    if not filtered:
        return 0.0

    # Trier par position dans le texte
    items = sorted(filtered, key=lambda x: x[1])

    # Transformation non linéaire des similarités avec pondération longueur
    y = [((s / 100) ** gamma) * min(1.0, len(t) / 5) for s, _, t in items]

    # Facteur de proximité
    prox = []
    for i, (_, pos, _) in enumerate(items):
        weights = []
        if i > 0:
            g = pos - items[i-1][1] - 1
            weights.append(1 / (1 + (g / k) ** 2))
        if i < len(items) - 1:
            g = items[i+1][1] - pos - 1
            weights.append(1 / (1 + (g / k) ** 2))
        prox.append(sum(weights) / len(weights) if weights else 1)

    # Score brut
    C = sum(v * p for v, p in zip(y, prox)) / len(y)
    return sigmoid100(C, centre=beta, pente=alpha)

def clean_text(text: str) -> str:
    """Nettoie un texte en minuscules, sans accents et espaces normalisés."""
    if not text:
        return ""
    
    # Conversion en minuscules et suppression des accents
    text = unicodedata.normalize('NFD', text.lower())
    text = ''.join(c for c in text if not unicodedata.combining(c))
    
    # Remplacement des caractères spéciaux et normalisation des espaces
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    
    return text.strip()

def find_best_names_in_text(text: str, names: List[str]):
    """
    Trouve les meilleurs noms correspondants dans un texte.
    
    Utilise une approche sophistiquée :
    1. Compare directement le nom complet avec le texte
    2. Divise en mots et trouve les meilleures correspondances individuelles
    3. Utilise score_group_unordered pour combiner les résultats
    
    Args:
        text: Le texte à analyser
        names: Liste des noms à rechercher
        
    Returns:
        Liste des meilleures correspondances avec leurs scores
    """
    if not text or not names:
        return []
    
    clean_text_content = clean_text(text)
    best_matches = []
    
    for name in names:
        if not name:
            continue
        
        # 1. Comparaison directe du nom complet
        full_name_score = fuzz.WRatio(clean_text(name), clean_text_content)
        
        # 2. Diviser le nom en mots et analyser chaque mot
        name_words = clean_text(name).split()
        word_scores = []
        word_positions = []
        word_tokens = []
        
        for word in name_words:
            if len(word) < 3:  # Ignorer les mots trop courts
                continue
            
            # Trouver la meilleure correspondance pour ce mot dans le texte
            best_word_score = 0
            best_word_position = 0
            
            # Sliding window pour trouver la meilleure position
            for i in range(len(clean_text_content) - len(word) + 1):
                window = clean_text_content[i:i + len(word)]
                score = fuzz.WRatio(word, window)
                
                if score > best_word_score:
                    best_word_score = score
                    best_word_position = i
            
            # Ne garder que les mots avec un score significatif
            if best_word_score > 50:  # Seuil minimum
                word_scores.append(best_word_score)
                word_positions.append(best_word_position)
                word_tokens.append(word)
        
        # 3. Calculer le score final avec score_group_unordered
        final_score = 0
        if word_scores:
            # Utiliser score_group_unordered pour les mots trouvés
            group_score = score_group_unordered(word_scores, word_positions, word_tokens)
            
            # Combiner avec le score du nom complet
            # Poids: 40% nom complet, 60% analyse par mots
            final_score = (full_name_score * 0.4) + (group_score * 0.6)
        else:
            # Si aucun mot significatif trouvé, utiliser seulement le score du nom complet
            final_score = full_name_score * 0.4
        
        best_matches.append({
            'name': name,
            'score': final_score,
            'full_name_score': full_name_score,
            'word_scores': word_scores,
            'word_positions': word_positions,
            'word_tokens': word_tokens
        })
    
    # Trier par score décroissant et limiter les résultats
    best_matches.sort(key=lambda x: x['score'], reverse=True)
    return best_matches[:N_BEST_MATCHES]

def extract_entities_from_text(text: str, known_data: Dict[str, List[Any]]):
    """
    Extrait les noms des entités (sites, prestataires) d'un texte.
    
    Args:
        text: Le texte à analyser
        known_data: Dictionnaire avec 'sites' et 'prestataires'
        
    Returns:
        Dictionnaire avec les noms des entités trouvées par catégorie
    """
    results = {
        'sites': [],
        'prestataires': []
    }
    
    # Extraction des noms de sites
    if 'sites' in known_data:
        site_names = [site['nom'] for site in known_data['sites'] if site.get('nom')]
        if site_names:
            site_matches = find_best_names_in_text(text, site_names)
            # Prendre les N_BEST_MATCHES premiers (sans filtrage par seuil)
            results['sites'] = [match['name'] for match in site_matches]
            print(f"\n🏆 TOP {len(results['sites'])} SITES:")
            for site in results['sites']:
                print(f"  - {site}")
    
    # Extraction des noms de prestataires
    if 'prestataires' in known_data:
        prestataire_names = [p['nomBoite'] for p in known_data['prestataires'] if p.get('nomBoite')]
        if prestataire_names:
            prestataire_matches = find_best_names_in_text(text, prestataire_names)
            # Prendre les N_BEST_MATCHES premiers (sans filtrage par seuil)
            results['prestataires'] = [match['name'] for match in prestataire_matches]
            print(f"\n🏆 TOP {len(results['prestataires'])} PRESTATAIRES:")
            for prestataire in results['prestataires']:
                print(f"  - {prestataire}")
    
    return results

def enrich_text(text: str, known_data: Dict[str, List[Any]]):
    """
    Enrichit un texte avec les entités reconnues de la base de données.
    
    Args:
        text: Le texte original
        known_data: Base de données des entités connues
        
    Returns:
        Texte enrichi avec les correspondances trouvées
    """
    # Extraire les noms des entités trouvées
    entities = extract_entities_from_text(text, known_data)
    
    # Construire le texte enrichi
    enriched = text + "\n\n"
    enriched += "Entités reconnues notre BDD, si un des noms te semble correspondre à un site ou un prestataire, tu dois utiliser celui là, sinon tu peux utiliser le nom que tu as trouvé :\n"
    
    if entities['sites']:
        enriched += f"Sites: {', '.join(entities['sites'])}\n"
    
    if entities['prestataires']:
        enriched += f"Prestataires: {', '.join(entities['prestataires'])}\n"
    
    if not any(entities.values()):
        enriched += "Aucune entité reconnue.\n"
    
    #print("=="*60, "\n", enriched, "\n", "=="*60)
    return enriched