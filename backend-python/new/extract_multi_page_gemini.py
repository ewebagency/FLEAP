import json
from typing import Dict, Any, List, Tuple
import sys
import os
import asyncio

# Ajouter le répertoire parent pour pouvoir importer utils_gemini
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.utils_gemini import extract_gemini


def get_word_occurrences_in_json(json_ocr: Dict) -> List[Tuple[str, int, int]]:
    """
    Parcourt le json_ocr et compte les occurrences de chaque mot.
    Retourne une liste de (mot, page_idx, occurrence_globale)
    
    Args:
        json_ocr: Le JSON OCR avec la structure pages/blocks/lines/words
    
    Returns:
        List de tuples (mot, page_idx, occurrence_dans_tout_le_doc)
    """
    word_occurrences = []
    word_counts = {}  # Pour compter les occurrences globales
    
    pages = json_ocr.get("pages", [])
    
    for page in pages:
        page_idx = page.get("page_idx", 0)
        blocks = page.get("blocks", [])
        
        for block in blocks:
            lines = block.get("lines", [])
            
            for line in lines:
                words = line.get("words", [])
                
                for word_obj in words:
                    word = word_obj.get("value", "").strip()
                    
                    if word:  # Ignorer les mots vides
                        # Incrémenter le compteur global pour ce mot
                        word_counts[word] = word_counts.get(word, 0) + 1
                        current_occurrence = word_counts[word]
                        
                        # Stocker (mot, page_idx, occurrence_globale)
                        word_occurrences.append((word, page_idx, current_occurrence))
    
    return word_occurrences


def find_page_boundaries_in_text(text_for_llm: str, word_occurrences: List[Tuple[str, int, int]], 
                                   json_ocr: Dict) -> Dict[int, int]:
    """
    Trouve les positions de début de chaque page dans text_for_llm.
    
    Args:
        text_for_llm: Le texte enrichi avec layout
        word_occurrences: Liste des (mot, page_idx, occurrence_globale)
        json_ocr: Le JSON OCR original
    
    Returns:
        Dict {page_idx: position_dans_text}
    """
    page_boundaries = {}
    pages = json_ocr.get("pages", [])
    
    # La page 0 commence toujours à 0
    page_boundaries[0] = 0
    
    # Pour chaque page suivante, trouver son premier mot
    for page_idx in range(1, len(pages)):
        # Trouver le premier mot de cette page dans word_occurrences
        first_word_info = None
        for word, page, occurrence in word_occurrences:
            if page == page_idx:
                first_word_info = (word, occurrence)
                break
        
        if not first_word_info:
            print(f"⚠️ Impossible de trouver le premier mot de la page {page_idx}")
            continue
        
        word_to_find, target_occurrence = first_word_info
        
        # Chercher la Nième occurrence de ce mot dans text_for_llm
        current_occurrence = 0
        position = 0
        
        while position < len(text_for_llm):
            found_pos = text_for_llm.find(word_to_find, position)
            
            if found_pos == -1:
                break
            
            current_occurrence += 1
            
            if current_occurrence == target_occurrence:
                page_boundaries[page_idx] = found_pos
                break
            
            position = found_pos + 1
        
        if page_idx not in page_boundaries:
            print(f"⚠️ Impossible de localiser la page {page_idx} dans le texte (mot: '{word_to_find}', occurrence: {target_occurrence})")
    
    return page_boundaries


def split_text_by_pages(text_for_llm: str, page_boundaries: Dict[int, int], 
                        num_pages: int) -> List[Tuple[int, str]]:
    """
    Découpe le texte selon les frontières de pages.
    
    Args:
        text_for_llm: Le texte complet
        page_boundaries: Dict {page_idx: position}
        num_pages: Nombre total de pages
    
    Returns:
        List de tuples (page_idx, texte_de_la_page)
    """
    page_chunks = []
    sorted_pages = sorted(page_boundaries.keys())
    
    for i, page_idx in enumerate(sorted_pages):
        start_pos = page_boundaries[page_idx]
        
        # Trouver la fin : soit le début de la page suivante, soit la fin du texte
        if i + 1 < len(sorted_pages):
            next_page_idx = sorted_pages[i + 1]
            end_pos = page_boundaries[next_page_idx]
        else:
            end_pos = len(text_for_llm)
        
        page_text = text_for_llm[start_pos:end_pos]
        page_chunks.append((page_idx, page_text))
    
    return page_chunks


