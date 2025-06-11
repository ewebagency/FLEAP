from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
#from extract_text_from_pdf import extract_text, extract_text_only
#from utils import compta_lines_from_text, header_from_text
#from extract_info_xlsx_autocompletion.lecture_excel_autocompletion import data_from_excel
#from extract_info_from_text import extract_all_info
#from typing import Optional
# Import des nouvelles fonctionnalités OCR et LLM
#from ocr_then_llm.utils import process_pdf_with_llm
import os
from dotenv import load_dotenv
import shutil
import tempfile
#from paddleocr import PaddleOCR
import pdfplumber
#import google.generativeai as genai
import requests
import json
import re
from datetime import datetime

load_dotenv()

app = FastAPI()
#ocr = PaddleOCR(lang='fr')  # Initialisation unique

# Configuration de Gemini
#genai.configure(api_key=os.getenv('GEMINI_API_KEY'))

# Définition du modèle de données pour la requête
class PDFRequest(BaseModel):
    pdf_url: str

def clean_date(date_str: str) -> str:
    if not date_str or date_str == "null":
        return None
    
    # Supprimer les espaces et les caractères non numériques
    date_str = re.sub(r'[^\d/]', '', date_str)
    
    try:
        # Essayer de parser la date
        date_obj = datetime.strptime(date_str, '%d/%m/%Y')
        return date_obj.strftime('%Y-%m-%d')
    except ValueError:
        return date_str

