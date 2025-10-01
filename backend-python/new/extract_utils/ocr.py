from utils.utils_doctr import ocr_this_pdf_with_doctr

async def ocr_this(file):
    # Utiliser directement l'OCR DocTR
    result = await ocr_this_pdf_with_doctr(file)
    return result["text"], result["raw_result"]