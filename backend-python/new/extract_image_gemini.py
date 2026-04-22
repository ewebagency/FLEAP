import json
from typing import Dict, Any
import base64
import io
import os
from fastapi import UploadFile
from dotenv import load_dotenv
import requests

# Imports pour conversion PDF → Image
import fitz  # PyMuPDF - déjà installé, pas besoin de poppler
from PIL import Image

load_dotenv()


def calculate_average_ocr_confidence(json_ocr: Dict | None) -> float:
    """
    Calcule la moyenne des scores de confidence de tous les mots du JSON OCR.
    
    Args:
        json_ocr: Le JSON OCR avec la structure pages/blocks/lines/words
    
    Returns:
        Score moyen entre 0 et 100
    """
    if not json_ocr or "pages" not in json_ocr:
        print("⚠️ JSON OCR invalide ou absent → Score par défaut = 100")
        return 100.0
    
    total_confidence = 0
    word_count = 0
    
    pages = json_ocr.get("pages", [])
    
    for page in pages:
        blocks = page.get("blocks", [])
        
        for block in blocks:
            lines = block.get("lines", [])
            
            for line in lines:
                words = line.get("words", [])
                
                for word in words:
                    confidence = word.get("confidence", 0)
                    total_confidence += confidence
                    word_count += 1
    
    if word_count == 0:
        print("⚠️ Aucun mot trouvé dans le JSON OCR → Score par défaut = 100")
        return 100.0
    
    # Confidence est entre 0 et 1, on multiplie par 100
    average_score = (total_confidence / word_count) * 100
    
    return average_score


def pdf_to_image_base64(file_bytes: bytes, dpi: int = 200, format: str = "JPEG") -> str:
    """
    Convertit la première page d'un PDF en image encodée en base64.
    Utilise PyMuPDF (fitz) - pas besoin de poppler !
    
    Args:
        file_bytes: Bytes du fichier PDF
        dpi: Résolution de l'image (défaut: 200)
        format: Format de l'image (JPEG ou PNG)
    
    Returns:
        String base64 de l'image
    """
    print(f"🖼️  Conversion PDF → Image avec PyMuPDF (DPI: {dpi}, Format: {format})")
    
    # Ouvrir le PDF avec PyMuPDF
    pdf_document = fitz.open(stream=file_bytes, filetype="pdf")
    
    if pdf_document.page_count == 0:
        raise ValueError("Le PDF ne contient aucune page")
    
    # Prendre la première page
    page = pdf_document[0]
    
    # Calculer le zoom pour obtenir le DPI souhaité (default est 72 DPI)
    zoom = dpi / 72
    mat = fitz.Matrix(zoom, zoom)
    
    # Rendre la page en image (pixmap)
    pix = page.get_pixmap(matrix=mat)
    
    # Convertir en PIL Image
    img_data = pix.tobytes("png")  # PyMuPDF → bytes PNG
    image = Image.open(io.BytesIO(img_data))
    
    # Fermer le document PDF
    pdf_document.close()
    
    # Convertir en bytes dans le format souhaité
    img_buffer = io.BytesIO()
    
    if format.upper() == "JPEG":
        # Convertir en RGB si nécessaire (JPEG ne supporte pas la transparence)
        if image.mode in ("RGBA", "LA", "P"):
            image = image.convert("RGB")
        image.save(img_buffer, format="JPEG", quality=95, optimize=True)
    else:
        image.save(img_buffer, format=format.upper())
    
    img_buffer.seek(0)
    
    # Encoder en base64
    img_base64 = base64.b64encode(img_buffer.read()).decode('utf-8')
    
    print(f"✅ Image convertie ({len(img_base64)} caractères en base64)")
    
    return img_base64


def should_use_image_mode(
    potential_json_from_ocr: Dict | None,
    force_image: bool = False,
    force_image_from_rag: bool = False
) -> tuple[bool, float, int, str]:
    """
    Détermine si le mode image doit être utilisé.
    
    Args:
        potential_json_from_ocr: JSON OCR avec métadonnées
        force_image: Force le mode image (utilisateur)
        force_image_from_rag: Force le mode image (RAG)
    
    Returns:
        Tuple (use_image, ocr_score, num_pages, reason)
        - use_image: bool - True si mode image doit être utilisé
        - ocr_score: float - Score OCR moyen
        - num_pages: int - Nombre de pages
        - reason: str - Raison ("manuel", "rag", "score_faible", "none")
    """
    # Calculer le score OCR moyen
    ocr_score = calculate_average_ocr_confidence(potential_json_from_ocr)
    
    # Vérifier le nombre de pages
    num_pages = len(potential_json_from_ocr.get("pages", [])) if potential_json_from_ocr else 0
    
    # Déterminer la raison
    if force_image:
        reason = "manuel"
    elif force_image_from_rag:
        reason = "rag"
    elif ocr_score < 85.7:
        reason = "score_faible"
    else:
        reason = "none"
    
    # Décision : mode image si (score faible OU force manuel OU force RAG) ET une seule page
    use_image = (ocr_score < 85.7 or force_image or force_image_from_rag) and num_pages == 1
    
    return use_image, ocr_score, num_pages, reason