def clean_gemini_response(text: str) -> str:
    # Supprimer les backticks et le mot "json" s'ils sont présents
    text = re.sub(r'^```json\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    text = text.strip()
    
    try:
        # Parser le JSON
        data = json.loads(text)
        
        # Nettoyer les dates dans les champs spécifiques
        date_fields = [
            'dateEnvoi',
            'datePriseEnCharge',
            'dateValiditeRecepisse',
            'date'
        ]
        
        def clean_dates_in_dict(d):
            if isinstance(d, dict):
                for key, value in d.items():
                    if key in date_fields:
                        d[key] = clean_date(value)
                    elif isinstance(value, (dict, list)):
                        clean_dates_in_dict(value)
            elif isinstance(d, list):
                for item in d:
                    if isinstance(item, (dict, list)):
                        clean_dates_in_dict(item)
        
        clean_dates_in_dict(data)
        
        # Convertir en JSON propre
        return json.dumps(data, ensure_ascii=False)
    except json.JSONDecodeError:
        return text

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

#@app.post("/treat-pdf/")
#async def treat_pdf(file: UploadFile = File(...)):
#    # Appelle la fonction extract_text et retourne le résultat
#    result = await extract_text(file)
#    text = result["text"]
#    
#    # Extraction des informations du texte
#    extracted_info = extract_all_info(text)
#    compta_lines = compta_lines_from_text(text)
#    header = header_from_text(text)
#    
#    return {
#        'compta_lines': compta_lines,
#        'header': header,
#        'extracted_info': extracted_info
#    }


#@app.post("/extract-text-only/")
#async def extract_text_only_endpoint(file: UploadFile = File(...)):
#    result = await extract_text_only(file)
#    text = result["text"]
#    method = result["method"]
    
#    # Extraction des informations supplémentaires si le texte a été extrait avec succès
#    extracted_info = {}
#    if text != "Impossible":
#        extracted_info = extract_all_info(text)
    
#    print(f'Texte extrait avec la méthode : {method}')
#    print('Contenu extrait :', text)
    
#    return {
#        'text': text, 
#        'method': method,
#        'extracted_info': extracted_info
#    }


#@app.get("/get-table-demande-collecte/")
#async def get_table_demande_collecte(
#                                    userId: Optional[str] = None,
#                                    site: Optional[str] = None,
#                                    filiere: Optional[str] = None,
#                                    dechet: Optional[str] = None):
#    return data_from_excel(userId, site, filiere, dechet)

"""
@app.post("/ai-extract-json-from-pdf/")
async def ai_extract_json_from_pdf(file: UploadFile = File(...)):
    #Process a PDF or image file to extract structured invoice information using AI
    from ai import process_invoice_file
    
    try:
        # Process the file using AI functions
        invoice_info = process_invoice_file(file)
        return invoice_info
    except Exception as e:
        return {"error": f"Failed to process invoice: {str(e)}"}
"""

# =============================================
# Nouveaux endpoints OCR et LLM (Fusionnés depuis ocr_then_llm/main.py)
# =============================================

"""
@app.post("/ocr-llm/process-pdf")
async def process_pdf(pdf_file: UploadFile = File(...)):
    #Nouvel endpoint pour traiter un PDF avec OCR et LLM
    #Fusionné depuis ocr_then_llm/main.py
    result = process_pdf_with_llm(pdf_file)
    return result

@app.get("/ocr-llm/health")
async def health_check():
    #Nouvel endpoint pour vérifier que l'API OCR et LLM est en ligne
    #Fusionné depuis ocr_then_llm/main.py
    return {"status": "ok tout va bien"}

"""


# =============================================
# Endpoints pour PaddleOCR
# =============================================

@app.get("/")
def read_root():
    return {"status": "OK"}

"""
@app.post("/extract-text-with-paddleocr/")
async def paddle_this(file: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name
    result = ocr.ocr(tmp_path)
    return result
"""

@app.post("/parse-pdf-and-extract-info/")
async def parse_pdf_and_extract_info(request: PDFRequest):
    try:
        # Télécharger le PDF
        response = requests.get(request.pdf_url)
        if not response.ok:
            return {"error": "Failed to fetch PDF"}
        
        # Sauvegarder temporairement le PDF
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(response.content)
            tmp_path = tmp.name

        # Extraire le texte du PDF
        text = ""
        with pdfplumber.open(tmp_path) as pdf:
            for page in pdf.pages:
                text += page.extract_text() or ""

        # Nettoyer le fichier temporaire
        os.unlink(tmp_path)

        if not text:
            return {"error": "No text could be extracted from PDF"}

        # Appeler l'API Gemini
        gemini_url = "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent"
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": os.getenv('GEMINI_API_KEY')
        }

        prompt = f"""Extract information from this BSD (Bordereau de Suivi de Déchets) text and format it according to this TypeScript interface. Only include fields that you can confidently extract from the text. Return the result as a valid JSON object without any markdown formatting or backticks. For dates, use the format DD/MM/YYYY:

interface BSDCerfa {{
    numeroBordereau: string;
    emetteur: {{
        statut: 'producteur' | 'collecteur' | 'transformateur' | 'autre';
        siret: string;
        nom: string;
        adresse: string;
        tel?: string;
        fax?: string;
        email?: string;
        contact?: string;
    }};
    installationDestination: {{
        entreposageProvisoire: boolean;
        siret: string;
        nom: string;
        adresse: string;
        tel?: string;
        email?: string;
        contact?: string;
        numeroCAP?: string;
        codeOperation: string;
    }};
    dechet: {{
        code: string;
        consistence: 'solide' | 'liquide' | 'gazeux';
        denominationUsuelle: string;
        categorie: 'solide' | 'liquide' | 'gazeux';
        etiquetageADR: string;
        conditionnement: string;
        nombreColis: number;
        poids: number;
        volume: number;
        volumeUnite: string;
        reel: boolean;
    }};
    negociant?: {{
        siren: string;
        nom: string;
        adresse: string;
        contact?: string;
        tel?: string;
        email?: string;
        fax?: string;
        numeroRecepisse?: string;
        departement?: string;
        dateValiditeRecepisse?: string;
    }};
    collecteurTransporteur: {{
        siren: string;
        nom: string;
        adresse: string;
        tel?: string;
        fax?: string;
        email?: string;
        contact?: string;
        numeroRecepisse?: string;
        departement?: string;
        dateValiditeRecepisse?: string;
        modeTransport: 'route' | 'multimodal';
        datePriseEnCharge?: string;
        signature?: string;
    }};
    expedition: {{
        dateEnvoi: string;
        heure: string;
        signature: string;
    }};
    realisationOperation: {{
        code: string;
        description: string;
        nom: string;
        date: string;
        signature: string;
    }};
    declarationEmetteur: {{
        nom: string;
        date: string;
        signature: string;
    }};
}}

Text to analyze:
{text}"""

        payload = {
            "contents": [{
                "parts": [{
                    "text": prompt
                }]
            }]
        }

        gemini_response = requests.post(gemini_url, headers=headers, json=payload)
        if not gemini_response.ok:
            return {"error": f"Failed to get response from Gemini: {gemini_response.text}"}

        gemini_data = gemini_response.json()
        raw_extracted_data = gemini_data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        
        # Nettoyer la réponse de Gemini
        cleaned_data = clean_gemini_response(raw_extracted_data)
        
        # Vérifier que c'est du JSON valide
        try:
            json.loads(cleaned_data)
        except json.JSONDecodeError as e:
            return {"error": f"Invalid JSON from Gemini: {str(e)}", "raw_response": raw_extracted_data}

        return {
            "text": text,
            "extracted_data": cleaned_data
        }

    except Exception as e:
        return {"error": f"Failed to process PDF: {str(e)}"}