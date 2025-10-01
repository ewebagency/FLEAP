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
from pdf2image import convert_from_path
from PIL import Image

# Configuration OCR
USE_PDF_DIRECT = True  # True = PDF direct, False = conversion en images
PDF_DPI = 300          # Résolution pour la conversion PDF → images / 300 classique
MAX_IMAGE_WIDTH = 1500 # Largeur maximale des images redimensionnées / 1500 classique
SMALL_MODEL = True     #small model aussi bien j'ai l'impression et 5 fois plus rapide

os.environ["USE_TORCH"] = "1"

# Variable globale pour stocker le modèle
_model = None
_model_initialized = False

# Compteur de requêtes pour le recyclage du modèle
_request_count = 0
MAX_REQUESTS_BEFORE_RECYCLE = 7  # Recycler le modèle tous les 7 requêtes

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

def should_recycle_model():
    """Vérifie si le modèle doit être recyclé selon le compteur de requêtes"""
    global _request_count
    return _request_count >= MAX_REQUESTS_BEFORE_RECYCLE

def increment_request_count(num_pages=1):
    """Incrémente le compteur de requêtes (pondéré par le nombre de pages) et recycle le modèle si nécessaire"""
    global _request_count, _model, _model_initialized
    
    # Pondérer selon le nombre de pages (1 page = +1, 5 pages = +5)
    _request_count += num_pages
    
    if should_recycle_model():
        print(f"♻️  Recyclage du modèle OCR après {_request_count} requêtes pondérées (libération mémoire)")
        
        # Nettoyer l'ancien modèle
        if _model is not None:
            del _model
            _model = None
            _model_initialized = False
        
        # Nettoyage mémoire agressif
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        gc.collect()
        
        # Réinitialiser le modèle
        initialize_model()
        _request_count = 0
        
        print("✅ Modèle OCR recyclé avec succès")
    
    return _request_count

def get_model_status():
    """Retourne le statut actuel du modèle et du compteur"""
    global _model_initialized, _request_count
    return {
        "model_initialized": _model_initialized,
        "request_count": _request_count,
        "max_requests": MAX_REQUESTS_BEFORE_RECYCLE,
        "needs_recycle": should_recycle_model()
    }

def force_model_recycle():
    """Force le recyclage immédiat du modèle (utile pour le debugging)"""
    global _model, _model_initialized, _request_count
    
    print("🔄 Recyclage forcé du modèle OCR...")
    
    # Nettoyer l'ancien modèle
    if _model is not None:
        del _model
        _model = None
        _model_initialized = False
    
    # Nettoyage mémoire agressif
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    gc.collect()
    
    # Réinitialiser le modèle
    initialize_model()
    _request_count = 0
    
    print("✅ Modèle OCR recyclé avec succès (recyclage forcé)")
    return True

def cleanup_model():
    #Libère la mémoire du modèle
    global _model, _model_initialized, _request_count
    if _model is not None:
        del _model
        _model = None
        _model_initialized = False
        _request_count = 0  # Reset du compteur
        gc.collect()
        print("Modèle OCR nettoyé de la mémoire")

def resize_image(img, max_width=MAX_IMAGE_WIDTH):
    #Redimensionne une image en conservant le ratio d'aspect
    width, height = img.size
    if width > max_width:
        ratio = max_width / float(width)
        new_height = int(float(height) * ratio)
        img = img.resize((max_width, new_height), Image.LANCZOS)
    return img

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
    
    # Compter les pages du PDF
    num_pages = 1  # Défaut
    try:
        import fitz  # PyMuPDF
        pdf_doc = fitz.open(stream=contents, filetype="pdf")
        num_pages = pdf_doc.page_count
        pdf_doc.close()
    except Exception:
        pass
    
    # Incrémenter le compteur pondéré par le nombre de pages
    current_count = increment_request_count(num_pages)
    print(f"📊 Compteur modèle OCR: {current_count}/{MAX_REQUESTS_BEFORE_RECYCLE} (PDF: {num_pages} pages)")

    # Sauvegarder temporairement le fichier
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        if USE_PDF_DIRECT:
            # Traitement direct du PDF
            doc = DocumentFile.from_pdf(tmp_path)
        else:
            # Convertir le PDF en images
            pages = convert_from_path(tmp_path, dpi=PDF_DPI)
            
            # Redimensionner chaque page
            resized_pages = [resize_image(page) for page in pages]
            
            # Convertir en arrays numpy
            numpy_images = [np.array(img) for img in resized_pages]
        
        # Récupération du modèle
        model = get_model()
        
        # Traitement OCR
        with torch.no_grad():
            if USE_PDF_DIRECT:
                result_model = model(doc)
            else:
                result_model = model(numpy_images)
        
        # Export des résultats
        result = result_model.export()
        
        # Nettoyage mémoire
        if USE_PDF_DIRECT:
            try:
                del doc
            except Exception:
                pass
        else:
            try:
                del pages, resized_pages, numpy_images
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

