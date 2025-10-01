# Wrapper subprocess pour OCR - force la libération mémoire complète
import concurrent.futures
import tempfile
import os
import asyncio
import time
import sys

# Pool de workers persistant mais recyclé tous les N requêtes
_executor = None
_model_cache = {}
_request_count = 0  # Compteur de requêtes traitées
MAX_REQUESTS_BEFORE_RECYCLE = 7  # Recycle le subprocess tous les 7 requêtes

def log_with_timestamp(message, level="INFO"):
    """Log avec timestamp pour le debugging sur Render"""
    timestamp = time.strftime("%H:%M:%S")
    print(f"[{timestamp}] {level}: {message}", flush=True)
    sys.stdout.flush()

def _init_worker():
    """Initialise le modèle OCR dans le worker subprocess (appelé UNE SEULE fois par worker)"""
    log_with_timestamp("🔧 DÉBUT _init_worker() dans subprocess", "WORKER_INIT_START")
    global _model_cache
    if 'model' not in _model_cache:
        try:
            log_with_timestamp("📦 Import doctr.models.ocr_predictor", "WORKER_IMPORT")
            from doctr.models import ocr_predictor
            log_with_timestamp("🔧 Création modèle OCR...", "WORKER_MODEL_CREATE")
            model = ocr_predictor('db_mobilenet_v3_large', 'crnn_mobilenet_v3_small', 
                                  pretrained=True, detect_orientation=True)
            log_with_timestamp("⚙️ Configuration modèle eval()", "WORKER_MODEL_EVAL")
            model.eval()
            _model_cache['model'] = model
            log_with_timestamp("✅ Modèle OCR prêt dans subprocess", "WORKER_INIT_SUCCESS")
        except Exception as e:
            log_with_timestamp(f"❌ Erreur init modèle OCR dans subprocess: {e}", "WORKER_INIT_ERROR")
            # Ne pas initialiser le modèle si erreur - sera géré par le fallback
            _model_cache['model'] = None
    else:
        log_with_timestamp("♻️ Modèle déjà initialisé dans subprocess", "WORKER_INIT_CACHED")

def _ocr_worker(pdf_bytes: bytes):
    """Worker qui utilise le modèle préchargé (pas de rechargement à chaque appel)"""
    log_with_timestamp("🚀 DÉBUT _ocr_worker()", "WORKER_START")
    try:
        log_with_timestamp("📦 Import des modules nécessaires", "WORKER_IMPORTS")
        from doctr.io import DocumentFile
        import torch
        import gc
        import fitz  # PyMuPDF pour compter les pages
        log_with_timestamp("✅ Imports terminés", "WORKER_IMPORTS_DONE")
        
        # Récupérer le modèle préchargé (déjà en mémoire du worker)
        log_with_timestamp("🔍 Récupération du modèle depuis le cache", "WORKER_MODEL_GET")
        model = _model_cache.get('model')
        if model is None:
            log_with_timestamp("❌ Modèle OCR non initialisé dans le worker", "WORKER_MODEL_ERROR")
            raise Exception("Modèle OCR non initialisé dans le worker - subprocess incompatible")
        log_with_timestamp("✅ Modèle récupéré avec succès", "WORKER_MODEL_OK")
        
        # Sauver PDF temporairement
        log_with_timestamp("💾 Sauvegarde PDF temporaire", "WORKER_TEMP_FILE")
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(pdf_bytes)
            tmp_path = tmp.name
        log_with_timestamp(f"✅ PDF sauvegardé: {tmp_path}", "WORKER_TEMP_FILE_DONE")
        
        # Compter les pages avant traitement - version compatible Render
        log_with_timestamp("📄 Comptage des pages PDF", "WORKER_PAGE_COUNT")
        num_pages = 1  # Défaut
        try:
            # Utiliser PyMuPDF de manière sécurisée
            import fitz  # PyMuPDF pour compter les pages
            pdf_doc = fitz.open(tmp_path)
            num_pages = pdf_doc.page_count
            pdf_doc.close()
            log_with_timestamp(f"✅ Pages comptées avec PyMuPDF: {num_pages}", "WORKER_PAGE_COUNT_SUCCESS")
        except ImportError:
            # PyMuPDF non disponible sur Render - utiliser une estimation
            log_with_timestamp("⚠️ PyMuPDF non disponible, utilisation d'une page par défaut", "WORKER_PAGE_COUNT_FALLBACK")
            num_pages = 1
        except Exception as e:
            # Autre erreur - utiliser une page par défaut
            log_with_timestamp(f"⚠️ Erreur comptage pages: {e}, utilisation par défaut", "WORKER_PAGE_COUNT_ERROR")
            num_pages = 1
        
        try:
            log_with_timestamp("📄 Création DocumentFile depuis PDF", "WORKER_DOCFILE_CREATE")
            doc = DocumentFile.from_pdf(tmp_path)
            log_with_timestamp("✅ DocumentFile créé avec succès", "WORKER_DOCFILE_SUCCESS")
            
            log_with_timestamp("🧠 Début traitement OCR avec le modèle", "WORKER_OCR_START")
            with torch.no_grad():
                result_model = model(doc)
            log_with_timestamp("✅ Traitement OCR terminé", "WORKER_OCR_SUCCESS")
            
            log_with_timestamp("📤 Export des résultats", "WORKER_EXPORT")
            result = result_model.export()
            log_with_timestamp("✅ Export terminé", "WORKER_EXPORT_SUCCESS")
            
            # Extraire le texte
            log_with_timestamp("📝 Extraction du texte des résultats", "WORKER_TEXT_EXTRACT")
            lines = []
            for page in result["pages"]:
                for block in page["blocks"]:
                    for line in block["lines"]:
                        line_text = " ".join(word["value"] for word in line["words"])
                        lines.append(line_text)
            
            text_grouped = "\n".join(lines)
            log_with_timestamp(f"✅ Texte extrait: {len(text_grouped)} caractères", "WORKER_TEXT_EXTRACT_SUCCESS")
            
            # Nettoyage agressif après traitement
            log_with_timestamp("🧹 Nettoyage mémoire", "WORKER_CLEANUP")
            try:
                del doc
                del result_model
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                gc.collect()
                log_with_timestamp("✅ Nettoyage terminé", "WORKER_CLEANUP_SUCCESS")
            except Exception as e:
                log_with_timestamp(f"⚠️ Erreur nettoyage: {e}", "WORKER_CLEANUP_ERROR")
            
            log_with_timestamp("✅ OCR worker terminé avec succès", "WORKER_SUCCESS")
            return {
                "text": text_grouped, 
                "raw_result": result,
                "num_pages": num_pages  # Retourner le nombre de pages
            }
            
        finally:
            log_with_timestamp("🗑️ Suppression fichier temporaire", "WORKER_TEMP_CLEANUP")
            try:
                os.unlink(tmp_path)
                log_with_timestamp("✅ Fichier temporaire supprimé", "WORKER_TEMP_CLEANUP_SUCCESS")
            except Exception as e:
                log_with_timestamp(f"⚠️ Erreur suppression fichier temporaire: {e}", "WORKER_TEMP_CLEANUP_ERROR")
                
    except Exception as e:
        log_with_timestamp(f"❌ ERREUR CRITIQUE dans OCR worker: {str(e)}", "WORKER_ERROR")
        import traceback
        log_with_timestamp(f"📋 Traceback: {traceback.format_exc()}", "WORKER_TRACEBACK")
        raise Exception(f"OCR subprocess error: {str(e)}")

