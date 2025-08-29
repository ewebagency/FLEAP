import cv2
import numpy as np
import json
import os
from typing import Dict, List, Tuple, Union, Literal
from pathlib import Path
import fitz  # PyMuPDF pour extraire les images des PDFs


def classify_ocr_with_density(file, ocr_json: Dict, threshold: float = 0.02):
    """
    Fonction complète qui lit un PDF depuis un UploadFile et classifie chaque mot
    basé sur la densité basse des pixels.
    
    Args:
        file: Fichier UploadFile (PDF)
        ocr_json: Résultat OCR structuré de DocTR
        threshold: Seuil de classification (défaut: 0.02)
    
    Returns:
        Liste des mots avec leur classification
    """
    results = []
    
    #print(f"🔍 DEBUG: Début de classify_ocr_with_density")
    #print(f"📄 DEBUG: OCR JSON keys: {list(ocr_json.keys())}")
    #print(f"📄 DEBUG: raw_result keys: {list(ocr_json.get('raw_result', {}).keys())}")
    
    try:
        # Réinitialiser le curseur du fichier
        file.file.seek(0)
        
        # Lire le contenu du fichier PDF uploadé
        content = file.file.read()
        #print(f"📄 DEBUG: Taille du contenu PDF: {len(content)} bytes")
        
        # Ouvrir le PDF depuis les bytes
        doc = fitz.open(stream=content, filetype="pdf")
        if doc.page_count == 0:
            raise ValueError("PDF vide ou corrompu")
        
        #print(f"📄 DEBUG: PDF ouvert avec {doc.page_count} pages")
        
        # Obtenir l'image de la première page
        page = doc[0]
        mat = fitz.Matrix(2, 2)  # Zoom 2x pour une meilleure qualité
        pix = page.get_pixmap(matrix=mat)
        img_array = np.frombuffer(pix.samples, dtype=np.uint8).reshape(
            pix.height, pix.width, pix.n
        )
        doc.close()
        
        #print(f"🖼️ DEBUG: Image extraite: {img_array.shape}")
        
        # Parcourir chaque page du résultat OCR
        pages = ocr_json.get('raw_result', {}).get('pages', [])
        #print(f"📄 DEBUG: Nombre de pages OCR: {len(pages)}")
        
        for page_idx, page_data in enumerate(pages):
            #print(f"📄 DEBUG: Traitement page {page_idx}")
            blocks = page_data.get('blocks', [])
            #print(f"📄 DEBUG: Nombre de blocks: {len(blocks)}")
            
            # Parcourir chaque block
            for block_idx, block in enumerate(blocks):
                lines = block.get('lines', [])
                #print(f"📄 DEBUG: Block {block_idx}, nombre de lines: {len(lines)}")
                
                # Parcourir chaque line
                for line_idx, line in enumerate(lines):
                    words = line.get('words', [])
                    #print(f"📄 DEBUG: Line {line_idx}, nombre de words: {len(words)}")
                    
                    # Parcourir chaque word
                    for word_idx, word in enumerate(words):
                        word_text = word.get('value', '').strip()
                        #print(f"📄 DEBUG: Word {word_idx}: '{word_text}'")
                        
                        if word_text:  # Ignorer les espaces vides
                            # Extraire la box de l'image
                            box_geometry = word.get('geometry', [[0, 0], [1, 1]])
                            #print(f"📄 DEBUG: Géométrie: {box_geometry}")
                            
                            try:
                                # Extraire la box depuis l'image de la page
                                box_img = extract_box_from_page_image(img_array, box_geometry)
                                #print(f"📄 DEBUG: Box extraite: {box_img.shape}")
                                
                                # Calculer le ratio de densité basse
                                low_density_ratio = calculate_low_density_ratio(box_img)
                                #print(f"📄 DEBUG: Densité basse: {low_density_ratio}")
                                
                                # Classifier le texte
                                classification = classify_text_by_density(low_density_ratio, threshold)
                                #print(f"📄 DEBUG: Classification: {classification}")
                                
                                # Ajouter le résultat
                                result_item = {
                                    'text': word_text,
                                    'low_density_ratio': low_density_ratio,
                                    'classification': classification,
                                    'confidence': word.get('confidence', 0.0),
                                    'geometry': box_geometry,
                                    'page': page_idx
                                }
                                results.append(result_item)
                                #print(f"✅ DEBUG: Résultat ajouté: {result_item}")
                                
                            except Exception as e:
                                print(f"❌ Erreur lors du traitement du mot '{word_text}': {e}")
                                # Ajouter avec des valeurs par défaut
                                result_item = {
                                    'text': word_text,
                                    'low_density_ratio': 0.0,
                                    'classification': 'printed',
                                    'confidence': word.get('confidence', 0.0),
                                    'geometry': box_geometry,
                                    'page': page_idx
                                }
                                results.append(result_item)
                                #print(f"⚠️ DEBUG: Résultat par défaut ajouté: {result_item}")
    
    except Exception as e:
        print(f"❌ Erreur générale dans classify_ocr_with_density: {e}")
        import traceback
        traceback.print_exc()
    
    #print(f"🔍 DEBUG: Fin de classify_ocr_with_density, {len(results)} résultats")
    return results