def add_overlap(page_chunks: List[Tuple[int, str]], overlap_ratio: float = 0.5) -> List[Tuple[int, str]]:
    """
    Ajoute un overlap de la page précédente à chaque page (sauf la première).
    
    Args:
        page_chunks: Liste de (page_idx, texte)
        overlap_ratio: Proportion de la page précédente à inclure (0.5 = 50%)
    
    Returns:
        Liste de (page_idx, texte_avec_overlap)
    """
    chunks_with_overlap = []
    
    for i, (page_idx, page_text) in enumerate(page_chunks):
        if i == 0:
            # Première page : pas d'overlap
            chunks_with_overlap.append((page_idx, page_text))
        else:
            # Pages suivantes : ajouter une partie de la page précédente
            _, prev_page_text = page_chunks[i - 1]
            
            # Calculer le nombre de lignes de la page précédente
            prev_lines = prev_page_text.split('\n')
            num_lines_overlap = int(len(prev_lines) * overlap_ratio)
            
            # Prendre les dernières lignes de la page précédente
            overlap_text = '\n'.join(prev_lines[-num_lines_overlap:]) if num_lines_overlap > 0 else ""
            
            # Construire le texte avec overlap
            text_with_overlap = overlap_text + "\n" + page_text if overlap_text else page_text
            
            chunks_with_overlap.append((page_idx, text_with_overlap))
    
    return chunks_with_overlap


def get_last_entries(response: Dict, num_entries: int = 3) -> Dict:
    """
    Extrait les N dernières entrées (collectes/déchets) d'une réponse.
    Ces entrées peuvent être incomplètes si elles sont coupées entre deux pages.
    
    Args:
        response: La réponse JSON de Gemini
        num_entries: Nombre d'entrées à extraire (par défaut 3)
    
    Returns:
        Dict avec seulement les dernières entrées
    """
    if not response or not isinstance(response, dict):
        return {}
    
    last_entries = {}
    
    # Pour les factures : extraire les dernières collectes
    if "collecte" in response:
        collectes = response.get("collecte", [])
        if isinstance(collectes, list) and collectes:
            last_entries["collecte"] = collectes[-num_entries:]
        elif isinstance(collectes, dict):
            last_entries["collecte"] = collectes
    
    # Pour les bons/bsd : extraire les derniers déchets
    if "dechet" in response:
        dechets = response.get("dechet", [])
        if isinstance(dechets, list) and dechets:
            last_entries["dechet"] = dechets[-num_entries:]
        elif isinstance(dechets, dict):
            last_entries["dechet"] = dechets
    
    return last_entries


def merge_responses(previous_response: Dict, current_response: Dict, num_overlap: int = 3) -> Dict:
    """
    Merge deux réponses en mode sliding window :
    - Garde tous les champs simples (nom_prestataire, etc.) de la réponse actuelle
    - Pour les listes : garde [0:-num_overlap] de previous + toute la current
    
    Args:
        previous_response: Réponse de la page précédente
        current_response: Réponse de la page actuelle (qui inclut déjà les corrections)
        num_overlap: Nombre d'entrées en chevauchement
    
    Returns:
        Réponse mergée
    """
    if not previous_response:
        return current_response
    
    if not current_response:
        return previous_response
    
    merged = dict(current_response)  # Copie de la réponse actuelle
    
    # Merger les collectes (factures)
    if "collecte" in previous_response or "collecte" in current_response:
        prev_collectes = previous_response.get("collecte", [])
        curr_collectes = current_response.get("collecte", [])
        
        # Normaliser en listes
        if not isinstance(prev_collectes, list):
            prev_collectes = [prev_collectes] if prev_collectes else []
        if not isinstance(curr_collectes, list):
            curr_collectes = [curr_collectes] if curr_collectes else []
        
        # Garder [0:-num_overlap] de previous + toute la current
        if len(prev_collectes) > num_overlap:
            merged["collecte"] = prev_collectes[:-num_overlap] + curr_collectes
        else:
            # Si previous a moins d'entrées que num_overlap, prendre juste current
            merged["collecte"] = curr_collectes
    
    # Merger les déchets (bons/bsd)
    if "dechet" in previous_response or "dechet" in current_response:
        prev_dechets = previous_response.get("dechet", [])
        curr_dechets = current_response.get("dechet", [])
        
        # Normaliser en listes
        if not isinstance(prev_dechets, list):
            prev_dechets = [prev_dechets] if prev_dechets else []
        if not isinstance(curr_dechets, list):
            curr_dechets = [curr_dechets] if curr_dechets else []
        
        # Garder [0:-num_overlap] de previous + toute la current
        if len(prev_dechets) > num_overlap:
            merged["dechet"] = prev_dechets[:-num_overlap] + curr_dechets
        else:
            merged["dechet"] = curr_dechets
    
    return merged


