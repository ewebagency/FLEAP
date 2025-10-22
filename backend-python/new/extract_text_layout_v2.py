import tempfile
import os
import pdfplumber
from typing import Dict, List, Tuple
from new.extract_utils.ocr import ocr_this
from PIL import Image, ImageDraw, ImageFont
import fitz  # PyMuPDF
import io


async def extract_text_with_grid_for_llm(file, spacing_factor: float = 0.02, force_ocr: bool = False) -> Tuple[str, Dict, str]:
    """
    Fonction principale pour extraire le texte formaté pour LLM.
    Détecte les tableaux et formate avec grille.
    
    Compatible avec get_raw_text_from_pdf : retourne (raw_text, json_ocr, method)
    
    Args:
        file: Fichier PDF
        spacing_factor: Facteur d'espacement
        force_ocr: Si True, force l'utilisation de l'OCR (défaut False)
        
    Returns:
        Tuple contenant:
        - raw_text (str): Texte formaté avec grille de tableau, prêt pour LLM
        - potential_json_from_ocr (dict): JSON OCR avec bounding boxes
        - parse_or_ocr (str): Méthode utilisée ("ocr" ou "parse")
    """
    try:
        method = "ocr"
        
        if not force_ocr:
            # Tenter d'abord le parsing
            try:
                print("🔄 Tentative de parsing...")
                text, json_data = await parse_pdf_with_boxes(file)
                method = "parse"
                print(f"✅ Parsing réussi - {len(text)} caractères")
            except Exception as e:
                print(f"❌ Parsing échoué: {str(e)}, passage à l'OCR...")
                await file.seek(0)
                print("🔄 OCR en cours...")
                text, json_data = await ocr_this(file)
                method = "ocr"
                print(f"✅ OCR terminé - {len(text)} caractères")
        else:
            # Force OCR
            print("🔄 OCR forcé...")
            text, json_data = await ocr_this(file)
            print(f"✅ OCR terminé - {len(text)} caractères")
        
        # Extraire les mots originaux
        all_words = []
        for page in json_data.get("pages", []):
            for block in page.get("blocks", []):
                for line in block.get("lines", []):
                    for word in line.get("words", []):
                        geom = word.get("geometry", None)
                        if geom and isinstance(geom, (list, tuple)) and len(geom) == 2:
                            pt1, pt2 = geom
                            if isinstance(pt1, (list, tuple)) and isinstance(pt2, (list, tuple)):
                                all_words.append({
                                    "text": word.get("value", ""),
                                    "x0": pt1[0],
                                    "y0": pt1[1],
                                    "x1": pt2[0],
                                    "y1": pt2[1]
                                })
        
        print(f"📊 {len(all_words)} mots extraits")
        
        # Fusionner les mots proches
        merged_words = merge_close_words_horizontally(all_words, distance_threshold=0.015)
        print(f"🔗 {len(merged_words)} mots après fusion générale")
        
        # Filtrer les nombres
        numeric_words = [w for w in all_words if is_numeric_value(w["text"])]
        print(f"🔢 {len(numeric_words)} mots numériques trouvés")
        
        # Fusionner les chiffres proches (milliers)
        numeric_merged = merge_close_numbers(numeric_words, h_gap_threshold=0.01)
        print(f"🔗 {len(numeric_merged)} nombres après fusion des milliers")
        
        # Détecter les tableaux par convolution
        tables = detect_tables_by_convolution(numeric_merged)
        tables = filter_tables_with_text(tables, all_words)
        
        print(f"✅ {len(tables)} tableau(x) détecté(s) et validé(s)")
        
        # Formater le texte avec grille
        text_for_llm = format_text_with_table_grid(merged_words, all_words, tables, spacing_factor)
        
        print(f"📄 Texte final généré: {len(text_for_llm)} caractères")
        
        if not text_for_llm or len(text_for_llm) == 0:
            print(f"⚠️ Texte vide, utilisation du formatage simple...")
            # Fallback : formatage simple si vide
            lines = []
            for word in sorted(merged_words, key=lambda w: ((w["y0"] + w["y1"]) / 2, w["x0"])):
                indent = int(word["x0"] / spacing_factor)
                lines.append(" " * indent + word["text"])
            text_for_llm = "\n".join(lines)
        
        # Retourner le même format que get_raw_text_from_pdf
        # (raw_text, potential_json_from_ocr, parse_or_ocr)
        return text_for_llm, json_data, method
        
    except Exception as e:
        print(f"❌ Erreur: {str(e)}")
        raise e


async def parse_pdf_with_boxes(file) -> Tuple[str, Dict]:
    """
    Parse un PDF et extrait le texte avec les bounding boxes.
    
    Returns:
        Tuple (text, json_data)
        json_data contient la structure avec les positions des mots
    """
    try:
        # Sauvegarder temporairement le fichier
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        await file.seek(0)
        
        # Extraire le texte et les positions avec pdfplumber
        json_data = {"pages": []}
        full_text = ""
        
        with pdfplumber.open(tmp_path) as pdf:
            for page_num, page in enumerate(pdf.pages):
                page_width = page.width
                page_height = page.height
                
                words = page.extract_words()
                
                if not words:
                    raise Exception("Aucun mot extrait, passage à l'OCR")
                
                # Convertir en format compatible OCR (2 points comme DocTR, pas 4)
                page_words = []
                for word in words:
                    x0_norm = word["x0"] / page_width
                    y0_norm = word["top"] / page_height
                    x1_norm = word["x1"] / page_width
                    y1_norm = word["bottom"] / page_height
                    
                    page_words.append({
                        "value": word["text"],
                        "confidence": 1.0,
                        "geometry": [
                            [x0_norm, y0_norm],  # top-left (coin haut-gauche)
                            [x1_norm, y1_norm]   # bottom-right (coin bas-droit)
                        ]
                    })
                    full_text += word["text"] + " "
                
                # Grouper les mots en lignes et blocs (simple, par Y)
                blocks = group_words_into_blocks_simple(page_words)
                
                json_data["pages"].append({
                    "page_idx": page_num,
                    "dimensions": [page_width, page_height],
                    "blocks": blocks
                })
                full_text += "\n"
        
        os.unlink(tmp_path)
        
        if not full_text.strip():
            raise Exception("Aucun texte extrait")
        
        return full_text, json_data
    
    except Exception as e:
        if 'tmp_path' in locals() and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise e