def extract_box_from_page_image(page_img: np.ndarray, box_geometry: List[List[float]]) -> np.ndarray:
    """
    Extrait une box d'image depuis l'image de la page
    
    Args:
        page_img: Image de la page (numpy array)
        box_geometry: Géométrie de la box [[x1, y1], [x2, y2]] en coordonnées normalisées
        
    Returns:
        Image de la box extraite
    """
    try:
        # Convertir les coordonnées normalisées en pixels
        height, width = page_img.shape[:2]
        x1 = int(box_geometry[0][0] * width)
        y1 = int(box_geometry[0][1] * height)
        x2 = int(box_geometry[1][0] * width)
        y2 = int(box_geometry[1][1] * height)
        
        # S'assurer que les coordonnées sont valides
        x1 = max(0, min(x1, width - 1))
        y1 = max(0, min(y1, height - 1))
        x2 = max(x1 + 1, min(x2, width))
        y2 = max(y1 + 1, min(y2, height))
        
        # Extraire la box de l'image
        box_img = page_img[y1:y2, x1:x2]
        
        # Vérifier que la box n'est pas vide
        if box_img.size == 0:
            raise ValueError("Box extraite vide")
        
        return box_img
        
    except Exception as e:
        print(f"Erreur dans extract_box_from_page_image: {e}")
        # Retourner une image par défaut (blanche 10x10)
        return np.ones((10, 10), dtype=np.uint8) * 255


def calculate_low_density_ratio(box_img: np.ndarray) -> float:
    """
    Calcule le ratio de densité basse (<100) pour une image de box
    
    Args:
        box_img: Image de la box (numpy array)
        
    Returns:
        ratio: Ratio de pixels sombres par rapport au total
    """
    try:
        # Convertir en niveaux de gris si nécessaire
        if len(box_img.shape) == 3:
            gray_box = cv2.cvtColor(box_img, cv2.COLOR_BGR2GRAY)
        else:
            gray_box = box_img
        
        # Calculer l'histogramme
        hist, bins = np.histogram(gray_box.flatten(), bins=50, range=[0, 255])
        
        # Calculer la somme des densités basses (en dessous de 100)
        low_density_mask = bins[:-1] < 100
        low_density_sum = np.sum(hist[low_density_mask])
        total_pixels = np.sum(hist)
        
        # Retourner le ratio
        return low_density_sum / total_pixels if total_pixels > 0 else 0
        
    except Exception as e:
        print(f"Erreur dans calculate_low_density_ratio: {e}")
        return 0.0


def classify_text_by_density(low_density_ratio: float, threshold: float = 0.02) -> Literal["handwritten", "printed"]:
    """
    Classifie le texte basé sur le ratio de densité basse
    
    Args:
        low_density_ratio: Ratio de pixels sombres
        threshold: Seuil de classification (défaut: 0.02)
        
    Returns:
        "handwritten" si ratio < threshold, "printed" sinon
    """
    return "handwritten" if low_density_ratio < threshold else "printed"


def extract_handwritten_lines(ocr_results: List[Dict], vertical_threshold: float = 0.05):
    """
    Extrait les lignes de texte manuscrit depuis les résultats OCR classifiés.
    
    Args:
        ocr_results: Résultat de classify_ocr_with_density
        vertical_threshold: Seuil pour considérer que deux mots sont sur la même ligne (défaut: 0.05)
    
    Returns:
        Texte avec les lignes manuscrites séparées par des sauts de ligne
    """
    # Filtrer uniquement les mots manuscrits
    handwritten_words = [
        word for word in ocr_results 
        if word.get('classification') == 'handwritten'
    ]
    
    if not handwritten_words:
        return ""
    
    # Trier les mots par position verticale (y) puis horizontale (x)
    handwritten_words.sort(key=lambda w: (
        w.get('geometry', [[0, 0], [0, 0]])[0][1],  # y1
        w.get('geometry', [[0, 0], [0, 0]])[0][0]   # x1
    ))
    
    lines = []
    current_line = []
    current_y = None
    
    for word in handwritten_words:
        geometry = word.get('geometry', [[0, 0], [0, 0]])
        word_y = geometry[0][1]  # Position y du mot
        
        # Si c'est le premier mot ou si le mot est sur la même ligne
        if current_y is None or abs(word_y - current_y) <= vertical_threshold:
            current_line.append(word.get('text', ''))
            if current_y is None:
                current_y = word_y
        else:
            # Nouvelle ligne
            if current_line:
                lines.append(' '.join(current_line))
            current_line = [word.get('text', '')]
            current_y = word_y
    
    # Ajouter la dernière ligne
    if current_line:
        lines.append(' '.join(current_line))
    
    
    # Retourner le texte avec des sauts de ligne
    return '\n'.join(lines)


