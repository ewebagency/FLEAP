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

load_dotenv()

app = FastAPI()


# Définition du modèle de données pour la requête
class PDFRequest(BaseModel):
    pdf_url: str

class MindeeDataRequest(BaseModel):
    mindee_data: dict[str, Any]

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