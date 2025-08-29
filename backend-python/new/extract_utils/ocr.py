from utils.utils_doctr import ocr_this_pdf_with_doctr



async def ocr_this(file):
    # Utiliser directement la fonction existante de utils_doctr
    result = await ocr_this_pdf_with_doctr(file)
    return result["text"], result["raw_result"]