def create_multi_page_prompt(base_prompt: str, current_page: int, total_pages: int, 
                              last_entries: Dict = None) -> str:
    """
    Crée le prompt modifié pour le traitement multi-page avec sliding window.
    
    Args:
        base_prompt: Le prompt de base (bon/bsd/facture)
        current_page: Numéro de la page actuelle (0-indexed)
        total_pages: Nombre total de pages
        last_entries: Les dernières entrées de la page précédente (peuvent être incomplètes)
    
    Returns:
        Le prompt modifié
    """
    multi_page_instructions = f"""
IMPORTANT - DOCUMENT MULTI-PAGES :
Ce document contient {total_pages} pages au total.
Tu traites actuellement la page {current_page + 1}/{total_pages}.
"""
    
    if last_entries and current_page > 0:
        # Convertir les dernières entrées en JSON propre
        last_entries_json = json.dumps(last_entries, ensure_ascii=False, indent=2)
        
        multi_page_instructions += f"""
⚠️ CONTEXTE - Dernières entrées de la page précédente (PEUVENT ÊTRE INCOMPLÈTES) :
{last_entries_json}

CONSIGNES IMPORTANTES :
1. Extrais TOUTES les informations de cette page {current_page + 1}
2. Si une collecte/déchet ci-dessus CONTINUE sur cette page, COMPLÈTE-LA avec les nouvelles informations
3. Renvoie un JSON contenant :
   - Les entrées ci-dessus (corrigées/complétées si elles continuent sur cette page)
   - TOUTES les nouvelles entrées de cette page
4. NE PAS inventer d'informations qui ne sont pas sur cette page
5. Si une entrée ci-dessus est complète, garde-la telle quelle

Exemple : Si la dernière collecte ci-dessus a des prestations incomplètes et qu'elles continuent sur cette page, 
renvoie cette collecte avec TOUTES ses prestations (anciennes + nouvelles).
"""
    else:
        multi_page_instructions += """
C'est la première page du document. Extrais normalement toutes les informations.
"""
    
    return multi_page_instructions + "\n\n" + base_prompt


