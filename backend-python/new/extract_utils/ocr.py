from utils.utils_doctr import ocr_this_pdf_with_doctr

async def ocr_this(file):
    # Utiliser directement ocr_this_pdf_with_doctr sans subprocess
    result = await ocr_this_pdf_with_doctr(file)
    return result["text"], result.get("raw_result", {})

