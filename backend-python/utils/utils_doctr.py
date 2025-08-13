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
_model_initialized = False

def initialize_model():
    """Initialise le modèle OCR au démarrage du serveur"""
    global _model, _model_initialized
    if not _model_initialized:
        print("Initialisation du modèle OCR DocTR...")
        #_model = ocr_predictor('db_resnet50', 'crnn_vgg16_bn', pretrained=True) #Plus gros, pas forcément bien meilleur j'ai l'impression
        _model = ocr_predictor('db_mobilenet_v3_large', 'crnn_mobilenet_v3_small', pretrained=True)
        _model_initialized = True
        print("Modèle OCR DocTR initialisé avec succès")
    return _model

def get_model():
    """Récupère le modèle préchargé"""
    global _model, _model_initialized
    if not _model_initialized:
        raise RuntimeError("Le modèle OCR n'a pas été initialisé. Appelez initialize_model() au démarrage du serveur.")
    return _model

def cleanup_model():
    """Libère la mémoire du modèle"""
    global _model, _model_initialized
    if _model is not None:
        del _model
        _model = None
        _model_initialized = False
        gc.collect()
        print("Modèle OCR nettoyé de la mémoire")

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

