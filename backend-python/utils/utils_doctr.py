from doctr.io import DocumentFile
from doctr.models import ocr_predictor
import torch
import tempfile
import os
import time
from fastapi import UploadFile
import gc
import psutil
import numpy as np
# Configuration OCR
USE_PDF_DIRECT = True  # True = PDF direct, False = conversion en images
PDF_DPI = 300          # Résolution pour la conversion PDF → images / 300 classique
MAX_IMAGE_WIDTH = 1500 # Largeur maximale des images redimensionnées / 1500 classique
SMALL_MODEL = True     #small model aussi bien j'ai l'impression et 5 fois plus rapide

os.environ["USE_TORCH"] = "1"

# Variable globale pour stocker le modèle
_model = None
_model_initialized = False

def initialize_model():
    #Initialise le modèle OCR au démarrage du serveur
    global _model, _model_initialized
    if not _model_initialized:
        print("Initialisation du modèle OCR DocTR...")
        if SMALL_MODEL:
            _model = ocr_predictor('db_mobilenet_v3_large', 'crnn_mobilenet_v3_small', pretrained=True, detect_orientation=True)
        else:
            _model = ocr_predictor('db_resnet50', 'crnn_vgg16_bn', pretrained=True, detect_orientation=True)
        # Inference-only configuration
        try:
            _model.eval()
            for param in _model.parameters():
                param.requires_grad = False
        except Exception:
            pass
        _model_initialized = True
        print("Modèle OCR DocTR initialisé avec succès")
    return _model

def get_model():
    #Récupère le modèle préchargé
    global _model, _model_initialized
    if not _model_initialized:
        raise RuntimeError("Le modèle OCR n'a pas été initialisé. Appelez initialize_model() au démarrage du serveur.")
    return _model

def cleanup_model():
    #Libère la mémoire du modèle
    global _model, _model_initialized
    if _model is not None:
        del _model
        _model = None
        _model_initialized = False
        gc.collect()
        print("Modèle OCR nettoyé de la mémoire")

# Fonction resize_image supprimée car elle nécessitait PIL et pdf2image
# La conversion PDF vers images est désactivée pour éviter les problèmes sur Render

def get_memory_usage():
    #Retourne l'utilisation mémoire actuelle en MB
    process = psutil.Process(os.getpid())
    memory_info = process.memory_info()
    return {
        "rss_mb": memory_info.rss / 1024 / 1024,  # Resident Set Size en MB
        "vms_mb": memory_info.vms / 1024 / 1024,  # Virtual Memory Size en MB
        "percent": process.memory_percent()  # Pourcentage d'utilisation
    }

def print_memory_usage(stage=""):
    #Affiche l'utilisation mémoire avec un label
    memory = get_memory_usage()
    #print(f"🔄 MÉMOIRE {stage}: RSS={memory['rss_mb']:.1f}MB, VMS={memory['vms_mb']:.1f}MB, {memory['percent']:.1f}%")

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
    
    # Reset file position for potential future reads
    await file.seek(0)

    # Sauvegarder temporairement le fichier
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        if USE_PDF_DIRECT:
            # Traitement direct du PDF
            doc = DocumentFile.from_pdf(tmp_path)
        else:
            # Mode conversion en images désactivé pour éviter les problèmes avec pdf2image sur Render
            # Cette fonctionnalité nécessite poppler-utils qui n'est pas disponible sur Render
            raise RuntimeError("Mode conversion PDF vers images désactivé. Utilisez USE_PDF_DIRECT=True.")
        
        # Récupération du modèle
        model = get_model()
        
        # Traitement OCR
        with torch.no_grad():
            result_model = model(doc)
        
        # Export des résultats
        result = result_model.export()
        
        # Nettoyage mémoire
        if USE_PDF_DIRECT:
            try:
                del doc
            except Exception:
                pass
        try:
            del result_model
        except Exception:
            pass
        # Libérer le buffer du contenu lu
        try:
            del contents
        except Exception:
            pass
        # Vider éventuellement le cache GPU si présent
        try:
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except Exception:
            pass
        gc.collect()
        
    finally:
        # Nettoyer le fichier temporaire
        try:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
        except PermissionError:
            pass

    text_grouped = group_lines(result)
    return {"text": text_grouped, "raw_result": result}

