# Wrapper subprocess pour OCR - force la libération mémoire complète
import concurrent.futures
import tempfile
import os
import asyncio

# Pool de workers persistant mais recyclé tous les N requêtes
_executor = None
_model_cache = {}
_request_count = 0  # Compteur de requêtes traitées
MAX_REQUESTS_BEFORE_RECYCLE = 7  # Recycle le subprocess tous les 7 requêtes

def _init_worker():
    """Initialise le modèle OCR dans le worker subprocess (appelé UNE SEULE fois par worker)"""
    global _model_cache
    if 'model' not in _model_cache:
        try:
            from doctr.models import ocr_predictor
            print("🔧 Init modèle OCR dans subprocess worker...")
            model = ocr_predictor('db_mobilenet_v3_large', 'crnn_mobilenet_v3_small', 
                                  pretrained=True, detect_orientation=True)
            model.eval()
            _model_cache['model'] = model
            print("✅ Modèle OCR prêt dans subprocess")
        except Exception as e:
            print(f"❌ Erreur init modèle OCR dans subprocess: {e}")
            # Ne pas initialiser le modèle si erreur - sera géré par le fallback
            _model_cache['model'] = None

def _ocr_worker(pdf_bytes: bytes):
    """Worker qui utilise le modèle préchargé (pas de rechargement à chaque appel)"""
    try:
        from doctr.io import DocumentFile
        import torch
        import gc
        import fitz  # PyMuPDF pour compter les pages
        
        # Récupérer le modèle préchargé (déjà en mémoire du worker)
        model = _model_cache.get('model')
        if model is None:
            raise Exception("Modèle OCR non initialisé dans le worker - subprocess incompatible")
        
        # Sauver PDF temporairement
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(pdf_bytes)
            tmp_path = tmp.name
        
        # Compter les pages avant traitement - version compatible Render
        num_pages = 1  # Défaut
        try:
            # Utiliser PyMuPDF de manière sécurisée
            import fitz  # PyMuPDF pour compter les pages
            pdf_doc = fitz.open(tmp_path)
            num_pages = pdf_doc.page_count
            pdf_doc.close()
        except ImportError:
            # PyMuPDF non disponible sur Render - utiliser une estimation
            print("⚠️ PyMuPDF non disponible, utilisation d'une page par défaut")
            num_pages = 1
        except Exception:
            # Autre erreur - utiliser une page par défaut
            num_pages = 1
        
        try:
            doc = DocumentFile.from_pdf(tmp_path)
            
            with torch.no_grad():
                result_model = model(doc)
            
            result = result_model.export()
            
            # Extraire le texte
            lines = []
            for page in result["pages"]:
                for block in page["blocks"]:
                    for line in block["lines"]:
                        line_text = " ".join(word["value"] for word in line["words"])
                        lines.append(line_text)
            
            text_grouped = "\n".join(lines)
            
            # Nettoyage agressif après traitement
            try:
                del doc
                del result_model
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                gc.collect()
            except:
                pass
            
            return {
                "text": text_grouped, 
                "raw_result": result,
                "num_pages": num_pages  # Retourner le nombre de pages
            }
            
        finally:
            try:
                os.unlink(tmp_path)
            except:
                pass
                
    except Exception as e:
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
    global _executor, _request_count
    
    # Recycler le subprocess si limite atteinte
    if _request_count >= MAX_REQUESTS_BEFORE_RECYCLE and _executor is not None:
        print(f"♻️  Recyclage subprocess OCR après {_request_count} requêtes (libération mémoire)")
        # Shutdown avec wait=True pour éviter les warnings
        _executor.shutdown(wait=True, cancel_futures=False)
        _executor = None
        _request_count = 0
        import gc
        gc.collect()  # Force GC dans le processus principal aussi
    
    # Créer le pool si nécessaire
    if _executor is None:
        _executor = concurrent.futures.ProcessPoolExecutor(
            max_workers=1, 
            initializer=_init_worker
        )
    
    return _executor

async def ocr_in_subprocess(file):
    """
    Lance l'OCR dans un subprocess persistant avec modèle préchargé.
    Le worker reste en vie entre les requêtes = pas de rechargement du modèle.
    Recyclé selon un compteur pondéré par le nombre de pages du PDF.
    """
    global _request_count
    
    contents = await file.read()
    await file.seek(0)
    
    loop = asyncio.get_event_loop()
    executor = get_executor()  # Récupère ou recycle le worker
    result = await loop.run_in_executor(executor, _ocr_worker, contents)
    
    # Incrémenter le compteur selon le nombre de pages (charge mémoire)
    num_pages = result.get("num_pages", 1)
    _request_count += num_pages  # Pondération: 1 page = +1, 5 pages = +5
    
    print(f"📊 Compteur subprocess: {_request_count}/{MAX_REQUESTS_BEFORE_RECYCLE} (PDF: {num_pages} pages)")
    
    return result

def cleanup_executor():
    """Nettoie le pool de workers (appelé au shutdown)"""
    global _executor
    if _executor is not None:
        _executor.shutdown(wait=True)
        _executor = None
