from utils.subprocess_ocr import ocr_in_subprocess

async def ocr_this(file):
    # Utiliser le subprocess pour forcer la libération mémoire
    result = await ocr_in_subprocess(file)
    return result["text"], result["raw_result"]

