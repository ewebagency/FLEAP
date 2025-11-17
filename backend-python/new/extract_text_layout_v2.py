import tempfile
import os
import pdfplumber
from typing import Dict, List, Tuple, Optional
from new.extract_utils.ocr import ocr_this
from PIL import Image, ImageDraw, ImageFont
import fitz  # PyMuPDF
import io


def _rects_intersect(a: Tuple[float, float, float, float], b: Tuple[float, float, float, float]) -> bool:
    """
    Teste l'intersection stricte entre deux rectangles (x0, y0, x1, y1) en coordonnées normalisées.
    """
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    return (min(ax1, bx1) - max(ax0, bx0)) > 0 and (min(ay1, by1) - max(ay0, by0)) > 0


def remove_water_mark(json_data: Dict) -> Dict:
    """
    Supprime les "watermarks" (ex: DUPLICATA) du JSON OCR.
    Règle:
    - Calcule la hauteur médiane de toutes les bounding boxes de mots.
    - Marque comme watermark tout texte (ligne) dont la hauteur de bbox est >= 5x cette médiane
      ET qui intersecte au moins une autre bbox de ligne.
    - Supprime ces lignes complètes (tous leurs mots) des blocks.
    """
    pages = json_data.get("pages", [])
    if not pages:
        return json_data
    
    # Collecter toutes les hauteurs de mots pour la médiane
    word_heights: List[float] = []
    for page in pages:
        for block in page.get("blocks", []):
            for line in block.get("lines", []):
                for w in line.get("words", []):
                    geom = w.get("geometry")
                    if not geom or not isinstance(geom, (list, tuple)) or len(geom) != 2:
                        continue
                    (x0, y0), (x1, y1) = geom[0], geom[1]
                    word_heights.append(max(0.0, float(y1) - float(y0)))
    
    if not word_heights:
        return json_data
    
    word_heights.sort()
    median_height = word_heights[len(word_heights) // 2]
    if median_height <= 0:
        return json_data
    
    total_removed_lines = 0
    total_removed_words = 0
    
    for page_idx, page in enumerate(pages):
        blocks = page.get("blocks", [])
        # Collecter toutes les bboxes de mots (pour test d'intersection)
        all_words_bbox: List[Tuple[float, float, float, float]] = []
        for block in blocks:
            for line in block.get("lines", []):
                for w in line.get("words", []):
                    geom = w.get("geometry")
                    if not geom or not isinstance(geom, (list, tuple)) or len(geom) != 2:
                        continue
                    (x0, y0), (x1, y1) = geom[0], geom[1]
                    all_words_bbox.append((float(x0), float(y0), float(x1), float(y1)))

        threshold = 5.0 * median_height
        removed_lines_on_page = 0

        # Filtrer au niveau MOT (pas ligne) pour ne supprimer que les mots géants
        for bi, block in enumerate(blocks):
            for li, line in enumerate(block.get("lines", [])):
                words = line.get("words", [])
                if not words:
                    continue
                kept_words = []
                removed_in_line = 0
                for w in words:
                    geom = w.get("geometry")
                    if not geom or not isinstance(geom, (list, tuple)) or len(geom) != 2:
                        kept_words.append(w)
                        continue
                    (x0, y0), (x1, y1) = geom[0], geom[1]
                    h = max(0.0, float(y1) - float(y0))
                    # Ne JAMAIS supprimer dans la zone supérieure gauche (moitié gauche et 1er 1/8 en hauteur)
                    x_center = (float(x0) + float(x1)) / 2.0
                    if x_center <= 0.5 and float(y0) <= 0.125:
                        kept_words.append(w)
                        continue
                    if h < threshold:
                        kept_words.append(w)
                        continue
                    # h >= threshold → vérifier intersection avec au moins une autre bbox (différente)
                    bbox_w = (float(x0), float(y0), float(x1), float(y1))
                    intersects_any = False
                    for wbb in all_words_bbox:
                        if wbb == bbox_w:
                            continue
                        if _rects_intersect(bbox_w, wbb):
                            intersects_any = True
                            break
                    if intersects_any:
                        removed_in_line += 1
                        total_removed_words += 1
                    else:
                        kept_words.append(w)
                if removed_in_line > 0 and len(kept_words) == 0:
                    removed_lines_on_page += 1
                # Écrire les mots filtrés dans la ligne
                line["words"] = kept_words
        total_removed_lines += removed_lines_on_page
    
    if total_removed_words > 0:
        print(f"🧹 Watermark: {total_removed_words} mots supprimés")
    return json_data

async def extract_text_with_grid_for_llm(
    file,
    spacing_factor: float = 0.02,
    force_ocr: bool = False,
    precomputed_ocr_text: Optional[str] = None,
    precomputed_ocr_json: Optional[Dict] = None,
) -> Tuple[str, Dict, str]:
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
                text, json_data = await parse_pdf_with_boxes(file)
                method = "parse"
            except Exception:
                await file.seek(0)
                text, json_data = await ocr_this(file)
                json_data = remove_water_mark(json_data)
                method = "ocr"
        else:
            # Force OCR
            if precomputed_ocr_text is not None and precomputed_ocr_json is not None:
                text, json_data = precomputed_ocr_text, precomputed_ocr_json
            else:
                text, json_data = await ocr_this(file)
            json_data = remove_water_mark(json_data)
            method = "ocr"
        
        # NOUVEAU: Traiter page par page puis concaténer séquentiellement
        page_texts: List[str] = []
        total_words = 0
        total_tables = 0
        
        for page_idx, page in enumerate(json_data.get("pages", [])):
            # Extraire les mots de la page courante
            page_all_words: List[Dict] = []
            for block in page.get("blocks", []):
                for line in block.get("lines", []):
                    for word in line.get("words", []):
                        geom = word.get("geometry", None)
                        if geom and isinstance(geom, (list, tuple)) and len(geom) == 2:
                            pt1, pt2 = geom
                            if isinstance(pt1, (list, tuple)) and isinstance(pt2, (list, tuple)):
                                    page_all_words.append({
                                    "text": word.get("value", ""),
                                    "x0": pt1[0],
                                    "y0": pt1[1],
                                    "x1": pt2[0],
                                    "y1": pt2[1]
                                })
            total_words += len(page_all_words)
            
            if not page_all_words:
                page_texts.append("")
                continue
            
            # Fusion par page
            merged_words_page = merge_close_words_horizontally(page_all_words, distance_threshold=0.015)
            
            # Nombres par page
            numeric_words_page = [w for w in page_all_words if is_numeric_value(w["text"])]
            numeric_merged_page = merge_close_numbers(numeric_words_page, h_gap_threshold=0.01)
            
            # Détection de tableaux par page
            tables_page = detect_tables_by_alignment_growing(numeric_merged_page, page_all_words)
            total_tables += len(tables_page)
            
            # Formatage par page
            page_text = format_text_with_table_grid(merged_words_page, page_all_words, tables_page, spacing_factor)
            
            if not page_text:
                lines = []
                for word in sorted(merged_words_page, key=lambda w: ((w["y0"] + w["y1"]) / 2, w["x0"])):
                    indent = int(word["x0"] / spacing_factor)
                    lines.append(" " * indent + word["text"])
                page_text = "\n".join(lines)
            
            page_texts.append(page_text)
        
        final_text = "\n\n".join(page_texts)
        num_pages = len(json_data.get('pages', []))
        print(f"📊 {method.upper()}: {num_pages} page(s), {total_tables} tableau(x), {len(final_text)} chars")
        
        # Retourner le même format que get_raw_text_from_pdf
        # (raw_text, potential_json_from_ocr, parse_or_ocr)
        return final_text, json_data, method
        
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
        
        # Nettoyer le JSON des watermarks avant retour
        return full_text, remove_water_mark(json_data)
    
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
                
                if overlap > 0 or vertical_distance <= adaptive_threshold:
                    has_overlap = True
                    break
            
            if has_overlap:
                current_line.append(other)
                used_indices.add(j)
        
        # Trier les mots de la ligne par X et ajouter à la liste
        line_words = [item["word"] for item in current_line]
        line_words.sort(key=lambda w: w["geometry"][0][0])
        lines.append({"words": line_words, "geometry": []})
    
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
    result_lines = []
    
    # Trier tous les mots fusionnés par Y puis X
    all_merged_sorted = sorted(merged_words, key=lambda w: ((w["y0"] + w["y1"]) / 2, w["x0"]))
    
    # Si pas de tableau, formatage simple pour toute la page
    if not tables:
        for word in all_merged_sorted:
            # Format simple avec indentation proportionnelle
            indent = int(word["x0"] / spacing_factor)
            result_lines.append(" " * indent + word["text"])
        
        return "\n".join(result_lines)
    
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
    
    # Trier TOUTES les lignes par position Y pour reconstituer l'ordre naturel
    all_lines_with_position.sort(key=lambda x: x[0])
    
    # Extraire juste le texte (sans la position Y)
    final_text = "\n".join(line_text for y_pos, line_text in all_lines_with_position)
    
    return final_text



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
            
            # RÈGLE 2 : NE PAS fusionner si un des mots est une unité seule (T, U, M3, etc.)
            # Car les unités doivent rester dans leurs propres colonnes !
            w1_text_upper = w1["text"].upper().strip()
            w2_text_upper = w2["text"].upper().strip()
            units_alone = ["T", "U", "M3", "M²", "M2", "KG", "L", "ML", "CL", "G", "MG", "KM", "M", "CM", "MM"]
            
            # Si l'un des deux mots est une unité seule, NE PAS fusionner
            if w1_text_upper in units_alone or w2_text_upper in units_alone:
                continue  # ❌ Ne pas fusionner les unités avec leurs voisins !
            
            # RÈGLE 3 : Vérifier si proches (même ligne, petit gap)
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
    
    # Regrouper les mots par cluster
    clusters = {}
    for i in range(n):
        root = find(i)
        if root not in clusters:
            clusters[root] = []
        clusters[root].append(words[i])
    
    # Créer les mots fusionnés
    merged = []
    for cluster_words in clusters.values():
        if cluster_words:
            merged.append(create_merged_word(cluster_words))
    
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
                    break
        
        if not should_remove:
            final_merged.append(word)
    
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
    - PAS de lettres (sauf € à la fin, ou unités comme T, U, M3, KG, etc.)
    - PAS de slash "/" (dates)
    - Doit être convertible en nombre
    - Si > 100 et sans virgule → ID
    
    Args:
        text: Texte à vérifier
        
    Returns:
        True si c'est un vrai nombre (prix/quantité) ou une unité
    """
    if not text:
        return False
    
    # RÈGLE SPÉCIALE : Unités seules (T, U, M3, KG, L, etc.)
    # Ces mots sont considérés comme des "nombres" car font partie des tableaux numériques
    text_upper = text.upper().strip()
    units_alone = ["T", "U", "M3", "M²", "M2", "KG", "L", "ML", "CL", "G", "MG", "KM", "M", "CM", "MM"]
    if text_upper in units_alone:
        return True
    
    # RÈGLE 1 : Exclure les slashes (dates comme "31/07/2025", "1/1")
    if "/" in text:
        return False
    
    # RÈGLE 2 : Vérifier les lettres
    # Enlever les symboles autorisés ET les unités
    text_clean = text.replace("€", "").replace("%", "").replace(" ", "").replace(",", "").replace(".", "").strip()
    
    # Enlever aussi les unités courantes à la fin
    for unit in ["T", "U", "M3", "M²", "M2", "KG", "L", "ML", "CL", "G", "MG", "KM", "M", "CM", "MM"]:
        if text_clean.upper().endswith(unit):
            text_clean = text_clean[:-len(unit)]
    
    # S'il reste des lettres APRÈS avoir enlevé les unités, ce n'est pas un nombre
    if any(c.isalpha() for c in text_clean):
        return False
    
    # RÈGLE 3 : Pas de virgule/point à la fin sans chiffres après
    if text.rstrip("€% ").endswith(",") or text.rstrip("€% ").endswith("."):
        return False
    
    # RÈGLE 4 : Pas de nombre commençant par 0 (sauf "0" tout seul ou "0,xx")
    # Ex: "00027", "00491", "098709" = codes, pas des prix
    if text_clean.startswith("0") and len(text_clean) > 1 and "," not in text and "." not in text:
        return False
    
    # RÈGLE 5 : Doit être convertible en nombre (après suppression des unités)
    if text_clean:  # S'il reste quelque chose après nettoyage
        try:
            # Nettoyer pour conversion
            value_str = text_clean.replace(",", ".")  # Format français → format Python
            
            value = float(value_str)
            
            # RÈGLE 6 : Si > 100 sans virgule/point, c'est probablement un ID
            if value > 100 and "," not in text and "." not in text:
                return False
            
            return True
            
        except ValueError:
            return False
    
    # Si text_clean est vide, c'était juste une unité
    return True


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


def remove_overlapping_tables(tables: List[Dict]) -> List[Dict]:
    """
    Élimine les tableaux qui s'intersectent en gardant le plus grand en surface.
    
    Si deux tableaux se chevauchent, on calcule leur surface et on garde uniquement
    le plus grand. Cela évite d'avoir des sous-tableaux redondants.
    
    Args:
        tables: Liste des tableaux détectés
        
    Returns:
        Liste des tableaux filtrés (sans chevauchements)
    """
    if len(tables) <= 1:
        return tables
    
    # Calculer la surface de chaque tableau
    for table in tables:
        bbox = table["bbox"]
        width = bbox["x_max"] - bbox["x_min"]
        height = bbox["y_max"] - bbox["y_min"]
        table["surface"] = width * height
    
    # Trier par surface décroissante
    tables_sorted = sorted(tables, key=lambda t: t["surface"], reverse=True)
    
    # Garder les tableaux qui ne s'intersectent pas avec des plus grands
    tables_kept = []
    
    for i, table1 in enumerate(tables_sorted):
        bbox1 = table1["bbox"]
        is_overlapping = False
        
        # Vérifier si ce tableau chevauche un tableau plus grand (déjà gardé)
        for table2 in tables_kept:
            bbox2 = table2["bbox"]
            
            # Calculer l'intersection
            x_overlap = min(bbox1["x_max"], bbox2["x_max"]) - max(bbox1["x_min"], bbox2["x_min"])
            y_overlap = min(bbox1["y_max"], bbox2["y_max"]) - max(bbox1["y_min"], bbox2["y_min"])
            
            # S'il y a une intersection (chevauchement)
            if x_overlap > 0 and y_overlap > 0:
                is_overlapping = True
                break
        
        # Garder seulement si ne chevauche pas un plus grand
        if not is_overlapping:
            tables_kept.append(table1)
    
    # Retirer le champ temporaire "surface"
    for table in tables_kept:
        table.pop("surface", None)
    
    return tables_kept


def detect_tables_by_alignment_growing(numeric_words: List[Dict],
                                       all_words: List[Dict],
                                       align_tolerance: float = 0.015,
                                       proximity_tolerance_h: float = 0.25,
                                       proximity_tolerance_v: float = 0.0625,
                                       max_text_ratio: float = 0.0,
                                       min_numbers: int = 4,
                                       min_rows: int = 2,
                                       min_cols: int = 2) -> List[Dict]:
    """
    Détecte les tableaux par croissance organique basée sur les alignements ET la proximité.
    AVEC filtre progressif de texte à chaque ajout.
    
    Principe : 
    1. Partir d'un nombre "seed"
    2. Pour chaque nombre candidat ALIGNÉ + PROCHE :
       a) Simuler son ajout au tableau
       b) Vérifier le ratio texte/nombres dans la zone résultante
       c) Si trop de texte → REJETER ce candidat (mais continuer avec autres)
       d) Sinon → ACCEPTER et ajouter au tableau
    3. Le tableau grandit récursivement jusqu'à épuisement
    
    Args:
        numeric_words: Liste des nombres fusionnés
        all_words: TOUS les mots de la page (pour calculer le ratio texte)
        align_tolerance: Tolérance pour considérer deux bords alignés (défaut 1.5%)
        proximity_tolerance_h: Distance max HORIZONTALE pour être voisin direct (défaut 25%)
        proximity_tolerance_v: Distance max VERTICALE pour être voisin direct (défaut 6.25% = H/4)
        max_text_ratio: Ratio max de texte accepté (défaut 0% - seules les unités sont acceptées)
        min_numbers: Nombre minimum de chiffres pour valider un tableau (défaut 4)
        min_rows: Nombre minimum de lignes pour valider un tableau (défaut 2)
        min_cols: Nombre minimum de colonnes pour valider un tableau (défaut 2)
        
    Returns:
        Liste des tableaux détectés avec leurs bounding boxes et nombres
    """
    if len(numeric_words) < min_numbers:
        return []
    
    # Créer un index pour chaque nombre (pour tracking)
    indexed_numbers = [(i, word) for i, word in enumerate(numeric_words)]
    used_indices = set()
    tables = []
    rejected_additions = 0  # Compteur pour debug
    
    for seed_idx, seed_word in indexed_numbers:
        if seed_idx in used_indices:
            continue
        
        # Créer un nouveau tableau potentiel à partir de ce seed
        table_indices = {seed_idx}
        table_numbers = [seed_word]
        to_explore = [seed_word]
        
        # Exploration récursive (BFS)
        while to_explore:
            current = to_explore.pop(0)
            
            # Chercher tous les nombres alignés ET PROCHES avec current
            for candidate_idx, candidate in indexed_numbers:
                if candidate_idx in table_indices:
                    continue
                
                # ====== VÉRIFICATION 1 : ALIGNEMENT ======
                aligned_left = abs(candidate["x0"] - current["x0"]) < align_tolerance
                aligned_right = abs(candidate["x1"] - current["x1"]) < align_tolerance
                aligned_top = abs(candidate["y0"] - current["y0"]) < align_tolerance
                aligned_bottom = abs(candidate["y1"] - current["y1"]) < align_tolerance
                
                is_aligned = aligned_left or aligned_right or aligned_top or aligned_bottom
                
                if not is_aligned:
                    continue
                
                # ====== VÉRIFICATION 2 : PROXIMITÉ (voisin direct) ======
                # Calculer les distances horizontale et verticale séparément
                current_x_center = (current["x0"] + current["x1"]) / 2
                current_y_center = (current["y0"] + current["y1"]) / 2
                candidate_x_center = (candidate["x0"] + candidate["x1"]) / 2
                candidate_y_center = (candidate["y0"] + candidate["y1"]) / 2
                
                # Distances séparées (pas euclidienne, mais comparaison directe)
                h_distance = abs(candidate_x_center - current_x_center)
                v_distance = abs(candidate_y_center - current_y_center)
                
                # Le candidat doit être PROCHE selon les deux axes
                # Plus permissif horizontalement (tableaux larges) que verticalement (lignes serrées)
                is_close_h = h_distance < proximity_tolerance_h
                is_close_v = v_distance < proximity_tolerance_v
                
                if not (is_close_h and is_close_v):
                    continue  # ❌ Trop loin, même si aligné !
                
                # ====== VÉRIFICATION 3 : FILTRE PROGRESSIF TEXTE (NOUVEAU !) ======
                # Simuler l'ajout du candidat pour calculer la nouvelle bbox
                temp_numbers = table_numbers + [candidate]
                temp_x_min = min(w["x0"] for w in temp_numbers)
                temp_x_max = max(w["x1"] for w in temp_numbers)
                temp_y_min = min(w["y0"] for w in temp_numbers)
                temp_y_max = max(w["y1"] for w in temp_numbers)
                
                # Compter les mots dans cette zone simulée
                words_in_simulated_zone = []
                numeric_in_simulated_zone = 0
                
                for word in all_words:
                    word_x_center = (word["x0"] + word["x1"]) / 2
                    word_y_center = (word["y0"] + word["y1"]) / 2
                    
                    if (temp_x_min <= word_x_center <= temp_x_max and
                        temp_y_min <= word_y_center <= temp_y_max):
                        words_in_simulated_zone.append(word)
                        
                        if is_numeric_value(word["text"]):
                            numeric_in_simulated_zone += 1
                
                # Calculer le ratio de texte
                total_in_zone = len(words_in_simulated_zone)
                
                if total_in_zone > 0:
                    text_ratio = (total_in_zone - numeric_in_simulated_zone) / total_in_zone
                    
                    if text_ratio > max_text_ratio:
                        # ❌ Trop de texte si on ajoutait ce candidat → REJETER uniquement ce candidat
                        rejected_additions += 1
                        continue  # Ne PAS ajouter ce candidat, mais continuer avec les autres !
                
                # ✅ ALIGNÉ + PROCHE + RATIO TEXTE OK → Ajouter au tableau
                table_indices.add(candidate_idx)
                table_numbers.append(candidate)
                to_explore.append(candidate)
        
        # Marquer tous ces nombres comme utilisés
        used_indices.update(table_indices)
        
        # Valider le tableau avant de l'ajouter
        if len(table_numbers) >= min_numbers:
            # Vérifier qu'on a bien au moins min_rows lignes ET min_cols colonnes
            validation_result = validate_table_structure(table_numbers, align_tolerance, min_rows, min_cols)
            
            if validation_result["is_valid"]:
                # Calculer la bounding box englobante
                x_min = min(w["x0"] for w in table_numbers)
                x_max = max(w["x1"] for w in table_numbers)
                y_min = min(w["y0"] for w in table_numbers)
                y_max = max(w["y1"] for w in table_numbers)
                
                # Ajouter une petite marge
                margin = 0.02
                
                tables.append({
                    "bbox": {
                        "x_min": x_min - margin,
                        "x_max": x_max + margin,
                        "y_min": y_min - margin,
                        "y_max": y_max + margin
                    },
                    "numbers": table_numbers,
                    "count": len(table_numbers),
                    "rows": validation_result["rows"],
                    "cols": validation_result["cols"]
                })
    
    # Éliminer les tableaux qui s'intersectent (garder le plus grand)
    tables = remove_overlapping_tables(tables)
    
    return tables


def validate_table_structure(numbers: List[Dict], 
                             tolerance: float,
                             min_rows: int = 2,
                             min_cols: int = 2) -> Dict:
    """
    Valide qu'un groupe de nombres forme bien une structure de tableau.
    
    Vérifie qu'il y a au moins min_rows lignes distinctes ET min_cols colonnes distinctes.
    
    Args:
        numbers: Liste des nombres du tableau potentiel
        tolerance: Tolérance pour regrouper les positions
        min_rows: Nombre minimum de lignes requises
        min_cols: Nombre minimum de colonnes requises
        
    Returns:
        Dict avec is_valid, rows, cols
    """
    if len(numbers) < 2:
        return {"is_valid": False, "rows": 0, "cols": 0}
    
    # Collecter toutes les positions Y (pour les lignes)
    y_positions = [(w["y0"] + w["y1"]) / 2 for w in numbers]
    
    # Collecter toutes les positions X (pour les colonnes)
    x_positions = [(w["x0"] + w["x1"]) / 2 for w in numbers]
    
    # Regrouper les positions similaires (clustering)
    def cluster_positions(positions: List[float], tol: float) -> int:
        if not positions:
            return 0
        
        sorted_pos = sorted(positions)
        clusters = []
        current_cluster = [sorted_pos[0]]
        
        for pos in sorted_pos[1:]:
            if pos - current_cluster[-1] <= tol:
                current_cluster.append(pos)
            else:
                clusters.append(current_cluster)
                current_cluster = [pos]
        
        if current_cluster:
            clusters.append(current_cluster)
        
        return len(clusters)
    
    num_rows = cluster_positions(y_positions, tolerance * 2)  # Tolérance plus large pour les lignes
    num_cols = cluster_positions(x_positions, tolerance * 2)
    
    is_valid = num_rows >= min_rows and num_cols >= min_cols
    
    return {
        "is_valid": is_valid,
        "rows": num_rows,
        "cols": num_cols
    }


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




async def visualize_ocr_boxes_comparison_pages(file, force_ocr: bool = False) -> List[bytes]:
    """
    Version multi-pages de visualize_ocr_boxes_comparison: retourne une image combinée par page.
    Retourne une liste de PNG (bytes), une par page, dans l'ordre.
    """
    # Sauvegarder temporairement le fichier
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    await file.seek(0)

    images_per_page: List[bytes] = []
    try:
        # Tenter parsing ou OCR selon le paramètre
        if not force_ocr:
            try:
                _, json_data = await parse_pdf_with_boxes(file)
                method = "parse"
            except Exception:
                await file.seek(0)
                _, json_data = await ocr_this(file)
                json_data = remove_water_mark(json_data)
                method = "ocr"
        else:
            _, json_data = await ocr_this(file)
            json_data = remove_water_mark(json_data)
            method = "ocr"

        # Ouvrir le PDF
        pdf_document = fitz.open(tmp_path)
        num_pages = len(pdf_document)
        if num_pages == 0:
            raise Exception("PDF vide")

        for page_index in range(num_pages):
            page = pdf_document[page_index]
            mat = fitz.Matrix(2, 2)
            pix = page.get_pixmap(matrix=mat)
            base_img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            img_width, img_height = base_img.size

            page_data = json_data.get("pages", [])[page_index] if json_data.get("pages") else None
            if not page_data:
                continue

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

            # IMAGE 1 : mots originaux
            img1 = base_img.copy()
            draw1 = ImageDraw.Draw(img1)
            for word_info in all_words:
                x0_pixel = int(word_info["x0"] * img_width)
                y0_pixel = int(word_info["y0"] * img_height)
                x1_pixel = int(word_info["x1"] * img_width)
                y1_pixel = int(word_info["y1"] * img_height)
                draw1.rectangle([(x0_pixel, y0_pixel), (x1_pixel, y1_pixel)], outline="green", width=2)

            # IMAGE 2 : mots fusionnés
            merged_words = merge_close_words_horizontally(all_words, distance_threshold=0.015)
            img2 = base_img.copy()
            draw2 = ImageDraw.Draw(img2)
            for merged_info in merged_words:
                x0_pixel = int(merged_info["x0"] * img_width)
                y0_pixel = int(merged_info["y0"] * img_height)
                x1_pixel = int(merged_info["x1"] * img_width)
                y1_pixel = int(merged_info["y1"] * img_height)
                draw2.rectangle([(x0_pixel, y0_pixel), (x1_pixel, y1_pixel)], outline="blue", width=3)
                try:
                    draw2.text((x0_pixel, y0_pixel - 15), merged_info["text"][:20], fill="red")
                except:
                    pass

            # IMAGE 3 : nombres + grilles
            img3 = base_img.copy()
            draw3 = ImageDraw.Draw(img3)

            all_numeric_original = [w for w in all_words if is_numeric_value(w["text"])]
            all_numeric_merged = merge_close_numbers(all_numeric_original, h_gap_threshold=0.01)

            for word in all_numeric_merged:
                x0_pixel = int(word["x0"] * img_width)
                y0_pixel = int(word["y0"] * img_height)
                x1_pixel = int(word["x1"] * img_width)
                y1_pixel = int(word["y1"] * img_height)
                draw3.rectangle([(x0_pixel, y0_pixel), (x1_pixel, y1_pixel)], outline="cyan", width=3)
                try:
                    draw3.text((x0_pixel, y0_pixel - 12), word["text"], fill="magenta")
                except:
                    pass

            tables = detect_tables_by_alignment_growing(all_numeric_merged, all_words)
            if tables:
                for table_info in tables:
                    bbox = table_info["bbox"]
                    original_numeric_in_table = []
                    for word in all_words:
                        word_x_center = (word["x0"] + word["x1"]) / 2
                        word_y_center = (word["y0"] + word["y1"]) / 2
                        if (bbox["x_min"] <= word_x_center <= bbox["x_max"] and
                            bbox["y_min"] <= word_y_center <= bbox["y_max"] and
                            is_numeric_value(word["text"])):
                            original_numeric_in_table.append(word)

                    if original_numeric_in_table:
                        grid_lines = detect_table_grid_lines(original_numeric_in_table, align_tolerance=0.01)

                        h_lines_top = grid_lines["h_lines_top"]
                        h_lines_bottom = grid_lines["h_lines_bottom"]
                        h_zones_visual = []
                        for h_top in h_lines_top:
                            matching_bottom = None
                            min_distance = float('inf')
                            for h_bottom in h_lines_bottom:
                                if h_bottom > h_top:
                                    distance = h_bottom - h_top
                                    if distance < min_distance:
                                        min_distance = distance
                                        matching_bottom = h_bottom
                            if matching_bottom is None:
                                matching_bottom = h_top + 0.01
                            h_zones_visual.append((h_top, matching_bottom))

                        overlay = Image.new('RGBA', img3.size, (255, 255, 255, 0))
                        draw_overlay = ImageDraw.Draw(overlay)
                        for zone_idx, (h_top, h_bottom) in enumerate(h_zones_visual):
                            y_top_pixel = int(h_top * img_height)
                            y_bottom_pixel = int(h_bottom * img_height)
                            x_start = 0
                            x_end = img_width
                            color = (255, 255, 0, 60) if zone_idx % 2 == 0 else (255, 165, 0, 60)
                            draw_overlay.rectangle([(x_start, y_top_pixel), (x_end, y_bottom_pixel)], fill=color)
                        img3 = Image.alpha_composite(img3.convert('RGBA'), overlay).convert('RGB')
                        draw3 = ImageDraw.Draw(img3)

                        for v_line_x in grid_lines["v_lines"]:
                            x_pixel = int(v_line_x * img_width)
                            y_start = int(bbox["y_min"] * img_height)
                            y_end = int(bbox["y_max"] * img_height)
                            draw3.line([(x_pixel, y_start), (x_pixel, y_end)], fill="yellow", width=2)
                        for h_line_y in grid_lines["h_lines_top"]:
                            y_pixel = int(h_line_y * img_height)
                            x_start = int(bbox["x_min"] * img_width)
                            x_end = int(bbox["x_max"] * img_width)
                            draw3.line([(x_start, y_pixel), (x_end, y_pixel)], fill="yellow", width=3)
                        for h_line_y in grid_lines["h_lines_bottom"]:
                            y_pixel = int(h_line_y * img_height)
                            x_start = int(bbox["x_min"] * img_width)
                            x_end = int(bbox["x_max"] * img_width)
                            draw3.line([(x_start, y_pixel), (x_end, y_pixel)], fill="orange", width=3)

                    x_min_pixel = int(bbox["x_min"] * img_width)
                    x_max_pixel = int(bbox["x_max"] * img_width)
                    y_min_pixel = int(bbox["y_min"] * img_height)
                    y_max_pixel = int(bbox["y_max"] * img_height)
                    draw3.rectangle([(x_min_pixel, y_min_pixel), (x_max_pixel, y_max_pixel)], outline="purple", width=5)

            # Orphelins
            orphan_words_visual = []
            if tables:
                for table_info in tables:
                    bbox = table_info["bbox"]
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
                    for word in merged_words:
                        word_y0 = word["y0"]
                        word_y1 = word["y1"]
                        if word_y1 < bbox["y_min"] or word_y0 > bbox["y_max"]:
                            continue
                        has_intersection = False
                        for h_top, h_bottom in h_zones_calc:
                            intersection = max(0, min(word_y1, h_bottom) - max(word_y0, h_top))
                            if intersection > 0:
                                has_intersection = True
                                break
                        if not has_intersection:
                            orphan_words_visual.append(word)

            for merged_info in merged_words:
                x0_pixel = int(merged_info["x0"] * img_width)
                y0_pixel = int(merged_info["y0"] * img_height)
                x1_pixel = int(merged_info["x1"] * img_width)
                y1_pixel = int(merged_info["y1"] * img_height)
                is_orphan = any(
                    w["x0"] == merged_info["x0"] and w["y0"] == merged_info["y0"]
                    for w in orphan_words_visual
                )
                if is_orphan:
                    color = "red"; width = 3
                else:
                    in_table = False
                    if tables:
                        word_y_center = (merged_info["y0"] + merged_info["y1"]) / 2
                        for table_info in tables:
                            table_bbox = table_info["bbox"]
                            if table_bbox["y_min"] <= word_y_center <= table_bbox["y_max"]:
                                in_table = True
                                break
                    color = "lightblue" if in_table else "darkblue"; width = 2
                ImageDraw.Draw(img3).rectangle([(x0_pixel, y0_pixel), (x1_pixel, y1_pixel)], outline=color, width=width)

            # Composer image combinée par page
            combined_width = img_width * 3 + 80
            combined_height = img_height + 80
            combined_img = Image.new('RGB', (combined_width, combined_height), color='white')
            combined_img.paste(img1, (20, 40))
            combined_img.paste(img2, (img_width + 40, 40))
            combined_img.paste(img3, (img_width * 2 + 60, 40))
            draw_combined = ImageDraw.Draw(combined_img)
            method_label = f"IMAGE 1: Mots originaux [{method.upper()}] (vert) - Page {page_index + 1}"
            draw_combined.text((20, 10), method_label, fill="black")
            draw_combined.text((img_width + 40, 10), "IMAGE 2: Mots fusionnés (bleu)", fill="black")
            title_x = img_width * 2 + 60
            draw_combined.text((title_x, 10), "IMAGE 3: Zones H + Mots fusionnés + Grille", fill="black")

            combined_byte_arr = io.BytesIO()
            combined_img.save(combined_byte_arr, format='PNG')
            combined_byte_arr.seek(0)
            images_per_page.append(combined_byte_arr.getvalue())

        pdf_document.close()
        return images_per_page
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


async def visualize_ocr_boxes_pages(file) -> List[bytes]:
    """
    Version multi-pages de visualize_ocr_boxes: retourne une image par page (PNG bytes) avec les boxes OCR.
    """
    # Sauvegarder temporairement le fichier
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    await file.seek(0)

    images_per_page: List[bytes] = []
    try:
        # OCR (on veut les boxes complètes quel que soit le parsing)
        _, json_data = await ocr_this(file)
        json_data = remove_water_mark(json_data)

        pdf_document = fitz.open(tmp_path)
        num_pages = len(pdf_document)
        if num_pages == 0:
            raise Exception("PDF vide")

        for page_index in range(num_pages):
            page = pdf_document[page_index]
            mat = fitz.Matrix(2, 2)
            pix = page.get_pixmap(matrix=mat)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            draw = ImageDraw.Draw(img)
            img_width, img_height = img.size

            page_data = json_data.get("pages", [])[page_index] if json_data.get("pages") else None
            if not page_data:
                continue

            for block in page_data.get("blocks", []):
                for line in block.get("lines", []):
                    words = line.get("words", [])
                    line_x_coords: List[int] = []
                    line_y_coords: List[int] = []
                    for word in words:
                        geom = word.get("geometry", None)
                        word_text = word.get("value", "")
                        if geom is None:
                            continue
                        if isinstance(geom, (list, tuple)) and len(geom) == 2:
                            pt1, pt2 = geom
                            if isinstance(pt1, (list, tuple)) and isinstance(pt2, (list, tuple)):
                                x0, y0 = pt1[0], pt1[1]
                                x1, y1 = pt2[0], pt2[1]
                                x0_pixel = int(x0 * img_width)
                                y0_pixel = int(y0 * img_height)
                                x1_pixel = int(x1 * img_width)
                                y1_pixel = int(y1 * img_height)
                                draw.rectangle([(x0_pixel, y0_pixel), (x1_pixel, y1_pixel)], outline="green", width=2)
                                try:
                                    if word_text:
                                        draw.text((x0_pixel, y0_pixel - 15), word_text, fill="blue")
                                except:
                                    pass
                                line_x_coords.extend([x0_pixel, x1_pixel])
                                line_y_coords.extend([y0_pixel, y1_pixel])
                    if line_x_coords and line_y_coords:
                        x_min = min(line_x_coords)
                        x_max = max(line_x_coords)
                        y_min = min(line_y_coords)
                        y_max = max(line_y_coords)
                        draw.rectangle([(x_min, y_min), (x_max, y_max)], outline="red", width=3)

            img_byte_arr = io.BytesIO()
            img.save(img_byte_arr, format='PNG')
            img_byte_arr.seek(0)
            images_per_page.append(img_byte_arr.getvalue())

        pdf_document.close()
        return images_per_page
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


async def render_large_word_confidence_preview(
    file,
    height_ratio_threshold: float = 0.01,
    confidence_threshold: float = 0.6,
    page_index: int = 0,
) -> bytes:
    """
    Génère une image PNG (une page) avec les mots de grande taille encadrés selon leur
    confiance OCR. Vert = mot bien lu, Rouge = mot mal lu.
    """
    if page_index < 0:
        raise ValueError("L'index de page doit être positif.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    await file.seek(0)

    try:
        _, json_data = await ocr_this(file)
        json_data = remove_water_mark(json_data)

        pdf_document = fitz.open(tmp_path)
        num_pages = len(pdf_document)
        if num_pages == 0:
            raise ValueError("PDF vide.")
        if page_index >= num_pages:
            raise ValueError(f"Page {page_index} inexistante (max {num_pages - 1}).")

        page = pdf_document[page_index]
        mat = fitz.Matrix(2, 2)
        pix = page.get_pixmap(matrix=mat)
        base_img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        img_width, img_height = base_img.size
        draw = ImageDraw.Draw(base_img)

        if not json_data or "pages" not in json_data:
            raise ValueError("JSON OCR indisponible.")

        pages = json_data.get("pages", [])
        if page_index >= len(pages):
            raise ValueError("Les données OCR ne contiennent pas cette page.")

        page_data = pages[page_index]
        highlighted = 0

        for block in page_data.get("blocks", []):
            for line in block.get("lines", []):
                for word in line.get("words", []):
                    geometry = word.get("geometry")
                    if (
                        geometry is None
                        or not isinstance(geometry, (list, tuple))
                        or len(geometry) != 2
                    ):
                        continue

                    (x0, y0), (x1, y1) = geometry
                    try:
                        height_ratio = max(0.0, float(y1) - float(y0))
                    except (TypeError, ValueError):
                        continue

                    if height_ratio < height_ratio_threshold:
                        continue

                    confidence_value = word.get("confidence")
                    try:
                        confidence_float = float(confidence_value)
                    except (TypeError, ValueError):
                        continue

                    is_good = confidence_float >= confidence_threshold
                    color = "green" if is_good else "red"
                    highlighted += 1
                    x0_px = int(float(x0) * img_width)
                    y0_px = int(float(y0) * img_height)
                    x1_px = int(float(x1) * img_width)
                    y1_px = int(float(y1) * img_height)
                    draw.rectangle([(x0_px, y0_px), (x1_px, y1_px)], outline=color, width=4)
                    if not is_good:
                        word_value = str(word.get("value") or "")
                        if word_value:
                            text_x = max(0, x0_px)
                            text_y = max(0, y0_px - 20)
                            draw.text((text_x, text_y), word_value[:25], fill="red")

        label = (
            f"Mots >= {height_ratio_threshold*100:.1f}% hauteur | "
            f"Seuil confiance {confidence_threshold:.2f} | "
            f"Surlignés: {highlighted}"
        )
        draw.text((20, 20), label, fill="black")

        output = io.BytesIO()
        base_img.save(output, format="PNG")
        output.seek(0)
        return output.getvalue()
    finally:
        if 'pdf_document' in locals():
            pdf_document.close()
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