async def extract_gemini_multi_page(raw_text: str, potential_json_from_ocr: Dict, 
                                     prompt: str) -> Dict[str, Any]:
    """
    Extrait les données d'un document multi-page en découpant par pages et en appelant
    Gemini séquentiellement avec agrégation des réponses.
    
    Args:
        raw_text: Le texte enrichi (text_for_llm)
        potential_json_from_ocr: Le JSON OCR contenant les pages et les mots
        prompt: Le prompt de base (bon/bsd/facture)
    
    Returns:
        Dict avec la réponse complète de Gemini (même format que extract_gemini)
    """
    try:
        # 1. Vérifier si on a un json_ocr valide avec des pages
        if not potential_json_from_ocr or "pages" not in potential_json_from_ocr:
            print("⚠️ JSON OCR invalide ou absent -> Fallback sur extract_gemini classique")
            return await extract_gemini(raw_text, prompt)
        
        pages = potential_json_from_ocr.get("pages", [])
        num_pages = len(pages)
        
        # 2. Vérifier si le document a plus de 4 pages
        if num_pages <= 3:
            print(f"📄 Document de {num_pages} pages -> Pas besoin de multi-page processing")
            return await extract_gemini(raw_text, prompt)
        
        print(f"📚 Document de {num_pages} pages -> Activation du mode multi-page")
        
        # 3. Analyser les occurrences de mots dans le JSON OCR
        word_occurrences = get_word_occurrences_in_json(potential_json_from_ocr)
        print(f"🔍 {len(word_occurrences)} mots analysés dans le JSON OCR")
        
        # 4. Trouver les frontières de pages dans le texte
        page_boundaries = find_page_boundaries_in_text(raw_text, word_occurrences, potential_json_from_ocr)
        print(f"📍 Frontières trouvées pour {len(page_boundaries)}/{num_pages} pages")
        
        if len(page_boundaries) < 2:
            print("⚠️ Impossible de trouver les frontières de pages -> Fallback")
            return await extract_gemini(raw_text, prompt)
        
        # 5. Découper le texte par pages
        page_chunks = split_text_by_pages(raw_text, page_boundaries, num_pages)
        print(f"✂️ Texte découpé en {len(page_chunks)} chunks")
        
        # 6. Ajouter les overlaps
        chunks_with_overlap = add_overlap(page_chunks, overlap_ratio=0.5)
        print(f"🔗 Overlaps ajoutés (50% de la page précédente)")
        
        # 7. Traiter page par page avec Gemini en mode sliding window
        aggregated_response = None
        num_overlap_entries = 3  # Nombre d'entrées à chevaucher entre pages
        
        for i, (page_idx, page_text) in enumerate(chunks_with_overlap):
            # Ajouter un délai entre les appels pour éviter le rate limit (sauf pour la première page)
            if i > 0:
                print(f"⏳ Attente de 2 secondes pour éviter le rate limit...")
                await asyncio.sleep(2)
            
            print(f"\n{'='*60}")
            print(f"🧠 Traitement page {page_idx + 1}/{num_pages}")
            print(f"📏 Longueur du texte: {len(page_text)} caractères")
            
            # Extraire les dernières entrées de la page précédente (pour sliding window)
            last_entries = get_last_entries(aggregated_response, num_overlap_entries) if aggregated_response else None
            
            if last_entries:
                print(f"🔗 Overlap : envoi des {num_overlap_entries} dernières entrées de la page précédente")
                if "collecte" in last_entries:
                    print(f"   → {len(last_entries['collecte'])} collectes en overlap")
                if "dechet" in last_entries:
                    print(f"   → {len(last_entries['dechet'])} déchets en overlap")
            
            # Créer le prompt modifié avec sliding window
            modified_prompt = create_multi_page_prompt(
                prompt, 
                page_idx, 
                num_pages, 
                last_entries
            )
            
            # Appeler Gemini
            print(f"🚀 Appel à Gemini...")
            gemini_response = await extract_gemini(page_text, modified_prompt)
            
            print(f"\n📥 RÉPONSE GEMINI PAGE {page_idx + 1}:")
            print(f"{'='*60}")
            
            if "error" in gemini_response:
                print(f"❌ ERREUR Gemini page {page_idx + 1}:")
                print(f"   {gemini_response['error']}")
                print(f"⚠️ On continue avec la réponse agrégée actuelle")
                continue
            
            # Parser la réponse
            try:
                extracted_data = gemini_response.get("extracted_data", "{}")
                
                # Afficher la réponse COMPLÈTE de Gemini
                print(f"📄 JSON COMPLET REÇU:")
                print("-" * 60)
                print(extracted_data)
                print("-" * 60)
                
                page_response = json.loads(extracted_data)
                
                print(f"\n✅ JSON parsé avec succès")
                
                # Afficher un résumé détaillé de la réponse
                if isinstance(page_response, dict):
                    print(f"\n📊 RÉSUMÉ PAGE {page_idx + 1}:")
                    
                    if "nom_prestataire" in page_response:
                        print(f"   • Prestataire: {page_response.get('nom_prestataire', 'N/A')}")
                    if "num_facture" in page_response:
                        print(f"   • N° Facture: {page_response.get('num_facture', 'N/A')}")
                    if "num_bon" in page_response:
                        print(f"   • N° Bon: {page_response.get('num_bon', 'N/A')}")
                    
                    if "collecte" in page_response:
                        collectes = page_response.get("collecte", [])
                        if isinstance(collectes, list):
                            print(f"   • Collectes extraites: {len(collectes)}")
                            for idx, c in enumerate(collectes):
                                num_bon = c.get("num_bon", "N/A")
                                date = c.get("date", "N/A")
                                print(f"      [{idx+1}] Bon {num_bon} - {date}")
                        else:
                            print(f"   • 1 collecte (format dict)")
                    
                    if "dechet" in page_response:
                        dechets = page_response.get("dechet", [])
                        if isinstance(dechets, list):
                            print(f"   • Déchets extraits: {len(dechets)}")
                        else:
                            print(f"   • 1 déchet (format dict)")
                
                # Merger avec la réponse précédente (sliding window)
                if aggregated_response:
                    print(f"\n🔀 MERGE avec la réponse précédente...")
                    prev_count = len(aggregated_response.get("collecte", [])) if isinstance(aggregated_response.get("collecte"), list) else 0
                    curr_count = len(page_response.get("collecte", [])) if isinstance(page_response.get("collecte"), list) else 0
                    
                    aggregated_response = merge_responses(aggregated_response, page_response, num_overlap_entries)
                    
                    merged_count = len(aggregated_response.get("collecte", [])) if isinstance(aggregated_response.get("collecte"), list) else 0
                    print(f"   Avant: {prev_count} collectes")
                    print(f"   Page actuelle: {curr_count} collectes")
                    print(f"   Après merge: {merged_count} collectes")
                else:
                    aggregated_response = page_response
                    print(f"   (Première page, pas de merge)")
                
                print(f"\n✅ Page {page_idx + 1} traitée et mergée avec succès")
                
            except json.JSONDecodeError as e:
                print(f"\n❌ ERREUR PARSING JSON page {page_idx + 1}:")
                print(f"   {str(e)}")
                print(f"\n📄 Données brutes reçues (premiers 500 chars):")
                print(f"   {extracted_data[:500]}...")
                print(f"\n⚠️ On continue avec la réponse agrégée précédente")
                continue
        
        # 8. Retourner la réponse finale
        if aggregated_response is None:
            print("❌ Aucune réponse valide obtenue -> Fallback")
            return await extract_gemini(raw_text, prompt)
        
        print(f"\n{'='*60}")
        print(f"✅ Traitement multi-page terminé avec succès")
        
        # Afficher un résumé de la réponse finale
        if isinstance(aggregated_response, dict):
            print(f"\n📊 RÉSUMÉ DE LA RÉPONSE FINALE:")
            if "nom_prestataire" in aggregated_response:
                print(f"   Prestataire: {aggregated_response.get('nom_prestataire', 'N/A')}")
            if "num_facture" in aggregated_response:
                print(f"   N° Facture: {aggregated_response.get('num_facture', 'N/A')}")
            if "collecte" in aggregated_response:
                collectes = aggregated_response.get("collecte", [])
                if isinstance(collectes, list):
                    print(f"   📦 Nombre total de collectes: {len(collectes)}")
                else:
                    print(f"   📦 1 collecte (format dict)")
            if "dechet" in aggregated_response:
                dechets = aggregated_response.get("dechet", [])
                if isinstance(dechets, list):
                    print(f"   📦 Nombre total de déchets: {len(dechets)}")
            if "montant_total_ht" in aggregated_response:
                print(f"   💰 Montant total HT: {aggregated_response.get('montant_total_ht', 'N/A')}")
        
        final_json = json.dumps(aggregated_response, ensure_ascii=False)
        print(f"\n📏 Taille JSON final: {len(final_json)} caractères")
        
        return {
            "success": True,
            "text": raw_text,
            "extracted_data": final_json
        }
        
    except Exception as e:
        print(f"❌ ERREUR dans extract_gemini_multi_page: {str(e)}")
        print("⚠️ Fallback sur extract_gemini classique")
        return await extract_gemini(raw_text, prompt)

