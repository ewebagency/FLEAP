from fastapi import UploadFile
from collections import defaultdict
from paddleocr import PaddleOCR
import tempfile
import os

# Configuration PaddleOCR
ocr = PaddleOCR(   
    use_angle_cls=True,
)

async def run_paddle_ocr(file: UploadFile):
    """Traite un PDF avec PaddleOCR"""
    # Lire le contenu du fichier
    contents = await file.read()

    # Sauvegarder temporairement le fichier
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        # OCR sur le PDF (PaddleOCR gère automatiquement les multi-pages)
        print(f"🔍 Début OCR PaddleOCR sur: {file.filename}")
        result = ocr.predict(tmp_path)
        print("="*30, "Résultat PaddleOCR", "="*30)
        print(result[0]["rec_texts"])
        print("="*60)
        # Extraire le texte
        extracted_text = extract_text_from_result(result)
        
        # Nettoyer le résultat pour la sérialisation JSON
        cleaned_result = clean_paddle_result(result)
        
        print(f"✅ OCR terminé - {len(extracted_text)} caractères extraits")
        
        return {
            "text": extracted_text, 
            "raw_result": cleaned_result,
            "pages_count": len(result) if result else 0
        }
    
    except Exception as e:
        print(f"❌ Erreur lors de l'OCR: {str(e)}")
        return {
            "text": "",
            "raw_result": None,
            "error": str(e),
            "pages_count": 0
        }
    
    finally:
        # Nettoyer le fichier temporaire
        try:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
        except PermissionError:
            # Si on ne peut pas supprimer le fichier, on l'ignore
            pass


def group_lines(rec_texts, rec_boxes, y_thresh=10):
    """Groupe les mots en lignes basées sur leur position Y"""
    lines = defaultdict(list)
    
    for text, box in zip(rec_texts, rec_boxes):
        x1, y1, x2, y2 = box
        y_center = (y1 + y2) / 2

        # Trouver une ligne existante proche en Y
        found_line = None
        for ly in lines:
            if abs(ly - y_center) < y_thresh:
                found_line = ly
                break
        
        if found_line is None:
            found_line = y_center
        
        lines[found_line].append((x1, text))

    # Trier chaque ligne par X
    sorted_lines = []
    for ly in sorted(lines):
        line_text = " ".join([t for _, t in sorted(lines[ly], key=lambda x: x[0])])
        sorted_lines.append(line_text)
    
    return "\n".join(sorted_lines)

def extract_text_from_result(result):
    """Extrait le texte d'un résultat PaddleOCR multi-pages"""
    all_text = []
    
    if not result:
        return ""
    
    for page in result:  # multi-pages possible
        if page and "rec_texts" in page and "rec_boxes" in page:
            lines_text = group_lines(page["rec_texts"], page["rec_boxes"])
            all_text.append(lines_text)
    
    return "\n".join(all_text)

def clean_paddle_result(result):
    """Nettoie le résultat PaddleOCR pour la sérialisation JSON"""
    if not result:
        return None
    
    cleaned_result = []
    for page in result:
        if page and "rec_texts" in page and "rec_boxes" in page:
            # Convertir les arrays numpy en listes Python
            cleaned_page = {
                "rec_texts": [str(text) for text in page["rec_texts"]],
                "rec_boxes": [[float(coord) for coord in box] for box in page["rec_boxes"]]
            }
            cleaned_result.append(cleaned_page)
    
    return cleaned_result

