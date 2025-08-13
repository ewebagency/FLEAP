import json
from typing import Dict, Any
import re
from datetime import datetime
import os
import requests
from dotenv import load_dotenv

load_dotenv()

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

async def extract_bsd_with_gemini(text: str) -> Dict[str, Any]:
    """
    Extrait les informations d'un BSD (Bordereau de Suivi des Déchets) 
    en utilisant l'API Gemini
    """
    try:
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
            "success": True,
            "text": text,
            "extracted_data": cleaned_data
        }

    except Exception as e:
        return {"error": f"Failed to extract BSD with Gemini: {str(e)}"}


async def extract_json_with_gemini_using_prompt(text: str, prompt: str) -> Dict[str, Any]:
    """
    Extrait les informations d'un texte brut avec un prompt défini en utilisant l'API Gemini
    """
    try:
        # Appeler l'API Gemini
        gemini_url = "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent"
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": os.getenv('GEMINI_API_KEY')
        }

        prompt_to_send = prompt + "\n\n" + text
        payload = {
            "contents": [{
                "parts": [{
                    "text": prompt_to_send
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
            "success": True,
            "text": text,
            "extracted_data": cleaned_data
        }

    except Exception as e:
        return {"error": f"Failed to extract BSD with Gemini: {str(e)}"}