def group_words_into_blocks_simple(words: List[Dict], y_threshold: float = 0.02) -> List[Dict]:
    """
    Regroupe les mots en lignes puis en blocs de manière simple.
    Utilise un seuil Y plus intelligent basé sur la hauteur des mots.
    """
    if not words:
        return []
    
    # Extraire Y moyen et hauteur de chaque mot
    words_with_y = []
    heights = []
    
    for word in words:
        geom = word["geometry"]
        y_coords = [pt[1] for pt in geom]
        y_min = min(y_coords)
        y_max = max(y_coords)
        y_avg = (y_min + y_max) / 2
        height = y_max - y_min
        
        words_with_y.append({
            "word": word,
            "y": y_avg,
            "y_min": y_min,
            "y_max": y_max,
            "height": height
        })
        heights.append(height)
    
    # Calculer la hauteur médiane des mots
    if heights:
        heights.sort()
        median_height = heights[len(heights) // 2]
        # Le seuil pour regrouper doit être proportionnel à la hauteur des caractères
        # On utilise 0.5x la hauteur médiane comme seuil
        adaptive_threshold = max(median_height * 0.5, 0.01)
    else:
        adaptive_threshold = y_threshold
    
    # Trier par Y (position haute d'abord)
    words_with_y.sort(key=lambda w: (w["y_min"], w["y"]))
    
    # Grouper en lignes en utilisant le CHEVAUCHEMENT vertical des bounding boxes
    lines = []
    used_indices = set()
    
    if not words_with_y:
        return [{"lines": []}]
    
    for i, item in enumerate(words_with_y):
        if i in used_indices:
            continue
        
        # Créer une nouvelle ligne avec ce mot
        current_line = [item]
        used_indices.add(i)
        
        # Debug : log pour le premier mot de chaque ligne
        first_word_text = item["word"].get("value", "")
        if i < 10:  # Seulement les 10 premières lignes
            print(f"      🆕 Nouvelle ligne #{len(lines)}: commence avec '{first_word_text}' (y_min={item['y_min']:.4f}, y_max={item['y_max']:.4f})")
        
        # Trouver tous les autres mots qui se chevauchent verticalement
        for j, other in enumerate(words_with_y):
            if j in used_indices or j <= i:
                continue
            
            # Vérifier le chevauchement vertical entre ce mot et TOUS les mots de la ligne actuelle
            has_overlap = False
            for line_item in current_line:
                # Deux mots sont sur la même ligne si leurs bounding boxes se chevauchent verticalement
                # OU si la distance entre eux est très petite (< seuil adaptatif)
                overlap = min(line_item["y_max"], other["y_max"]) - max(line_item["y_min"], other["y_min"])
                vertical_distance = abs(line_item["y"] - other["y"])
                
                # Debug pour comprendre pourquoi certains mots ne sont pas regroupés
                if i == 0 and j < 5:  # Debug première ligne et premiers mots
                    other_text = other["word"].get("value", "")
                    print(f"         Comparaison avec '{other_text}': overlap={overlap:.4f}, dist={vertical_distance:.4f}, threshold={adaptive_threshold:.4f}")
                
                if overlap > 0 or vertical_distance <= adaptive_threshold:
                    has_overlap = True
                    break
            
            if has_overlap:
                current_line.append(other)
                used_indices.add(j)
                if i < 3 and len(current_line) <= 5:  # Debug premières lignes
                    added_word = other["word"].get("value", "")
                    print(f"         ✓ Ajouté '{added_word}' à la ligne")
        
        # Trier les mots de la ligne par X et ajouter à la liste
        line_words = [item["word"] for item in current_line]
        line_words.sort(key=lambda w: w["geometry"][0][0])
        lines.append({"words": line_words, "geometry": []})
    
    print(f"      📄 {len(words)} mots regroupés en {len(lines)} ligne(s) (méthode chevauchement vertical)")
    
    # Pour simplifier, on met toutes les lignes dans un seul bloc
    return [{"lines": lines}]


def format_text_with_table_grid(merged_words: List[Dict], all_words: List[Dict], tables: List[Dict], spacing_factor: float = 0.02) -> str:
    """
    Formate TOUT le texte de la page :
    - Zones de tableau : avec grille et pipes "|"
    - Zones hors tableau : avec espacement proportionnel
    
    Args:
        merged_words: Mots fusionnés
        all_words: Mots originaux (pour détecter les alignements)
        tables: Tableaux détectés avec leurs grilles
        spacing_factor: Pour les zones hors tableau
        
    Returns:
        Texte formaté complet (tableaux + texte normal)
    """
    print(f"      📝 Formatage du texte complet (tableaux + zones normales)...")
    print(f"         Entrée: {len(merged_words)} mots fusionnés, {len(tables)} tableaux")
    
    result_lines = []
    
    # Trier tous les mots fusionnés par Y puis X
    all_merged_sorted = sorted(merged_words, key=lambda w: ((w["y0"] + w["y1"]) / 2, w["x0"]))
    
    # Si pas de tableau, formatage simple pour toute la page
    if not tables:
        print(f"      ⚠️ Aucun tableau détecté, formatage simple")
        for word in all_merged_sorted:
            # Format simple avec indentation proportionnelle
            indent = int(word["x0"] / spacing_factor)
            result_lines.append(" " * indent + word["text"])
        
        final_text = "\n".join(result_lines)
        print(f"      ✅ Texte simple généré: {len(final_text)} caractères")
        return final_text
    
    # Stocker les lignes avec leur position Y pour tri final
    all_lines_with_position = []
    
    # Pour chaque tableau détecté
    for table_idx, table_info in enumerate(tables):
        bbox = table_info["bbox"]
        
        # Récupérer les mots numériques originaux dans ce tableau
        original_numeric_in_table = []
        for word in all_words:
            word_x_center = (word["x0"] + word["x1"]) / 2
            word_y_center = (word["y0"] + word["y1"]) / 2
            
            if (bbox["x_min"] <= word_x_center <= bbox["x_max"] and
                bbox["y_min"] <= word_y_center <= bbox["y_max"]):
                
                if is_numeric_value(word["text"]):
                    original_numeric_in_table.append(word)
        
        # Détecter les alignements (grille)
        grid_lines = detect_table_grid_lines(original_numeric_in_table, align_tolerance=0.01)
        
        v_lines = grid_lines["v_lines"]  # Lignes verticales (gauches des cellules)
        h_lines_top = grid_lines["h_lines_top"]  # Lignes horizontales (hauts des cellules)
        h_lines_bottom = grid_lines["h_lines_bottom"]  # Lignes horizontales (bas des cellules)
        
        print(f"      📐 Tableau #{table_idx + 1}: {len(v_lines)} colonnes, {len(h_lines_top)} lignes top, {len(h_lines_bottom)} lignes bottom")
        
        if not h_lines_top or not v_lines:
            continue
        
        # NOUVELLE LOGIQUE : Apparier chaque h_line_top avec son h_line_bottom
        # Pour chaque top, trouver le bottom le plus proche (juste après)
        h_zones = []  # Liste de tuples (h_top, h_bottom, y_center)
        
        for h_top in h_lines_top:
            # Trouver le bottom le plus proche qui vient APRÈS ce top
            matching_bottom = None
            min_distance = float('inf')
            
            for h_bottom in h_lines_bottom:
                if h_bottom > h_top:  # Doit être après le top
                    distance = h_bottom - h_top
                    if distance < min_distance:
                        min_distance = distance
                        matching_bottom = h_bottom
            
            # Si pas de bottom trouvé, utiliser le top + une petite marge
            if matching_bottom is None:
                matching_bottom = h_top + 0.01
            
            y_center = (h_top + matching_bottom) / 2
            h_zones.append((h_top, matching_bottom, y_center))
        
        print(f"      📏 {len(h_zones)} zones H créées (paires top-bottom)")
        
        # Créer un dictionnaire pour stocker les mots par zone
        words_by_zone = {i: [] for i in range(len(h_zones))}
        orphan_words = []  # Mots sans intersection avec aucune zone
        
        # Pour chaque mot fusionné, trouver la zone avec la plus grande intersection verticale
        for word in merged_words:
            word_y0 = word["y0"]
            word_y1 = word["y1"]
            
            # Vérifier si le mot est dans la zone horizontale du tableau (avec marge pour texte avant)
            # On prend TOUS les mots, pas seulement ceux dans la zone X du tableau
            # Cela permet de capturer le texte descriptif à gauche
            if word_y1 < bbox["y_min"] or word_y0 > bbox["y_max"]:
                continue
            
            # Calculer l'intersection avec chaque zone [h_top, h_bottom]
            max_intersection = 0
            best_zone_idx = None
            
            for zone_idx, (h_top, h_bottom, _) in enumerate(h_zones):
                # Intersection = chevauchement vertical entre [word_y0, word_y1] et [h_top, h_bottom]
                intersection_y0 = max(word_y0, h_top)
                intersection_y1 = min(word_y1, h_bottom)
                intersection = max(0, intersection_y1 - intersection_y0)
                
                if intersection > max_intersection:
                    max_intersection = intersection
                    best_zone_idx = zone_idx
            
            # Assigner le mot à la meilleure zone ou marquer comme orphelin
            if best_zone_idx is not None and max_intersection > 0:
                words_by_zone[best_zone_idx].append(word)
            else:
                # Mot orphelin : pas d'intersection avec aucune zone
                orphan_words.append(word)
        
        print(f"      👻 {len(orphan_words)} mots orphelins (sans intersection avec les zones H)")
        
        # Grouper les mots orphelins par Y (mots proches verticalement = même ligne)
        orphan_groups = []
        if orphan_words:
            # Trier les orphelins par Y
            orphan_words.sort(key=lambda w: (w["y0"] + w["y1"]) / 2)
            
            current_group = [orphan_words[0]]
            current_y_avg = (orphan_words[0]["y0"] + orphan_words[0]["y1"]) / 2
            
            for word in orphan_words[1:]:
                word_y_avg = (word["y0"] + word["y1"]) / 2
                
                # Si proche du groupe actuel (tolérance 0.01), ajouter au groupe
                if abs(word_y_avg - current_y_avg) < 0.01:
                    current_group.append(word)
                    # Mettre à jour la moyenne du groupe
                    current_y_avg = sum((w["y0"] + w["y1"]) / 2 for w in current_group) / len(current_group)
                else:
                    # Nouveau groupe
                    orphan_groups.append({
                        "words": current_group,
                        "y_avg": current_y_avg
                    })
                    current_group = [word]
                    current_y_avg = word_y_avg
            
            # Ajouter le dernier groupe
            if current_group:
                orphan_groups.append({
                    "words": current_group,
                    "y_avg": current_y_avg
                })
        
        print(f"      📦 {len(orphan_groups)} groupes orphelins créés")
        
        # Maintenant formater chaque zone qui a des mots
        for zone_idx, (h_top, h_bottom, y_center) in enumerate(h_zones):
            words_in_row = words_by_zone[zone_idx]
            
            if not words_in_row:
                continue
            
            # Trier les mots de la rangée par X
            words_in_row.sort(key=lambda w: w["x0"])
            
            # Séparer : texte avant tableau vs colonnes du tableau
            text_before = []
            words_in_columns = []
            
            for word in words_in_row:
                word_x = word["x0"]
                
                # Si avant la première colonne, c'est du texte descriptif
                if word_x < v_lines[0] - 0.02:  # Marge de 2%
                    text_before.append(word["text"])
                else:
                    # Sinon, c'est dans une colonne du tableau
                    words_in_columns.append(word)
            
            # Assigner les mots aux colonnes (colonne la plus proche)
            columns = [""] * len(v_lines)
            
            for word in words_in_columns:
                word_x = word["x0"]
                
                # Trouver la colonne la plus proche
                closest_col = 0
                min_dist = abs(word_x - v_lines[0])
                
                for col_idx, v_line in enumerate(v_lines):
                    dist = abs(word_x - v_line)
                    if dist < min_dist:
                        min_dist = dist
                        closest_col = col_idx
                
                # Ajouter à cette colonne
                if columns[closest_col]:
                    columns[closest_col] += " " + word["text"]
                else:
                    columns[closest_col] = word["text"]
            
            # Formater la ligne
            if text_before or any(columns):
                line_text = ""
                
                # Texte descriptif avant
                if text_before:
                    line_text = " ".join(text_before)
                
                # Colonnes
                if any(columns):
                    col_text = " | ".join(col if col else "" for col in columns)
                    if line_text:
                        line_text += " | " + col_text
                    else:
                        line_text = col_text
                
                # Stocker avec position Y pour tri final (utiliser le centre de la zone)
                all_lines_with_position.append((y_center, line_text))
        
        # Formater les groupes orphelins (mots sans intersection avec les zones)
        for orphan_group in orphan_groups:
            orphan_words_list = orphan_group["words"]
            orphan_y_avg = orphan_group["y_avg"]
            
            # Trier les mots par X
            orphan_words_list.sort(key=lambda w: w["x0"])
            
            # Séparer : texte avant tableau vs colonnes du tableau
            text_before = []
            words_in_columns = []
            
            for word in orphan_words_list:
                word_x = word["x0"]
                
                # Si avant la première colonne, c'est du texte descriptif
                if word_x < v_lines[0] - 0.02:  # Marge de 2%
                    text_before.append(word["text"])
                else:
                    # Sinon, c'est dans une colonne du tableau
                    words_in_columns.append(word)
            
            # Assigner les mots aux colonnes (colonne la plus proche)
            columns = [""] * len(v_lines)
            
            for word in words_in_columns:
                word_x = word["x0"]
                
                # Trouver la colonne la plus proche
                closest_col = 0
                min_dist = abs(word_x - v_lines[0])
                
                for col_idx, v_line in enumerate(v_lines):
                    dist = abs(word_x - v_line)
                    if dist < min_dist:
                        min_dist = dist
                        closest_col = col_idx
                
                # Ajouter à cette colonne
                if columns[closest_col]:
                    columns[closest_col] += " " + word["text"]
                else:
                    columns[closest_col] = word["text"]
            
            # Formater la ligne orpheline
            if text_before or any(columns):
                line_text = ""
                
                # Texte descriptif avant
                if text_before:
                    line_text = " ".join(text_before)
                
                # Colonnes
                if any(columns):
                    col_text = " | ".join(col if col else "" for col in columns)
                    if line_text:
                        line_text += " | " + col_text
                    else:
                        line_text = col_text
                
                # Stocker avec position Y (utiliser le y_avg du groupe)
                all_lines_with_position.append((orphan_y_avg, line_text))
    
    print(f"      ✅ {len(all_lines_with_position)} lignes générées pour les tableaux (incluant orphelins)")
    
    # Maintenant ajouter le texte HORS des tableaux
    # Marquer les zones de tableau pour savoir quels mots ont été traités
    table_zones = []
    for table in tables:
        table_zones.append(table["bbox"])
    
    # Filtrer les mots qui ne sont PAS dans les tableaux
    # IMPORTANT : On retire TOUS les mots dont le Y se chevauche avec une zone de tableau
    words_outside_tables = []
    for word in all_merged_sorted:
        word_y_center = (word["y0"] + word["y1"]) / 2
        
        is_in_table = False
        for bbox in table_zones:
            # Vérifier si le Y du mot est dans la zone Y du tableau
            if bbox["y_min"] <= word_y_center <= bbox["y_max"]:
                is_in_table = True
                break
        
        if not is_in_table:
            words_outside_tables.append(word)
    
    print(f"      📝 {len(words_outside_tables)} mots hors tableaux à formater")
    
    # Regrouper les mots hors tableaux en lignes avec CHEVAUCHEMENT VERTICAL (même algo que les tableaux)
    if words_outside_tables:
        # Calculer la hauteur médiane pour le seuil adaptatif
        heights = [w["y1"] - w["y0"] for w in words_outside_tables]
        if heights:
            heights.sort()
            median_height = heights[len(heights) // 2]
            adaptive_threshold = max(median_height * 0.5, 0.01)
        else:
            adaptive_threshold = 0.02
        
        # Préparer les mots avec leurs infos Y
        words_with_y = []
        for word in words_outside_tables:
            words_with_y.append({
                "word": word,
                "y_min": word["y0"],
                "y_max": word["y1"],
                "y": (word["y0"] + word["y1"]) / 2
            })
        
        # Trier par Y
        words_with_y.sort(key=lambda w: (w["y_min"], w["y"]))
        
        # Grouper par CHEVAUCHEMENT vertical (pas par proximité absolue)
        lines_outside = []
        used_indices = set()
        
        for i, item in enumerate(words_with_y):
            if i in used_indices:
                continue
            
            # Créer une nouvelle ligne
            line_words = [item["word"]]
            used_indices.add(i)
            
            # Chercher tous les autres mots qui se chevauchent verticalement
            for j in range(i + 1, len(words_with_y)):
                if j in used_indices:
                    continue
                
                other = words_with_y[j]
                
                # Calculer le chevauchement vertical
                overlap_top = max(item["y_min"], other["y_min"])
                overlap_bottom = min(item["y_max"], other["y_max"])
                overlap = max(0, overlap_bottom - overlap_top)
                
                # Si chevauchement > 0, c'est la même ligne
                if overlap > 0:
                    line_words.append(other["word"])
                    used_indices.add(j)
            
            # Trier les mots de la ligne par X
            line_words.sort(key=lambda w: w["x0"])
            
            # Formater la ligne avec espacement proportionnel
            line_text = ""
            for i, w in enumerate(line_words):
                if i == 0:
                    indent = int(w["x0"] / spacing_factor)
                    line_text = " " * indent + w["text"]
                else:
                    gap = w["x0"] - line_words[i-1]["x1"]
                    n_spaces = max(1, int(gap / spacing_factor))
                    line_text += " " * n_spaces + w["text"]
            
            # Stocker avec position Y (moyenne de la ligne)
            line_y_avg = sum(w["y0"] + w["y1"] for w in line_words) / (2 * len(line_words))
            all_lines_with_position.append((line_y_avg, line_text))
    
    print(f"      📝 {len(words_outside_tables)} mots hors tableaux → {len([l for l in all_lines_with_position if l[0] < 10])} lignes normales")
    print(f"      📊 Total: {len(all_lines_with_position)} lignes (tableaux + normales)")
    
    # Trier TOUTES les lignes par position Y pour reconstituer l'ordre naturel
    all_lines_with_position.sort(key=lambda x: x[0])
    
    # Extraire juste le texte (sans la position Y)
    final_text = "\n".join(line_text for y_pos, line_text in all_lines_with_position)
    
    print(f"      ✅ Texte final: {len(final_text)} caractères")
    
    return final_text


async def visualize_ocr_boxes_comparison(file, force_ocr: bool = False) -> bytes:
    """
    Crée une image combinée (côte à côte) montrant :
    - Gauche : Mots originaux de l'OCR/parsing (rectangles verts)
    - Droite : Mots après regroupement horizontal (rectangles bleus)
    - Droite : Tableaux détectés avec grille (lignes jaunes)
    
    Args:
        force_ocr: Si True, force l'OCR même si le parsing fonctionne
    
    Returns:
        bytes: Image PNG combinée
    """
    # Sauvegarder temporairement le fichier
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    await file.seek(0)
    
    try:
        # Tenter parsing ou OCR selon le paramètre
        if not force_ocr:
            try:
                text, json_data = await parse_pdf_with_boxes(file)
                method = "parse"
            except Exception as e:
                await file.seek(0)
                text, json_data = await ocr_this(file)
                method = "ocr"
        else:
            text, json_data = await ocr_this(file)
            method = "ocr"
        
        # Convertir le PDF en image avec PyMuPDF (première page seulement)
        pdf_document = fitz.open(tmp_path)
        
        if len(pdf_document) == 0:
            raise Exception("PDF vide")
        
        # Récupérer la première page
        page = pdf_document[0]
        
        # Convertir en image (matrice de pixels)
        mat = fitz.Matrix(2, 2)
        pix = page.get_pixmap(matrix=mat)
        
        # Convertir en PIL Image
        base_img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        
        pdf_document.close()
        
        img_width, img_height = base_img.size
        
        # Extraire les bounding boxes de la première page
        page_data = json_data.get("pages", [])[0] if json_data.get("pages") else None
        
        if not page_data:
            raise Exception("Aucune donnée OCR trouvée")
        
        # Extraire tous les mots avec leurs positions
        all_words = []
        for block in page_data.get("blocks", []):
            for line in block.get("lines", []):
                for word in line.get("words", []):
                    geom = word.get("geometry", None)
                    word_text = word.get("value", "")
                    
                    if geom and isinstance(geom, (list, tuple)) and len(geom) == 2:
                        pt1, pt2 = geom
                        if isinstance(pt1, (list, tuple)) and isinstance(pt2, (list, tuple)):
                            all_words.append({
                                "text": word_text,
                                "x0": pt1[0],
                                "y0": pt1[1],
                                "x1": pt2[0],
                                "y1": pt2[1]
                            })
        
        # IMAGE 1 : Mots originaux
        img1 = base_img.copy()
        draw1 = ImageDraw.Draw(img1)
        
        for word_info in all_words:
            x0_pixel = int(word_info["x0"] * img_width)
            y0_pixel = int(word_info["y0"] * img_height)
            x1_pixel = int(word_info["x1"] * img_width)
            y1_pixel = int(word_info["y1"] * img_height)
            
            # Dessiner rectangle vert
            draw1.rectangle(
                [(x0_pixel, y0_pixel), (x1_pixel, y1_pixel)],
                outline="green",
                width=2
            )
        
        # IMAGE 2 : Mots après regroupement horizontal
        merged_words = merge_close_words_horizontally(all_words, distance_threshold=0.015)
        
        img2 = base_img.copy()
        draw2 = ImageDraw.Draw(img2)
        
        for merged_info in merged_words:
            x0_pixel = int(merged_info["x0"] * img_width)
            y0_pixel = int(merged_info["y0"] * img_height)
            x1_pixel = int(merged_info["x1"] * img_width)
            y1_pixel = int(merged_info["y1"] * img_height)
            
            # Dessiner rectangle bleu
            draw2.rectangle(
                [(x0_pixel, y0_pixel), (x1_pixel, y1_pixel)],
                outline="blue",
                width=3
            )
            
            # Afficher le texte fusionné
            try:
                draw2.text((x0_pixel, y0_pixel - 15), merged_info["text"][:20], fill="red")
            except:
                pass
        
        # IMAGE 3 : Afficher TOUS les mots numériques originaux de la page
        img3 = base_img.copy()
        draw3 = ImageDraw.Draw(img3)
        
        # Filtrer TOUS les mots numériques originaux de toute la page
        all_numeric_original = []
        for word in all_words:
            if is_numeric_value(word["text"]):
                all_numeric_original.append(word)
        
        # Fusionner les chiffres très proches horizontalement (ex: "2" + "689" → "2 689")
        all_numeric_merged = merge_close_numbers(all_numeric_original, h_gap_threshold=0.01)
        
        # Dessiner tous ces nombres fusionnés en CYAN
        for word in all_numeric_merged:
            x0_pixel = int(word["x0"] * img_width)
            y0_pixel = int(word["y0"] * img_height)
            x1_pixel = int(word["x1"] * img_width)
            y1_pixel = int(word["y1"] * img_height)
            
            # Rectangle cyan
            draw3.rectangle(
                [(x0_pixel, y0_pixel), (x1_pixel, y1_pixel)],
                outline="cyan",
                width=3
            )
            
            # Texte magenta
            try:
                draw3.text((x0_pixel, y0_pixel - 12), word["text"], fill="magenta")
            except:
                pass
        
        # Détecter les tableaux par convolution sur les nombres fusionnés
        tables = detect_tables_by_convolution(
            all_numeric_merged,
            window_width=0.25,   # 1/4 de page
            window_height=0.125,  # 1/8 de page
            step=0.05,           # Pas de 5%
            min_numbers=4        # Au moins 4 chiffres
        )
        
        # Filtrer les tableaux qui contiennent trop de texte non-numérique
        tables = filter_tables_with_text(tables, all_words)
        
        if tables:
            # Dessiner chaque tableau
            for table_idx, table_info in enumerate(tables):
                bbox = table_info["bbox"]
                
                # Filtrer les mots numériques ORIGINAUX dans cette zone de tableau
                original_numeric_in_table = []
                for word in all_words:
                    word_x_center = (word["x0"] + word["x1"]) / 2
                    word_y_center = (word["y0"] + word["y1"]) / 2
                    
                    if (bbox["x_min"] <= word_x_center <= bbox["x_max"] and
                        bbox["y_min"] <= word_y_center <= bbox["y_max"]):
                        
                        if is_numeric_value(word["text"]):
                            original_numeric_in_table.append(word)
                
                # Détecter les alignements sur ces mots
                if original_numeric_in_table:
                    grid_lines = detect_table_grid_lines(original_numeric_in_table, align_tolerance=0.01)
                    
                    # Apparier chaque h_line_top avec son h_line_bottom (même logique que dans format_text_with_table_grid)
                    h_lines_top = grid_lines["h_lines_top"]
                    h_lines_bottom = grid_lines["h_lines_bottom"]
                    
                    h_zones_visual = []
                    for h_top in h_lines_top:
                        # Trouver le bottom le plus proche qui vient APRÈS ce top
                        matching_bottom = None
                        min_distance = float('inf')
                        
                        for h_bottom in h_lines_bottom:
                            if h_bottom > h_top:
                                distance = h_bottom - h_top
                                if distance < min_distance:
                                    min_distance = distance
                                    matching_bottom = h_bottom
                        
                        # Si pas de bottom trouvé, utiliser le top + une petite marge
                        if matching_bottom is None:
                            matching_bottom = h_top + 0.01
                        
                        h_zones_visual.append((h_top, matching_bottom))
                    
                    # Créer un overlay semi-transparent pour les bandes horizontales
                    overlay = Image.new('RGBA', img3.size, (255, 255, 255, 0))
                    draw_overlay = ImageDraw.Draw(overlay)
                    
                    # Dessiner les vraies zones [h_top, h_bottom] semi-transparentes (alternées)
                    for zone_idx, (h_top, h_bottom) in enumerate(h_zones_visual):
                        y_top_pixel = int(h_top * img_height)
                        y_bottom_pixel = int(h_bottom * img_height)
                        
                        x_start = 0  # Toute la largeur de la page
                        x_end = img_width
                        
                        # Couleur alternée pour distinguer les zones
                        if zone_idx % 2 == 0:
                            color = (255, 255, 0, 60)  # Jaune semi-transparent
                        else:
                            color = (255, 165, 0, 60)  # Orange semi-transparent
                        
                        draw_overlay.rectangle(
                            [(x_start, y_top_pixel), (x_end, y_bottom_pixel)],
                            fill=color
                        )
                    
                    # Appliquer l'overlay sur img3
                    img3 = Image.alpha_composite(img3.convert('RGBA'), overlay).convert('RGB')
                    draw3 = ImageDraw.Draw(img3)  # Recréer draw3 après conversion
                    
                    # Dessiner les lignes verticales d'alignement (JAUNE)
                    for v_line_x in grid_lines["v_lines"]:
                        x_pixel = int(v_line_x * img_width)
                        y_start = int(bbox["y_min"] * img_height)
                        y_end = int(bbox["y_max"] * img_height)
                        
                        draw3.line([(x_pixel, y_start), (x_pixel, y_end)], fill="yellow", width=2)
                    
                    # Dessiner les lignes horizontales du HAUT (JAUNE épais)
                    for h_line_y in grid_lines["h_lines_top"]:
                        y_pixel = int(h_line_y * img_height)
                        x_start = int(bbox["x_min"] * img_width)
                        x_end = int(bbox["x_max"] * img_width)
                        
                        draw3.line([(x_start, y_pixel), (x_end, y_pixel)], fill="yellow", width=3)
                    
                    # Dessiner les lignes horizontales du BAS (ORANGE épais)
                    for h_line_y in grid_lines["h_lines_bottom"]:
                        y_pixel = int(h_line_y * img_height)
                        x_start = int(bbox["x_min"] * img_width)
                        x_end = int(bbox["x_max"] * img_width)
                        
                        draw3.line([(x_start, y_pixel), (x_end, y_pixel)], fill="orange", width=3)
                
                # Dessiner le contour du tableau (violet épais)
                x_min_pixel = int(bbox["x_min"] * img_width)
                x_max_pixel = int(bbox["x_max"] * img_width)
                y_min_pixel = int(bbox["y_min"] * img_height)
                y_max_pixel = int(bbox["y_max"] * img_height)
                
                draw3.rectangle(
                    [(x_min_pixel, y_min_pixel), (x_max_pixel, y_max_pixel)],
                    outline="purple",
                    width=5
                )
        
        # Calculer les mots orphelins pour la visualisation (même logique que le formatage)
        orphan_words_visual = []
        if tables:
            for table_info in tables:
                bbox = table_info["bbox"]
                
                # Recréer les zones H pour ce tableau
                original_numeric = []
                for word in all_words:
                    word_x_center = (word["x0"] + word["x1"]) / 2
                    word_y_center = (word["y0"] + word["y1"]) / 2
                    if (bbox["x_min"] <= word_x_center <= bbox["x_max"] and
                        bbox["y_min"] <= word_y_center <= bbox["y_max"] and
                        is_numeric_value(word["text"])):
                        original_numeric.append(word)
                
                if not original_numeric:
                    continue
                
                grid_lines_calc = detect_table_grid_lines(original_numeric, align_tolerance=0.01)
                h_lines_top_calc = grid_lines_calc["h_lines_top"]
                h_lines_bottom_calc = grid_lines_calc["h_lines_bottom"]
                
                # Créer les zones
                h_zones_calc = []
                for h_top in h_lines_top_calc:
                    matching_bottom = None
                    min_distance = float('inf')
                    for h_bottom in h_lines_bottom_calc:
                        if h_bottom > h_top:
                            distance = h_bottom - h_top
                            if distance < min_distance:
                                min_distance = distance
                                matching_bottom = h_bottom
                    if matching_bottom is None:
                        matching_bottom = h_top + 0.01
                    h_zones_calc.append((h_top, matching_bottom))
                
                # Trouver les orphelins
                for word in merged_words:
                    word_y0 = word["y0"]
                    word_y1 = word["y1"]
                    
                    if word_y1 < bbox["y_min"] or word_y0 > bbox["y_max"]:
                        continue
                    
                    # Tester intersection avec zones
                    has_intersection = False
                    for h_top, h_bottom in h_zones_calc:
                        intersection = max(0, min(word_y1, h_bottom) - max(word_y0, h_top))
                        if intersection > 0:
                            has_intersection = True
                            break
                    
                    if not has_intersection:
                        orphan_words_visual.append(word)
        
        # Dessiner les bounding boxes sur l'image 3 pour voir les intersections
        # Distinguer : bleu clair (dans tableau), bleu foncé (hors tableau), ROUGE (orphelins)
        for merged_info in merged_words:
            x0_pixel = int(merged_info["x0"] * img_width)
            y0_pixel = int(merged_info["y0"] * img_height)
            x1_pixel = int(merged_info["x1"] * img_width)
            y1_pixel = int(merged_info["y1"] * img_height)
            
            # Vérifier si le mot est orphelin
            is_orphan = any(
                w["x0"] == merged_info["x0"] and w["y0"] == merged_info["y0"] 
                for w in orphan_words_visual
            )
            
            if is_orphan:
                color = "red"  # Mots orphelins (sans intersection)
                width = 3
            else:
                # Vérifier si le mot est dans une zone de tableau
                in_table = False
                if tables:
                    word_y_center = (merged_info["y0"] + merged_info["y1"]) / 2
                    for table_info in tables:
                        table_bbox = table_info["bbox"]
                        if table_bbox["y_min"] <= word_y_center <= table_bbox["y_max"]:
                            in_table = True
                            break
                
                # Couleur selon la zone
                if in_table:
                    color = "lightblue"  # Mots dans le tableau
                else:
                    color = "darkblue"   # Mots hors tableau
                width = 2
            
            # Dessiner rectangle
            draw3.rectangle(
                [(x0_pixel, y0_pixel), (x1_pixel, y1_pixel)],
                outline=color,
                width=width
            )
        
        # Créer une image combinée (les 3 côte à côte)
        combined_width = img_width * 3 + 80  # Marges
        combined_height = img_height + 80  # 40px en haut, 40px en bas
        
        combined_img = Image.new('RGB', (combined_width, combined_height), color='white')
        
        # Coller les trois images
        combined_img.paste(img1, (20, 40))
        combined_img.paste(img2, (img_width + 40, 40))
        combined_img.paste(img3, (img_width * 2 + 60, 40))
        
        # Ajouter des titres
        draw_combined = ImageDraw.Draw(combined_img)
        
        # Titre image 1 avec méthode
        method_label = f"IMAGE 1: Mots originaux [{method.upper()}] (vert)"
        draw_combined.text((20, 10), method_label, fill="black")
        
        # Titre image 2
        draw_combined.text((img_width + 40, 10), "IMAGE 2: Mots fusionnés (bleu)", fill="black")
        
        # Titre image 3 avec légende
        title_x = img_width * 2 + 60
        draw_combined.text((title_x, 10), "IMAGE 3: Zones H + Mots fusionnés + Grille", fill="black")
        
        # Légende des couleurs (en petit sous le titre)
        legend_y = 25
        legend_items = [
            "Bandes jaune/orange: zones [h_top, h_bottom]",
            "ROUGE épais: mots ORPHELINS (pas d'intersection)",
            "Bleu clair: mots dans tableau avec zone",
            "Bleu foncé: mots hors tableau",
            "Violet: contour tableau",
            "Jaune/Orange épais: lignes H top/bottom"
        ]
        
        for i, legend_text in enumerate(legend_items):
            if i < 3:  # Première colonne
                draw_combined.text((title_x, legend_y + i * 10), f"• {legend_text}", fill="black", font=None)
            else:  # Deuxième colonne
                draw_combined.text((title_x + 200, legend_y + (i - 3) * 10), f"• {legend_text}", fill="black", font=None)
        
        # Convertir en bytes
        combined_byte_arr = io.BytesIO()
        combined_img.save(combined_byte_arr, format='PNG')
        combined_byte_arr.seek(0)
        
        print(f"✅ Image combinée créée: {combined_img.size}")
        
        return combined_byte_arr.getvalue()
        
    finally:
        # Nettoyer
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


def merge_close_words_horizontally(words: List[Dict], distance_threshold: float = 0.02) -> List[Dict]:
    """
    Fusionne les mots proches en utilisant un algorithme de clustering par distance.
    
    Args:
        words: Liste des mots avec x0, y0, x1, y1, text
        distance_threshold: Distance maximale pour regrouper (défaut 0.02)
        
    Returns:
        Liste des mots fusionnés
    """
    if not words:
        return []
    
    n = len(words)
    print(f"      🔍 Clustering de {n} mots (distance < {distance_threshold}):")
    
    # Créer un graphe de mots connectés (Union-Find)
    parent = list(range(n))
    
    def find(x):
        if parent[x] != x:
            parent[x] = find(parent[x])
        return parent[x]
    
    def union(x, y):
        px, py = find(x), find(y)
        if px != py:
            parent[px] = py
    
    # Pour chaque paire de mots, vérifier s'ils doivent être fusionnés
    merges = 0
    containments = 0
    
    for i in range(n):
        for j in range(i + 1, n):
            w1, w2 = words[i], words[j]
            
            # RÈGLE 1 : Vérifier si un mot est CONTENU dans l'autre (phagocytose)
            w1_contains_w2 = (w1["x0"] <= w2["x0"] and w1["x1"] >= w2["x1"] and 
                             w1["y0"] <= w2["y0"] and w1["y1"] >= w2["y1"])
            
            w2_contains_w1 = (w2["x0"] <= w1["x0"] and w2["x1"] >= w1["x1"] and 
                             w2["y0"] <= w1["y0"] and w2["y1"] >= w1["y1"])
            
            if w1_contains_w2 or w2_contains_w1:
                # Un mot est complètement dans l'autre → fusionner
                union(i, j)
                containments += 1
                continue
            
            # RÈGLE 2 : Vérifier si proches (même ligne, petit gap)
            x_center1 = (w1["x0"] + w1["x1"]) / 2
            x_center2 = (w2["x0"] + w2["x1"]) / 2
            
            # Gap horizontal (distance entre les bords)
            if x_center1 < x_center2:
                h_gap = w2["x0"] - w1["x1"]
            else:
                h_gap = w1["x0"] - w2["x1"]
            
            # Chevauchement vertical
            v_overlap = min(w1["y1"], w2["y1"]) - max(w1["y0"], w2["y0"])
            
            # Fusionner si :
            # - Chevauchement vertical (même ligne)
            # - Gap horizontal petit
            if v_overlap > 0 and h_gap >= 0 and h_gap < distance_threshold:
                union(i, j)
                merges += 1
    
    print(f"      ✅ {containments} phagocytoses + {merges} fusions de proximité = {containments + merges} connexions")
    
    # Regrouper les mots par cluster
    clusters = {}
    for i in range(n):
        root = find(i)
        if root not in clusters:
            clusters[root] = []
        clusters[root].append(words[i])
    
    print(f"      📦 {len(clusters)} cluster(s) formé(s) ({n} → {len(clusters)} groupes)")
    
    # Créer les mots fusionnés
    merged = []
    for cluster_words in clusters.values():
        if cluster_words:
            merged.append(create_merged_word(cluster_words))
    
    print(f"      🔄 Vérification des mots isolés contenus dans les gros mots...")
    
    # DEUXIÈME PASSE : Phagocytose post-fusion
    # Vérifier si des mots isolés sont contenus OU ont une intersection avec des gros clusters
    final_merged = []
    phagocyted_contained = 0
    phagocyted_intersect = 0
    
    for i, word in enumerate(merged):
        should_remove = False
        
        # Vérifier contre tous les autres mots fusionnés
        for j, other in enumerate(merged):
            if i == j:
                continue
            
            # RÈGLE 1 : Vérifier si 'word' est complètement contenu dans 'other'
            is_contained = (other["x0"] <= word["x0"] and other["x1"] >= word["x1"] and 
                           other["y0"] <= word["y0"] and other["y1"] >= word["y1"])
            
            if is_contained:
                should_remove = True
                phagocyted_contained += 1
                # print(f"         🔵 Phagocyté (contenu): '{word['text'][:20]}' ⊂ '{other['text'][:20]}'")
                break
            
            # RÈGLE 2 : Vérifier si 'word' a une intersection avec 'other'
            # ET que 'other' est plus grand
            x_overlap = min(word["x1"], other["x1"]) - max(word["x0"], other["x0"])
            y_overlap = min(word["y1"], other["y1"]) - max(word["y0"], other["y0"])
            
            if x_overlap > 0 and y_overlap > 0:
                # Il y a intersection
                # Calculer les aires
                word_area = (word["x1"] - word["x0"]) * (word["y1"] - word["y0"])
                other_area = (other["x1"] - other["x0"]) * (other["y1"] - other["y0"])
                
                # Si 'other' est plus grand, il phagocyte 'word'
                if other_area > word_area * 1.5:  # Au moins 1.5x plus grand
                    should_remove = True
                    phagocyted_intersect += 1
                    # print(f"         🟣 Phagocyté (intersection): '{word['text'][:20]}' ∩ '{other['text'][:20]}'")
                    break
        
        if not should_remove:
            final_merged.append(word)
    
    total_phagocyted = phagocyted_contained + phagocyted_intersect
    print(f"      ✅ Phagocytose: {phagocyted_contained} contenus + {phagocyted_intersect} intersections = {total_phagocyted} supprimés → {len(final_merged)} mots finaux")
    
    # Trier par position Y puis X
    final_merged.sort(key=lambda w: ((w["y0"] + w["y1"]) / 2, w["x0"]))
    
    return final_merged


def merge_close_numbers(numeric_words: List[Dict], h_gap_threshold: float = 0.01) -> List[Dict]:
    """
    Fusionne les chiffres très proches horizontalement (séparation des milliers).
    Ex: "2" + "689" → "2 689"
    
    Utilise l'intersection verticale pour déterminer si deux mots sont sur la même ligne.
    
    Args:
        numeric_words: Liste des mots numériques
        h_gap_threshold: Gap horizontal maximal pour fusionner (défaut 0.01)
        
    Returns:
        Liste des nombres fusionnés
    """
    if not numeric_words:
        return []
    
    n = len(numeric_words)
    
    # Étape 1 : Regrouper par lignes (intersection verticale)
    used = set()
    lines = []
    
    for i in range(n):
        if i in used:
            continue
        
        # Créer une nouvelle ligne avec ce mot
        current_line = [numeric_words[i]]
        used.add(i)
        
        # Trouver tous les autres mots qui ont une intersection verticale
        for j in range(n):
            if j in used or j == i:
                continue
            
            w1 = numeric_words[i]
            w2 = numeric_words[j]
            
            # Vérifier l'intersection verticale
            v_overlap = min(w1["y1"], w2["y1"]) - max(w1["y0"], w2["y0"])
            
            if v_overlap > 0:
                # Même ligne !
                current_line.append(w2)
                used.add(j)
        
        if current_line:
            # Trier cette ligne par X
            current_line.sort(key=lambda w: w["x0"])
            lines.append(current_line)
    
    # Étape 2 : Pour chaque ligne, fusionner les mots proches horizontalement
    merged = []
    
    for line in lines:
        if not line:
            continue
        
        line_merged = []
        current_group = [line[0]]
        
        for i in range(1, len(line)):
            prev = current_group[-1]
            curr = line[i]
            
            # Gap horizontal
            h_gap = curr["x0"] - prev["x1"]
            
            # Fusionner si très proches
            if h_gap >= 0 and h_gap < h_gap_threshold:
                current_group.append(curr)
            else:
                # Nouveau groupe
                if current_group:
                    line_merged.append(create_merged_word(current_group))
                current_group = [curr]
        
        # Dernier groupe
        if current_group:
            line_merged.append(create_merged_word(current_group))
        
        merged.extend(line_merged)
    
    return merged


def is_numeric_value(text: str) -> bool:
    """
    Vérifie si un texte est un vrai nombre (prix, quantité) et pas un ID/date/code.
    
    Règles strictes :
    - PAS de lettres (sauf dans € à la fin)
    - PAS de slash "/" (dates)
    - Doit être convertible en nombre
    - Si > 100 et sans virgule → ID
    
    Args:
        text: Texte à vérifier
        
    Returns:
        True si c'est un vrai nombre (prix/quantité)
    """
    if not text:
        return False
    
    # RÈGLE 1 : Exclure les slashes (dates comme "31/07/2025", "1/1")
    if "/" in text:
        return False
    
    # RÈGLE 2 : Vérifier les lettres
    # Enlever les symboles autorisés
    text_clean = text.replace("€", "").replace("%", "").replace(" ", "").replace(",", "").replace(".", "").strip()
    
    # S'il reste des lettres, ce n'est pas un nombre pur
    if any(c.isalpha() for c in text_clean):
        return False
    
    # RÈGLE 3 : Pas de virgule/point à la fin sans chiffres après
    if text.rstrip("€% ").endswith(",") or text.rstrip("€% ").endswith("."):
        return False
    
    # RÈGLE 4 : Pas de nombre commençant par 0 (sauf "0" tout seul ou "0,xx")
    # Ex: "00027", "00491", "098709" = codes, pas des prix
    if text_clean.startswith("0") and len(text_clean) > 1 and "," not in text and "." not in text:
        return False
    
    # RÈGLE 5 : Doit être convertible en nombre
    try:
        # Nettoyer pour conversion
        value_str = text.replace("€", "").replace("%", "").replace(" ", "").strip()
        value_str = value_str.replace(",", ".")  # Format français → format Python
        
        value = float(value_str)
        
        # RÈGLE 6 : Si > 100 sans virgule/point, c'est probablement un ID
        if value > 100 and "," not in text and "." not in text:
            return False
        
        return True
        
    except ValueError:
        return False


def detect_table_grid_lines(numeric_words: List[Dict], align_tolerance: float = 0.01) -> Dict:
    """
    Détecte les lignes de grille du tableau en trouvant les alignements entre mots.
    
    Args:
        numeric_words: Liste des mots numériques
        align_tolerance: Tolérance pour considérer que deux bords sont alignés
        
    Returns:
        Dict avec les lignes verticales et horizontales
    """
    if len(numeric_words) < 4:
        return {"v_lines": [], "h_lines_top": [], "h_lines_bottom": []}
    
    # Collecter tous les bords (gauche, droite, haut, bas)
    edges = {
        "left": [],    # x0
        "right": [],   # x1
        "top": [],     # y0
        "bottom": []   # y1
    }
    
    for word in numeric_words:
        edges["left"].append(word["x0"])
        edges["right"].append(word["x1"])
        edges["top"].append(word["y0"])
        edges["bottom"].append(word["y1"])
    
    # Trouver les positions qui se répètent (alignements)
    def find_aligned_positions(positions, tolerance):
        if not positions:
            return []
        
        positions.sort()
        aligned = []
        current_cluster = [positions[0]]
        
        for pos in positions[1:]:
            if pos - current_cluster[-1] <= tolerance:
                current_cluster.append(pos)
            else:
                # Cluster trouvé : au moins 2 occurrences = alignement
                if len(current_cluster) >= 2:
                    aligned.append(sum(current_cluster) / len(current_cluster))
                current_cluster = [pos]
        
        if len(current_cluster) >= 2:
            aligned.append(sum(current_cluster) / len(current_cluster))
        
        return aligned
    
    # Détecter les lignes verticales (alignements en X)
    v_lines_left = find_aligned_positions(edges["left"], align_tolerance)
    v_lines_right = find_aligned_positions(edges["right"], align_tolerance)
    
    # Détecter les lignes horizontales (alignements en Y)
    h_lines_top = find_aligned_positions(edges["top"], align_tolerance)
    h_lines_bottom = find_aligned_positions(edges["bottom"], align_tolerance)
    
    # MODIFICATION : On garde les lignes de gauche ET les lignes du haut ET du bas
    # Les lignes du haut et du bas vont servir à attribuer les mots aux bonnes lignes du tableau
    v_lines = sorted(v_lines_left)  # Seulement bords gauches
    
    return {
        "v_lines": v_lines,
        "h_lines_top": sorted(h_lines_top),
        "h_lines_bottom": sorted(h_lines_bottom)
    }


def detect_tables_by_convolution(numeric_words: List[Dict], 
                                  window_width: float = 0.25,  # 1/4 de page
                                  window_height: float = 0.125,  # 1/8 de page
                                  step: float = 0.05,  # Pas de convolution
                                  min_numbers: int = 4) -> List[Dict]:
    """
    Détecte les tableaux par convolution : fait glisser une fenêtre sur la page
    et compte les chiffres dans chaque fenêtre.
    
    Args:
        numeric_words: Liste des nombres fusionnés
        window_width: Largeur de la fenêtre (défaut 0.25 = 1/4 page)
        window_height: Hauteur de la fenêtre (défaut 0.125 = 1/8 page)
        step: Pas de déplacement de la fenêtre
        min_numbers: Nombre minimum de chiffres pour détecter un tableau
        
    Returns:
        Liste des zones de tableau détectées
    """
    if len(numeric_words) < min_numbers:
        return []
    
    print(f"      🔍 Convolution avec fenêtre {window_width}×{window_height}, pas={step}")
    
    # Trouver les limites de la page
    all_x = [w["x0"] for w in numeric_words] + [w["x1"] for w in numeric_words]
    all_y = [w["y0"] for w in numeric_words] + [w["y1"] for w in numeric_words]
    
    x_min_page = min(all_x)
    x_max_page = max(all_x)
    y_min_page = min(all_y)
    y_max_page = max(all_y)
    
    # Faire la convolution
    table_candidates = []
    
    y = y_min_page
    while y <= y_max_page:
        x = x_min_page
        while x <= x_max_page:
            # Définir la fenêtre actuelle
            window = {
                "x_min": x,
                "x_max": x + window_width,
                "y_min": y,
                "y_max": y + window_height
            }
            
            # Compter les chiffres dans cette fenêtre
            numbers_in_window = []
            for word in numeric_words:
                word_x_center = (word["x0"] + word["x1"]) / 2
                word_y_center = (word["y0"] + word["y1"]) / 2
                
                if (window["x_min"] <= word_x_center <= window["x_max"] and
                    window["y_min"] <= word_y_center <= window["y_max"]):
                    numbers_in_window.append(word)
            
            # Si assez de chiffres, c'est une zone de tableau
            if len(numbers_in_window) >= min_numbers:
                table_candidates.append({
                    "bbox": window,
                    "numbers": numbers_in_window,
                    "count": len(numbers_in_window)
                })
            
            x += step
        y += step
    
    print(f"      📊 {len(table_candidates)} zone(s) candidate(s) détectée(s)")
    
    if not table_candidates:
        return []
    
    # Merger les zones qui s'intersectent
    merged_tables = merge_overlapping_tables(table_candidates)
    
    print(f"      🔗 Après fusion des zones qui se chevauchent: {len(merged_tables)} tableau(x)")
    
    return merged_tables


def merge_overlapping_tables(candidates: List[Dict]) -> List[Dict]:
    """
    Fusionne les zones de tableau qui s'intersectent.
    """
    if not candidates:
        return []
    
    n = len(candidates)
    
    # Union-Find pour grouper les zones qui s'intersectent
    parent = list(range(n))
    
    def find(x):
        if parent[x] != x:
            parent[x] = find(parent[x])
        return parent[x]
    
    def union(x, y):
        px, py = find(x), find(y)
        if px != py:
            parent[px] = py
    
    # Vérifier toutes les paires
    for i in range(n):
        for j in range(i + 1, n):
            bbox1 = candidates[i]["bbox"]
            bbox2 = candidates[j]["bbox"]
            
            # Vérifier l'intersection
            x_overlap = min(bbox1["x_max"], bbox2["x_max"]) - max(bbox1["x_min"], bbox2["x_min"])
            y_overlap = min(bbox1["y_max"], bbox2["y_max"]) - max(bbox1["y_min"], bbox2["y_min"])
            
            if x_overlap > 0 and y_overlap > 0:
                # Les zones s'intersectent
                union(i, j)
    
    # Regrouper par cluster
    clusters = {}
    for i in range(n):
        root = find(i)
        if root not in clusters:
            clusters[root] = []
        clusters[root].append(candidates[i])
    
    # Créer les tableaux fusionnés
    merged = []
    for cluster in clusters.values():
        # Calculer la bbox englobante du cluster
        all_numbers = []
        for candidate in cluster:
            all_numbers.extend(candidate["numbers"])
        
        # Supprimer les doublons
        unique_numbers = []
        seen = set()
        for num in all_numbers:
            key = (num["x0"], num["y0"], num["text"])
            if key not in seen:
                seen.add(key)
                unique_numbers.append(num)
        
        if unique_numbers:
            x_min = min(w["x0"] for w in unique_numbers)
            x_max = max(w["x1"] for w in unique_numbers)
            y_min = min(w["y0"] for w in unique_numbers)
            y_max = max(w["y1"] for w in unique_numbers)
            
            merged.append({
                "bbox": {
                    "x_min": x_min - 0.02,
                    "x_max": x_max + 0.02,
                    "y_min": y_min - 0.02,
                    "y_max": y_max + 0.02
                },
                "numbers": unique_numbers,
                "count": len(unique_numbers)
            })
    
    return merged


def filter_tables_with_text(tables: List[Dict], all_words: List[Dict], max_text_ratio: float = 0.3) -> List[Dict]:
    """
    Filtre les tableaux qui contiennent trop de mots textuels (non-numériques).
    
    Args:
        tables: Liste des tableaux détectés
        all_words: Tous les mots originaux de la page
        max_text_ratio: Ratio maximal de mots non-numériques autorisé (défaut 30%)
        
    Returns:
        Liste des tableaux filtrés
    """
    if not tables:
        return []
    
    filtered = []
    
    print(f"      🔍 Filtrage des tableaux avec trop de texte...")
    
    for table_idx, table in enumerate(tables):
        bbox = table["bbox"]
        
        # Compter les mots dans cette zone
        words_in_zone = []
        numeric_in_zone = 0
        
        for word in all_words:
            word_x_center = (word["x0"] + word["x1"]) / 2
            word_y_center = (word["y0"] + word["y1"]) / 2
            
            # Vérifier si dans la zone
            if (bbox["x_min"] <= word_x_center <= bbox["x_max"] and
                bbox["y_min"] <= word_y_center <= bbox["y_max"]):
                words_in_zone.append(word)
                
                if is_numeric_value(word["text"]):
                    numeric_in_zone += 1
        
        total_in_zone = len(words_in_zone)
        
        if total_in_zone == 0:
            continue
        
        text_ratio = (total_in_zone - numeric_in_zone) / total_in_zone
        
        if text_ratio <= max_text_ratio:
            # OK : principalement des chiffres
            filtered.append(table)
            print(f"         ✅ Tableau #{table_idx + 1}: {numeric_in_zone}/{total_in_zone} numériques ({(1-text_ratio)*100:.0f}%) → GARDÉ")
        else:
            # Trop de texte
            print(f"         ❌ Tableau #{table_idx + 1}: {numeric_in_zone}/{total_in_zone} numériques ({(1-text_ratio)*100:.0f}%) → REJETÉ (trop de texte)")
    
    print(f"      ✅ {len(filtered)}/{len(tables)} tableau(x) gardé(s) après filtrage")
    
    return filtered


def detect_table_structure(words: List[Dict], x_tolerance: float = 0.025) -> List[Dict]:
    """
    Détecte la structure de tableaux (peut en détecter plusieurs) en analysant l'alignement des mots numériques.
    
    Args:
        words: Liste des mots (après fusion)
        x_tolerance: Tolérance pour l'alignement vertical
        
    Returns:
        Liste de dicts, chaque dict représentant un tableau détecté
    """
    # 1. Filtrer les mots qui sont de vrais nombres (pas des IDs)
    numeric_words = []
    for word in words:
        if is_numeric_value(word["text"]):
            numeric_words.append(word)
    
    print(f"      🔢 {len(numeric_words)} mots numériques trouvés (sur {len(words)} mots)")
    
    if len(numeric_words) < 6:  # Besoin d'au moins 6 chiffres pour un tableau
        return []
    
    # 2. Regrouper les mots numériques en lignes (Y proche)
    numeric_words.sort(key=lambda w: ((w["y0"] + w["y1"]) / 2, w["x0"]))
    
    lines = []
    current_line = [numeric_words[0]]
    current_y = (numeric_words[0]["y0"] + numeric_words[0]["y1"]) / 2
    
    for word in numeric_words[1:]:
        y = (word["y0"] + word["y1"]) / 2
        
        if abs(y - current_y) < 0.02:  # Même ligne
            current_line.append(word)
        else:
            if len(current_line) >= 2:  # Au moins 2 chiffres par ligne
                lines.append(current_line)
            current_line = [word]
            current_y = y
    
    if len(current_line) >= 2:
        lines.append(current_line)
    
    print(f"      📊 {len(lines)} lignes de chiffres détectées")
    
    if len(lines) < 2:  # Besoin d'au moins 2 lignes pour un tableau
        return []
    
    # 2.5. Séparer les lignes en blocs de tableaux (espaces verticaux significatifs)
    table_blocks = []
    current_block = [lines[0]]
    
    for i in range(1, len(lines)):
        prev_line = lines[i - 1]
        curr_line = lines[i]
        
        # Calculer l'espace vertical entre les lignes
        prev_y = (prev_line[0]["y0"] + prev_line[0]["y1"]) / 2
        curr_y = (curr_line[0]["y0"] + curr_line[0]["y1"]) / 2
        y_gap = curr_y - prev_y
        
        # Si grand espace vertical (> 0.05), c'est un nouveau tableau
        if y_gap > 0.05:
            if len(current_block) >= 2:
                table_blocks.append(current_block)
            current_block = [curr_line]
        else:
            current_block.append(curr_line)
    
    # Ajouter le dernier bloc
    if len(current_block) >= 2:
        table_blocks.append(current_block)
    
    print(f"      📦 {len(table_blocks)} bloc(s) de tableau distinct(s)")
    
    if not table_blocks:
        return []
    
    # 3. Pour chaque bloc de tableau, détecter ses colonnes
    tables = []
    
    for block_idx, block_lines in enumerate(table_blocks):
        print(f"      🔍 Traitement bloc tableau #{block_idx + 1}")
        
        # Détecter les colonnes pour ce bloc spécifiquement
        all_x_positions = []
        for line in block_lines:
            for word in line:
                all_x_positions.append(word["x0"])  # Position gauche
        
        # Clustering des positions X
        all_x_positions.sort()
        columns = []
        current_cluster = [all_x_positions[0]]
        
        for x in all_x_positions[1:]:
            if x - current_cluster[-1] <= x_tolerance:
                current_cluster.append(x)
            else:
                if len(current_cluster) >= 2:  # Colonne apparaît au moins 2 fois
                    columns.append(sum(current_cluster) / len(current_cluster))
                current_cluster = [x]
        
        if len(current_cluster) >= 2:
            columns.append(sum(current_cluster) / len(current_cluster))
        
        print(f"         📐 {len(columns)} colonnes détectées: {[f'{x:.3f}' for x in columns]}")
        
        if len(columns) < 2:  # Besoin d'au moins 2 colonnes
            continue
        
        # Calculer les limites de CE tableau
        block_numeric_words = [word for line in block_lines for word in line]
        all_y_min = min(word["y0"] for word in block_numeric_words)
        all_y_max = max(word["y1"] for word in block_numeric_words)
        
        # X : limites des colonnes
        x_min = min(columns)
        x_max = max(columns)
        
        # Détecter les lignes de grille basées sur les alignements réels
        grid_lines = detect_table_grid_lines(block_numeric_words, align_tolerance=0.01)
        
        # Ajouter une petite marge
        margin = 0.015
        
        tables.append({
            "columns": columns,
            "grid_lines": grid_lines,  # Lignes de grille basées sur alignements
            "bbox": {
                "x_min": x_min - margin,
                "x_max": x_max + margin,
                "y_min": all_y_min - margin,
                "y_max": all_y_max + margin
            },
            "row_count": len(block_lines),
            "col_count": len(columns)
        })
        
        print(f"         ✅ Tableau #{block_idx + 1}: {len(block_lines)} lignes × {len(columns)} colonnes")
        print(f"            Grille: {len(grid_lines['v_lines'])} lignes verticales, {len(grid_lines['h_lines'])} lignes horizontales")
    
    return tables


def create_merged_word(word_group: List[Dict]) -> Dict:
    """
    Crée un mot fusionné à partir d'un groupe de mots proches.
    """
    if not word_group:
        return {}
    
    # Texte : concaténer tous les mots
    text = " ".join(w["text"] for w in word_group)
    
    # Bounding box : prendre les extremums
    x0 = min(w["x0"] for w in word_group)
    x1 = max(w["x1"] for w in word_group)
    y0 = min(w["y0"] for w in word_group)
    y1 = max(w["y1"] for w in word_group)
    
    return {
        "text": text,
        "x0": x0,
        "y0": y0,
        "x1": x1,
        "y1": y1
    }


async def visualize_ocr_boxes(file) -> bytes:
    """
    Crée une image avec les bounding boxes de l'OCR dessinées dessus.
    
    Args:
        file: Fichier PDF uploadé
        
    Returns:
        bytes: Image PNG avec les bounding boxes
    """
    # Sauvegarder temporairement le fichier
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    await file.seek(0)
    
    try:
        # Faire l'OCR
        print("🔄 OCR en cours...")
        text, json_data = await ocr_this(file)
        print(f"✅ OCR terminé - {len(json_data.get('pages', []))} page(s)")
        
        # Convertir le PDF en image avec PyMuPDF (première page seulement)
        print("🔄 Conversion PDF → Image avec PyMuPDF...")
        pdf_document = fitz.open(tmp_path)
        
        if len(pdf_document) == 0:
            raise Exception("PDF vide")
        
        # Récupérer la première page
        page = pdf_document[0]
        
        # Convertir en image (matrice de pixels)
        # zoom=2 pour une bonne résolution (équivalent ~200 DPI)
        mat = fitz.Matrix(2, 2)
        pix = page.get_pixmap(matrix=mat)
        
        # Convertir en PIL Image
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        print(f"✅ Image créée: {img.size}")
        
        pdf_document.close()
        
        # Préparer le dessin
        draw = ImageDraw.Draw(img)
        img_width, img_height = img.size
        
        # Extraire les bounding boxes de la première page
        page_data = json_data.get("pages", [])[0] if json_data.get("pages") else None
        
        if not page_data:
            raise Exception("Aucune donnée OCR trouvée")
        
        # Compter les éléments
        word_count = 0
        line_count = 0
        boxes_drawn = 0
        
        print(f"🔍 Debug première page OCR:")
        print(f"   Blocs: {len(page_data.get('blocks', []))}")
        
        # Dessiner les bounding boxes des mots (vert)
        for block_idx, block in enumerate(page_data.get("blocks", [])):
            lines = block.get("lines", [])
            print(f"   Bloc {block_idx}: {len(lines)} lignes")
            
            for line_idx, line in enumerate(lines):
                line_count += 1
                words = line.get("words", [])
                
                if line_idx == 0:  # Debug première ligne
                    print(f"      Ligne 0: {len(words)} mots")
                    if words:
                        first_word = words[0]
                        print(f"         Premier mot: '{first_word.get('value', '')}'")
                        print(f"         Géométrie: {first_word.get('geometry', 'N/A')}")
                
                # Calculer la bbox de la ligne pour la dessiner en rouge
                line_x_coords = []
                line_y_coords = []
                
                for word in words:
                    word_count += 1
                    geom = word.get("geometry", None)
                    word_text = word.get("value", "")
                    
                    if geom is None:
                        continue
                    
                    # DocTR retourne ((x0, y0), (x1, y1)) - 2 points (coins opposés)
                    if isinstance(geom, (list, tuple)) and len(geom) == 2:
                        pt1, pt2 = geom
                        
                        if isinstance(pt1, (list, tuple)) and isinstance(pt2, (list, tuple)):
                            # Extraire les coordonnées
                            x0, y0 = pt1[0], pt1[1]
                            x1, y1 = pt2[0], pt2[1]
                            
                            # Convertir en pixels
                            x0_pixel = int(x0 * img_width)
                            y0_pixel = int(y0 * img_height)
                            x1_pixel = int(x1 * img_width)
                            y1_pixel = int(y1 * img_height)
                            
                            # Dessiner le rectangle du mot (vert)
                            draw.rectangle(
                                [(x0_pixel, y0_pixel), (x1_pixel, y1_pixel)],
                                outline="green",
                                width=2
                            )
                            boxes_drawn += 1
                            
                            # Ajouter aux coordonnées de la ligne
                            line_x_coords.extend([x0_pixel, x1_pixel])
                            line_y_coords.extend([y0_pixel, y1_pixel])
                            
                            # Afficher le texte au-dessus
                            if word_text:
                                try:
                                    draw.text((x0_pixel, y0_pixel - 15), word_text, fill="blue")
                                except:
                                    pass
                
                # Dessiner la bbox de la ligne complète (rouge)
                if line_x_coords and line_y_coords:
                    x_min = min(line_x_coords)
                    x_max = max(line_x_coords)
                    y_min = min(line_y_coords)
                    y_max = max(line_y_coords)
                    
                    draw.rectangle(
                        [(x_min, y_min), (x_max, y_max)],
                        outline="red",
                        width=3
                    )
        
        print(f"✅ {word_count} mots, {line_count} lignes, {boxes_drawn} boxes dessinées")
        
        # Convertir l'image en bytes
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='PNG')
        img_byte_arr.seek(0)
        
        return img_byte_arr.getvalue()
        
    finally:
        # Nettoyer
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

