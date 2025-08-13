from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
import shutil
import tempfile
import pdfplumber
import requests
import json
import re
from datetime import datetime
from typing import Dict, Any
from parse_ocr_extract_facture import process_facture_pdf, process_facture_pdf_only_ocr, extract_facture_with_gemini_from_data
#from utils.utils_paddleocr import run_paddle_ocr 
from utils.utils_gemini import extract_bsd_with_gemini, clean_gemini_response, clean_date, extract_json_with_gemini_using_prompt
from prompts import prompt_bon
from utils.utils_doctr import ocr_this_pdf_with_doctr, cleanup_model

load_dotenv()

app = FastAPI()

@app.on_event("shutdown")
async def shutdown_event():
    """Nettoyer les ressources lors de l'arrêt du serveur"""
    cleanup_model()


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
    


"""
@app.post("/paddle-ocr")
async def paddle_ocr_from_main(file: UploadFile):
    return await run_paddle_ocr(file)


@app.post("/extract-bsd-with-paddle-ocr")
async def extract_bsd_with_paddle_ocr(file: UploadFile):
    print("Extract Raw Data with Paddle OCR")
    result = await run_paddle_ocr(file)
    text = result["text"]
    print("Text extracted from Paddle OCR", text)
    print("Extract Parsed Data with Gemini")
    parsed_info = await extract_bsd_with_gemini(text)
    return parsed_info
"""

@app.post("/extract-bsd-with-doctr")
async def extract_bsd_with_doctr(file: UploadFile):
    print("Extract Raw Data with Doctr")
    result = await ocr_this_pdf_with_doctr(file)
    text = result["text"]
    print("Text extracted from DocTR OCR", text)
    print("Extract Parsed Data with Gemini")
    parsed_info = await extract_bsd_with_gemini(text)
    return parsed_info


@app.post("/extract-with-doctr")
async def extract_raw_text_with_doctr(file: UploadFile):
    print("Extract Raw Data with Doctr")
    result = await ocr_this_pdf_with_doctr(file)
    text = result["text"]
    print("Text extracted from DocTR OCR", text)
    return result

@app.post("/extract-with-doctr/bon")
async def extract_json_with_gemini_using_prompt_bon(file: UploadFile):
    print("Extract Raw Data with Doctr")
    result = await ocr_this_pdf_with_doctr(file)
    text = result["text"]
    print("Text extracted from DocTR OCR", text)
    print("Extract Parsed Data with Gemini")
    parsed_info = await extract_json_with_gemini_using_prompt(text, prompt_bon)
    return parsed_info