from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from extract_text_from_pdf import extract_text, extract_text_only
from utils import compta_lines_from_text, header_from_text
from extract_info_xlsx_autocompletion.lecture_excel_autocompletion import data_from_excel
from extract_info_from_text import extract_all_info
from typing import Optional
# Import des nouvelles fonctionnalités OCR et LLM
from ocr_then_llm.utils import process_pdf_with_llm
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

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

@app.post("/treat-pdf/")
async def treat_pdf(file: UploadFile = File(...)):
    # Appelle la fonction extract_text et retourne le résultat
    result = await extract_text(file)
    text = result["text"]
    
    # Extraction des informations du texte
    extracted_info = extract_all_info(text)
    compta_lines = compta_lines_from_text(text)
    header = header_from_text(text)
    
    return {
        'compta_lines': compta_lines,
        'header': header,
        'extracted_info': extracted_info
    }


@app.post("/extract-text-only/")
async def extract_text_only_endpoint(file: UploadFile = File(...)):
    result = await extract_text_only(file)
    text = result["text"]
    method = result["method"]
    
    # Extraction des informations supplémentaires si le texte a été extrait avec succès
    extracted_info = {}
    if text != "Impossible":
        extracted_info = extract_all_info(text)
    
    print(f'Texte extrait avec la méthode : {method}')
    print('Contenu extrait :', text)
    
    return {
        'text': text, 
        'method': method,
        'extracted_info': extracted_info
    }


#@app.get("/get-table-demande-collecte/")
#async def get_table_demande_collecte(
#                                    userId: Optional[str] = None,
#                                    site: Optional[str] = None,
#                                    filiere: Optional[str] = None,
#                                    dechet: Optional[str] = None):
#    return data_from_excel(userId, site, filiere, dechet)


@app.post("/ai-extract-json-from-pdf/")
async def ai_extract_json_from_pdf(file: UploadFile = File(...)):
    """
    Process a PDF or image file to extract structured invoice information using AI
    """
    from ai import process_invoice_file
    
    try:
        # Process the file using AI functions
        invoice_info = process_invoice_file(file)
        return invoice_info
    except Exception as e:
        return {"error": f"Failed to process invoice: {str(e)}"}

# =============================================
# Nouveaux endpoints OCR et LLM (Fusionnés depuis ocr_then_llm/main.py)
# =============================================

@app.post("/ocr-llm/process-pdf")
async def process_pdf(pdf_file: UploadFile = File(...)):
    """
    Nouvel endpoint pour traiter un PDF avec OCR et LLM
    Fusionné depuis ocr_then_llm/main.py
    """
    result = process_pdf_with_llm(pdf_file)
    return result

@app.get("/ocr-llm/health")
async def health_check():
    """
    Nouvel endpoint pour vérifier que l'API OCR et LLM est en ligne
    Fusionné depuis ocr_then_llm/main.py
    """
    return {"status": "ok tout va bien"}

    