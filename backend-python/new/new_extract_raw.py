from new.extract_utils.parse import parse_pdf_file
from new.extract_utils.mindee import send_to_mindee
from new.extract_utils.ocr import ocr_this
import time
import sys

def log_with_timestamp(message, level="INFO"):
    """Log avec timestamp pour le debugging sur Render"""
    timestamp = time.strftime("%H:%M:%S")
    print(f"[{timestamp}] {level}: {message}", flush=True)
    sys.stdout.flush()

async def get_raw_text_from_pdf(file, doc_type):
    log_with_timestamp(f"🚀 DÉBUT get_raw_text_from_pdf() - doc_type: {doc_type}", "EXTRACT_START")
    
    try:
        log_with_timestamp("📄 Tentative parsing PDF", "EXTRACT_PARSE_START")
        parsed_result = await parse_pdf_file(file)
        log_with_timestamp("✅ Parsing PDF terminé", "EXTRACT_PARSE_END")
        
        # Check if parsing was successful (returns string) or failed (returns dict with error)
        if isinstance(parsed_result, str):
            # Parsing succeeded, return the text
            log_with_timestamp("✅ Parsing réussi, utilisation du texte parsé", "EXTRACT_PARSE_SUCCESS")
            parse_or_ocr = "parse"
            # Ensure parsed_result is not None
            if parsed_result is None:
                parsed_result = ""
            log_with_timestamp(f"✅ Retour texte parsé: {len(parsed_result)} caractères", "EXTRACT_PARSE_RETURN")
            return parsed_result, None, parse_or_ocr
        else:
            # Parsing failed, raise exception to go to fallback
            log_with_timestamp(f"❌ Parsing échoué: {parsed_result.get('error', 'Unknown parsing error')}", "EXTRACT_PARSE_ERROR")
            raise Exception(parsed_result.get("error", "Unknown parsing error"))
            
    except Exception as e:
        log_with_timestamp(f"❌ Exception parsing: {e}", "EXTRACT_PARSE_EXCEPTION")
        log_with_timestamp("🔄 Passage au fallback OCR/Mindee", "EXTRACT_FALLBACK")
        
        # Fallback to OCR or Mindee
        if (doc_type == "facture" and False) : # -> False en attendant la Migration Mindee V1 vers V2 (+ RAG)
            log_with_timestamp("🧠 Fallback vers Mindee", "EXTRACT_MINDE_START")
            raw_text, json_mindee = await send_to_mindee(file)
            parse_or_ocr = "mindee"
            # Ensure raw_text is not None
            if raw_text is None:
                raw_text = ""
            log_with_timestamp(f"✅ Mindee terminé: {len(raw_text)} caractères", "EXTRACT_MINDE_SUCCESS")
            return raw_text, json_mindee, parse_or_ocr
        else:
            log_with_timestamp("🔍 Fallback vers OCR", "EXTRACT_OCR_START")
            await file.seek(0)
            log_with_timestamp("📞 Appel ocr_this()", "EXTRACT_OCR_CALL")
            raw_text, json_ocr = await ocr_this(file)
            log_with_timestamp(f"✅ OCR terminé: {len(raw_text)} caractères", "EXTRACT_OCR_SUCCESS")
            parse_or_ocr = "ocr"
            # Ensure raw_text is not None
            if raw_text is None:
                raw_text = ""
            log_with_timestamp("✅ get_raw_text_from_pdf() terminé avec OCR", "EXTRACT_OCR_RETURN")
            return raw_text, json_ocr, parse_or_ocr