def _cleanup_worker():
    """Nettoie le worker avant shutdown (appelé dans le subprocess)"""
    global _model_cache
    try:
        import gc
        import torch
        
        # Nettoyer le modèle et le cache
        if 'model' in _model_cache:
            del _model_cache['model']
        _model_cache.clear()
        
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        gc.collect()
    except:
        pass

def get_executor():
    """Récupère ou crée le pool de workers (recyclé tous les N requêtes)"""
    log_with_timestamp("🔍 get_executor() appelé", "EXECUTOR_GET")
    global _executor, _request_count
    
    # Recycler le subprocess si limite atteinte
    if _request_count >= MAX_REQUESTS_BEFORE_RECYCLE and _executor is not None:
        log_with_timestamp(f"♻️ Recyclage subprocess OCR après {_request_count} requêtes (libération mémoire)", "EXECUTOR_RECYCLE")
        # Shutdown avec wait=True pour éviter les warnings
        _executor.shutdown(wait=True, cancel_futures=False)
        _executor = None
        _request_count = 0
        import gc
        gc.collect()  # Force GC dans le processus principal aussi
        log_with_timestamp("✅ Recyclage terminé", "EXECUTOR_RECYCLE_DONE")
    
    # Créer le pool si nécessaire
    if _executor is None:
        log_with_timestamp("🏗️ Création nouveau ProcessPoolExecutor", "EXECUTOR_CREATE")
        _executor = concurrent.futures.ProcessPoolExecutor(
            max_workers=1, 
            initializer=_init_worker
        )
        log_with_timestamp("✅ ProcessPoolExecutor créé", "EXECUTOR_CREATE_SUCCESS")
    
    log_with_timestamp("✅ Executor prêt", "EXECUTOR_READY")
    return _executor

async def ocr_in_subprocess(file):
    """
    Lance l'OCR dans un subprocess persistant avec modèle préchargé.
    Le worker reste en vie entre les requêtes = pas de rechargement du modèle.
    Recyclé selon un compteur pondéré par le nombre de pages du PDF.
    """
    log_with_timestamp("🚀 DÉBUT ocr_in_subprocess()", "SUBPROCESS_START")
    global _request_count
    
    log_with_timestamp("📖 Lecture du fichier", "SUBPROCESS_READ")
    contents = await file.read()
    await file.seek(0)
    log_with_timestamp(f"✅ Fichier lu: {len(contents)} bytes", "SUBPROCESS_READ_DONE")
    
    log_with_timestamp("🔗 Récupération de l'event loop", "SUBPROCESS_LOOP")
    loop = asyncio.get_event_loop()
    log_with_timestamp("🔧 Récupération de l'executor", "SUBPROCESS_EXECUTOR")
    executor = get_executor()  # Récupère ou recycle le worker
    
    log_with_timestamp("🏃 Lancement du worker dans l'executor", "SUBPROCESS_RUN")
    result = await loop.run_in_executor(executor, _ocr_worker, contents)
    log_with_timestamp("✅ Worker terminé", "SUBPROCESS_RUN_DONE")
    
    # Incrémenter le compteur selon le nombre de pages (charge mémoire)
    num_pages = result.get("num_pages", 1)
    _request_count += num_pages  # Pondération: 1 page = +1, 5 pages = +5
    
    log_with_timestamp(f"📊 Compteur subprocess: {_request_count}/{MAX_REQUESTS_BEFORE_RECYCLE} (PDF: {num_pages} pages)", "SUBPROCESS_COUNTER")
    log_with_timestamp("✅ ocr_in_subprocess() terminé avec succès", "SUBPROCESS_SUCCESS")
    
    return result

def cleanup_executor():
    """Nettoie le pool de workers (appelé au shutdown)"""
    global _executor
    if _executor is not None:
        _executor.shutdown(wait=True)
        _executor = None
