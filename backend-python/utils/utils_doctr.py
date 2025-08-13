from doctr.io import DocumentFile
from doctr.models import ocr_predictor
import tempfile
import os
import time
from fastapi import UploadFile
import gc

os.environ["USE_TORCH"] = "1"

# Variable globale pour stocker le modèle
_model = None

def get_model():
    """Charge le modèle de manière lazy pour éviter de le charger au démarrage"""
    global _model
    if _model is None:
        _model = ocr_predictor('db_resnet50', 'crnn_vgg16_bn', pretrained=True)
    return _model

def cleanup_model():
    """Libère la mémoire du modèle"""
    global _model
    if _model is not None:
        del _model
        _model = None
        gc.collect()

def group_lines(result):
    lines = []
    for page in result["pages"]:
        for block in page["blocks"]:
            for line in block["lines"]:
                line_text = " ".join(word["value"] for word in line["words"])
                lines.append(line_text)

    return "\n".join(lines)

async def ocr_this_pdf_with_doctr(file: UploadFile):
    # Lire le contenu du fichier
    contents = await file.read()

    # Sauvegarder temporairement le fichier
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        # Chargement du document
        doc = DocumentFile.from_pdf(tmp_path)
        
        # Récupération du modèle
        model = get_model()
        
        # Traitement OCR avec le modèle
        ocr_start = time.time()
        result_model = model(doc)
        ocr_time = time.time() - ocr_start
        print(f"Temps de traitement OCR: {ocr_time:.2f} secondes")
        
        # Export des résultats
        result = result_model.export()
        
    finally:
        # Nettoyer le fichier temporaire
        try:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
        except PermissionError:
            # Si on ne peut pas supprimer le fichier, on l'ignore
            pass

    return {"text": group_lines(result), "raw_result": result}

