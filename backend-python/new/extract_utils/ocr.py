from utils.subprocess_ocr import ocr_in_subprocess
from utils.utils_doctr import ocr_this_pdf_with_doctr
import os

# Variable d'environnement pour désactiver le subprocess si nécessaire
USE_SUBPROCESS_OCR = os.getenv('USE_SUBPROCESS_OCR', 'true').lower() == 'true'

async def ocr_this(file):
    """
    OCR avec fallback automatique : subprocess -> DocTR direct si subprocess échoue
    """
    if not USE_SUBPROCESS_OCR:
        print("🔄 Subprocess OCR désactivé, utilisation directe de DocTR")
        result = await ocr_this_pdf_with_doctr(file)
        return result["text"], result["raw_result"]
    
    try:
        # Essayer d'abord le subprocess pour la libération mémoire
        result = await ocr_in_subprocess(file)
        return result["text"], result["raw_result"]
    except Exception as e:
        print(f"⚠️ Subprocess OCR échoué: {e}")
        print("🔄 Fallback vers OCR DocTR direct...")
        
        # Fallback vers OCR direct sans subprocess
        await file.seek(0)  # Réinitialiser le fichier
        result = await ocr_this_pdf_with_doctr(file)
        return result["text"], result["raw_result"]

