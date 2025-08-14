from fastapi import FastAPI, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from typing import Any
#import psutil
#import gc
#from prompts import prompt_bon
from parse_ocr_extract_facture import process_facture_pdf, process_facture_pdf_only_ocr, extract_facture_with_gemini_from_data
from utils.utils_paddleocr import run_paddle_ocr
from utils.utils_gemini import extract_gemini
from utils.utils_parse import parse_pdf
from prompts import prompt_bsd
#from utils.utils_doctr import ocr_this_pdf_with_doctr, cleanup_model, initialize_model

"""
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
    print(f"🔄 MÉMOIRE {stage}: RSS={memory['rss_mb']:.1f}MB, VMS={memory['vms_mb']:.1f}MB, {memory['percent']:.1f}%")
"""

load_dotenv()

app = FastAPI()

"""
@app.on_event("startup")
async def startup_event():
    #Initialise les ressources au démarrage du serveur
    print("Démarrage du serveur Fleap...")
    # Initialiser le modèle OCR
    initialize_model()
    print("Serveur Fleap démarré avec succès")

@app.on_event("shutdown")
async def shutdown_event():
    #Nettoyer les ressources lors de l'arrêt du serveur
    print("Arrêt du serveur Fleap...")
    cleanup_model()
    print("Serveur Fleap arrêté")
"""



# Définition du modèle de données pour la requête
class PDFRequest(BaseModel):
    pdf_url: str

class MindeeDataRequest(BaseModel):
    mindee_data: dict[str, Any]

origins = [
    "http://localhost:3000",  # Development
    "http://localhost:3000/",
    "https://fleap-three.vercel.app", # Production
    "https://fleap-three.vercel.app/",
    "https://fleap-arthurpouzcs-projects.vercel.app", # Production Arthur
    "https://fleap-arthurpouzcs-projects.vercel.app/",
]

# Configurer CORS pour autoriser les requêtes du frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],  # Permet toutes les méthodes HTTP
    allow_headers=["*"],  # Permet tous les headers
    expose_headers=["*"]  # Expose tous les headers dans la réponse
)

# =============================================
# Endpoints existants
# =============================================


@app.get("/")
async def root():
    return {"message": "L'API Fleap est en ligne"}

@app.post("/parse-pdf-and-extract-info/") #Sur les BSD
async def parse_pdf_and_extract_info(request: PDFRequest):
    parsed_pdf = parse_pdf(request.pdf_url)
    json_from_gemini = extract_gemini(parsed_pdf, prompt_bsd)
    return json_from_gemini


#=============================================FACTURES=============================================
@app.post("/parse-or-ocr-facture-and-extract-info/")
async def parse_or_ocr_facture_and_extract_info(request: PDFRequest): #not use anymore i think
    try:
        # Utiliser le module de traitement des factures
        result = process_facture_pdf(request.pdf_url)
        
        if result["success"]:
            response_data = {
                "text": result["text"],
                "extracted_data": result["extracted_data"]
            }
            
            # Ajouter le result Mindee si disponible
            if "mindee_result" in result:
                response_data["mindee_result"] = result["mindee_result"]
            
            return response_data
        else:
            return {"error": result["error"]}

    except Exception as e:
        return {"error": f"Failed to process facture PDF: {str(e)}"}


@app.post("/parse-or-ocr-facture/")
async def parse_or_ocr_facture(request: PDFRequest):
    try:
        # Utiliser le module de traitement des factures (sans Gemini)
        result = process_facture_pdf_only_ocr(request.pdf_url)
        
        if result["success"]:
            response_data = {
                "text": result["text"]
            }
            
            # Ajouter le result Mindee si disponible
            if "mindee_result" in result:
                response_data["mindee_result"] = result["mindee_result"]
            
            return response_data
        else:
            return {"error": result["error"]}

    except Exception as e:
        return {"error": f"Failed to parse/OCR facture PDF: {str(e)}"}


@app.post("/extract-facture-with-gemini/")
async def extract_facture_with_gemini(request: MindeeDataRequest):
    try:
        # Utiliser Gemini pour extraire les données structurées
        result = extract_facture_with_gemini_from_data(request.mindee_data)
        
        if result["success"]:
            return {
                "extracted_data": result["extracted_data"]
            }
        else:
            return {"error": result["error"]}

    except Exception as e:
        return {"error": f"Failed to extract with Gemini: {str(e)}"}

#=============================================FACTURES=============================================





#=============================================BSD=============================================
@app.post("/extract-bsd-with-paddle-ocr")
async def extract_bsd_with_paddle_ocr(file: UploadFile):
    print("Extract Raw Data with Paddle OCR")
    result = await run_paddle_ocr(file)
    text = result["text"]
    print("Text extracted from Paddle OCR", text)
    print("Extract Parsed Data with Gemini")
    parsed_info = await extract_gemini(text, prompt_bsd)
    return parsed_info

"""
@app.post("/extract-bsd-with-doctr")
async def extract_bsd_with_doctr(file: UploadFile):
    print("Extract Raw Data with Doctr")
    result = await ocr_this_pdf_with_doctr(file)
    text = result["text"]
    print("Text extracted from DocTR OCR", text)
    print("Extract Parsed Data with Gemini")
    parsed_info = await extract_gemini(text, prompt_bsd)
    return parsed_info
"""
#=============================================BSD=============================================




#=============================================OCR ONLY=============================================
@app.post("/paddle-ocr")
async def paddle_ocr_from_main(file: UploadFile):
    return await run_paddle_ocr(file)

"""
@app.post("/extract-with-doctr")
async def extract_raw_text_with_doctr(file: UploadFile):
    print("=" * 60)
    print("🚀 DÉBUT EXTRACTION OCR AVEC DOCTR")
    print("=" * 60)
    
    # Mémoire avant traitement
    print_memory_usage("AVANT TRAITEMENT")
    
    try:
        print("📄 Début de l'extraction OCR...")
        result = await ocr_this_pdf_with_doctr(file)
        
        # Mémoire après OCR
        print_memory_usage("APRÈS OCR")
        
        text = result["text"]
        print(f"📝 Texte extrait: {len(text)} caractères")
        
        # Nettoyage mémoire
        gc.collect()
        print_memory_usage("APRÈS NETTOYAGE")
        
        # Calcul de l'utilisation mémoire
        memory = get_memory_usage()
        memory_usage_mb = memory['rss_mb']
        
        print(f"📊 UTILISATION MÉMOIRE FINALE: {memory_usage_mb:.1f}MB")
        if memory_usage_mb > 502:
            print(f"⚠️  ATTENTION: Mémoire proche de la limite (502MB) - {memory_usage_mb:.1f}MB utilisés")
        else:
            print(f"✅ Mémoire dans les limites: {memory_usage_mb:.1f}MB / 502MB")
        
        print("=" * 60)
        print("✅ EXTRACTION TERMINÉE")
        print("=" * 60)
        
        return result
        
    except Exception as e:
        print(f"❌ ERREUR lors de l'extraction: {str(e)}")
        print_memory_usage("EN CAS D'ERREUR")
        raise e

@app.post("/extract-with-doctr/bon")
async def extract_json_with_gemini_using_prompt_bon(file: UploadFile):
    print("Extract Raw Data with Doctr")
    result = await ocr_this_pdf_with_doctr(file)
    text = result["text"]
    print("Text extracted from DocTR OCR", text)
    print("Extract Parsed Data with Gemini")
    parsed_info = await extract_json_with_gemini_using_prompt(text, prompt_bon)
    return parsed_info

"""
#=============================================OCR ONLY=============================================