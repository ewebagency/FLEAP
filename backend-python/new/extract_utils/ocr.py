from utils.subprocess_ocr import ocr_in_subprocess
from utils.utils_doctr import ocr_this_pdf_with_doctr
import os
import time
import sys

# Variable d'environnement pour désactiver le subprocess si nécessaire
USE_SUBPROCESS_OCR = os.getenv('USE_SUBPROCESS_OCR', 'true').lower() == 'true'

def log_with_timestamp(message, level="INFO"):
    """Log avec timestamp pour le debugging sur Render"""
    timestamp = time.strftime("%H:%M:%S")
    print(f"[{timestamp}] {level}: {message}", flush=True)
    sys.stdout.flush()

async def ocr_this(file):
    """
    OCR avec fallback automatique : subprocess -> DocTR direct si subprocess échoue
    """
    log_with_timestamp("🚀 DÉBUT ocr_this()", "OCR_START")
    
    if not USE_SUBPROCESS_OCR:
        log_with_timestamp("🔄 Subprocess OCR désactivé, utilisation directe de DocTR", "OCR_CONFIG")
        log_with_timestamp("📄 Appel ocr_this_pdf_with_doctr()", "OCR_DOCTR_START")
        result = await ocr_this_pdf_with_doctr(file)
        log_with_timestamp("✅ ocr_this_pdf_with_doctr() terminé", "OCR_DOCTR_END")
        return result["text"], result["raw_result"]
    
    try:
        log_with_timestamp("🔄 Tentative subprocess OCR", "OCR_SUBPROCESS_START")
        # Essayer d'abord le subprocess pour la libération mémoire
        result = await ocr_in_subprocess(file)
        log_with_timestamp("✅ Subprocess OCR réussi", "OCR_SUBPROCESS_SUCCESS")
        return result["text"], result["raw_result"]
    except Exception as e:
        log_with_timestamp(f"❌ Subprocess OCR échoué: {str(e)}", "OCR_SUBPROCESS_ERROR")
        log_with_timestamp("🔄 Fallback vers OCR DocTR direct...", "OCR_FALLBACK")
        
        # Fallback vers OCR direct sans subprocess
        await file.seek(0)  # Réinitialiser le fichier
        log_with_timestamp("📄 Appel ocr_this_pdf_with_doctr() en fallback", "OCR_DOCTR_FALLBACK_START")
        result = await ocr_this_pdf_with_doctr(file)
        log_with_timestamp("✅ Fallback DocTR réussi", "OCR_DOCTR_FALLBACK_END")
        return result["text"], result["raw_result"]