def log_image_mode_decision(use_image: bool, ocr_score: float, num_pages: int, reason: str) -> None:
    """
    Affiche les logs selon la décision prise.
    
    Args:
        use_image: Si mode image utilisé
        ocr_score: Score OCR
        num_pages: Nombre de pages
        reason: Raison de la décision
    """
    if use_image:
        
        reason_text = {
            "manuel": "Manuel",
            "rag": "RAG",
            "score_faible": f"Score OCR {ocr_score:.1f}%"
        }.get(reason, "Inconnu")
        print(f"🖼️ 🖼️ 🖼️ ⚠️  MODE IMAGE activé [{reason_text}] | {num_pages} page | Score: {ocr_score:.1f}%")
        
    else:
        # Logs pour les cas refusés
        if reason == "manuel" and num_pages > 1:
            print(f"⚠️ Force Image demandé mais {num_pages} pages → Mode texte")
        elif reason == "rag" and num_pages > 1:
            print(f"⚠️ RAG demande image mais {num_pages} pages → Mode texte")
        elif reason == "score_faible" and num_pages > 1:
            print(f"⚠️ Score OCR faible ({ocr_score:.1f}%) mais {num_pages} pages → Mode texte")
        else:
            print(f"✅ Mode texte | Score: {ocr_score:.1f}% | Pages: {num_pages}")


async def extract_gemini_with_images(file: UploadFile, prompt: str) -> Dict[str, Any]:
    """
    Envoie la première page du PDF en image à Gemini pour traitement multimodal.
    Utilisé quand le score OCR est trop faible (<85.7%).
    
    Args:
        file: Fichier PDF uploadé
        prompt: Le prompt pour Gemini
    
    Returns:
        Dict avec le même format que extract_gemini() pour compatibilité:
        {"success": True, "text": "", "extracted_data": "..."}
    """
    import gc
    
    try:
        # Lire le fichier PDF
        await file.seek(0)  # S'assurer qu'on est au début du fichier
        pdf_bytes = await file.read()
        
        print(f"📄 PDF: {len(pdf_bytes)} bytes → Conversion image...")
        
        # Convertir en image base64
        image_base64 = pdf_to_image_base64(pdf_bytes, dpi=200, format="JPEG")
        
        # Libérer la mémoire après conversion
        del pdf_bytes
        gc.collect()
        
        # Préparer la requête pour Gemini avec image
        # Format: envoyer l'image inline_data + le prompt
        api_key = os.getenv('GEMINI_API_KEY')
        
        if not api_key:
            return {"error": "GEMINI_API_KEY non trouvée dans les variables d'environnement"}
        
        # Construire la requête avec image + prompt
        request_body = {
            "contents": [
                {
                    "parts": [
                        {
                            "inline_data": {
                                "mime_type": "image/jpeg",
                                "data": image_base64
                            }
                        },
                        {
                            "text": prompt
                        }
                    ]
                }
            ]
        }
        
        print(f"🚀 Appel Gemini (multimodal)...")
        
        # Appel à l'API Gemini
        gemini_response = requests.post(
            "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent",
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": api_key
            },
            json=request_body,
            timeout=120  # Timeout plus long pour le traitement d'image
        )
        
        if not gemini_response.ok:
            error_detail = gemini_response.text
            print(f"❌ Erreur API Gemini: {error_detail}")
            return {"error": f"Failed to get response from Gemini: {error_detail}"}
        
        # Extraire et nettoyer la réponse
        response_json = gemini_response.json()
        raw_extracted_data = response_json.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        
        from utils.utils_gemini import clean_gemini_response
        cleaned_data = clean_gemini_response(raw_extracted_data)
        
        # Valider le JSON
        try:
            json.loads(cleaned_data)
            print(f"✅ Extraction image réussie | {len(cleaned_data)} caractères\n")
            
            return {
                "success": True,
                "text": "",  # Pas de texte OCR dans ce mode
                "extracted_data": cleaned_data
            }
        except json.JSONDecodeError as e:
            print(f"❌ JSON invalide: {str(e)}")
            return {
                "error": f"Invalid JSON from Gemini: {str(e)}",
                "raw_response": raw_extracted_data
            }
    
    except Exception as e:
        print(f"❌ ERREUR dans extract_gemini_with_images: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"error": f"Failed to extract with images: {str(e)}"}

