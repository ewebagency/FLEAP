from new.extract_utils.parse import parse_pdf_file
from new.extract_utils.mindee import send_to_mindee
from new.extract_utils.ocr import ocr_this


MIN_PARSED_CHARS = 200


async def get_raw_text_from_pdf(file):
    doc_type = "on s'en fout en fait"
    try:
        parsed_result = await parse_pdf_file(file)

        # Check if parsing was successful (returns string) or failed (returns dict with error)
        if isinstance(parsed_result, str):
            # Parsing succeeded, but on vérifie que le texte n'est pas trop court
            if parsed_result is None:
                parsed_result = ""
            if len(parsed_result.strip()) < MIN_PARSED_CHARS:
                # Considérer comme un échec de parsing -> bascule OCR
                raise Exception("Parsed text too short, fallback to OCR")

            parse_or_ocr = "parse"
            return parsed_result, None, parse_or_ocr
        else:
            # Parsing failed, raise exception to go to fallback
            raise Exception(parsed_result.get("error", "Unknown parsing error"))

    except Exception:
        # Fallback to OCR or Mindee
        if (doc_type == "facture" and False):  # -> False en attendant la Migration Mindee V1 vers V2 (+ RAG)
            raw_text, json_mindee = await send_to_mindee(file)
            parse_or_ocr = "mindee"
            # Ensure raw_text is not None
            if raw_text is None:
                raw_text = ""
            return raw_text, json_mindee, parse_or_ocr
        else:
            await file.seek(0)
            raw_text, json_ocr = await ocr_this(file)
            parse_or_ocr = "ocr"
            if raw_text is None:
                raw_text = ""
            return raw_text, json_ocr, parse_or_ocr
