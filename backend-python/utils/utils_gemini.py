import json
from typing import Dict, Any
import re
from datetime import datetime
import os
import requests
from dotenv import load_dotenv

load_dotenv()

async def extract_gemini(text: str | dict, prompt: str) -> Dict[str, Any]:
    """
    Extrait les informations d'un texte brut ou d'un dictionnaire avec un prompt défini en utilisant l'API Gemini
    """
    try:
        # Ensure text is not None before concatenation
        if text is None:
            text = ""
        elif isinstance(text, dict):
            text = json.dumps(text, ensure_ascii=False, indent=2)
        
        # Build request inline
        prompt_to_send = prompt + "\n\n" + text
        
        # Call Gemini API
        gemini_response = requests.post(
            "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent",
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": os.getenv('GEMINI_API_KEY')
            },
            json={"contents": [{"parts": [{"text": prompt_to_send}]}]}
        )
        
        if not gemini_response.ok:
            return {"error": f"Failed to get response from Gemini: {gemini_response.text}"}

        # Extract and clean data inline
        raw_extracted_data = gemini_response.json().get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        cleaned_data = clean_gemini_response(raw_extracted_data)
        
        # Validate JSON
        try:
            json.loads(cleaned_data)
            return {"success": True, "text": text, "extracted_data": cleaned_data}
        except json.JSONDecodeError as e:
            # Fallback: extract key-value pairs
            try:
                import re
                matches = re.findall(r'"([^"]+)"\s*:\s*"([^"]*)"', raw_extracted_data)
                if matches:
                    minimal_data = {key: value for key, value in matches}
                    return {"success": True, "text": text, "extracted_data": json.dumps(minimal_data, ensure_ascii=False)}
                else:
                    return {"error": f"Invalid JSON from Gemini: {str(e)}", "raw_response": raw_extracted_data}
            except Exception:
                return {"error": f"Invalid JSON from Gemini: {str(e)}", "raw_response": raw_extracted_data}

    except Exception as e:
        return {"error": f"Failed to extract BSD with Gemini: {str(e)}"}


def clean_date(date_str: str) -> str:
    if not date_str or date_str == "null":
        return None
    
    # Nettoyer la chaîne de date
    date_str = str(date_str).strip()
    
    
    # Essayer différents formats de date
    date_formats = [
        '%Y-%m-%d',      # 2025-07-17
        '%d/%m/%Y',      # 17/07/2025
        '%d-%m-%Y',      # 17-07-2025
        '%Y/%m/%d',      # 2025/07/17
    ]
    
    for date_format in date_formats:
        try:
            date_obj = datetime.strptime(date_str, date_format)
            result = date_obj.strftime('%Y-%m-%d')  # Standardiser en YYYY-MM-DD
            return result
        except ValueError:
            continue
    
    # Si aucun format ne fonctionne, retourner la date originale
    # print(f"❌ clean_date: aucun format reconnu, retourne original: '{date_str}'")
    return date_str

def clean_gemini_response(text: str) -> str:
    """
    Nettoie la réponse de Gemini pour extraire le JSON et corriger les erreurs de syntaxe courantes
    """
    # Supprimer les backticks et le mot "json" s'ils sont présents
    text = re.sub(r'^```json\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    text = text.strip()
    
    # Première tentative de parsing
    try:
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
    
    except json.JSONDecodeError as e:
        #print(f"❌ Erreur JSON initiale: {str(e)}")
        #print(f"📝 Texte problématique: {text}")
        
        # Tentatives de correction automatique
        corrected_text = text
        
        # 1. Supprimer les virgules trailing (virgules en trop à la fin des objets/listes)
        # Pattern pour virgule trailing dans un objet: ,\s*}
        corrected_text = re.sub(r',\s*}', '}', corrected_text)
        # Pattern pour virgule trailing dans une liste: ,\s*]
        corrected_text = re.sub(r',\s*]', ']', corrected_text)
        
        # 2. Supprimer les virgules trailing avant les fermetures de chaînes
        # Pattern pour virgule trailing avant une chaîne fermée: ,\s*"
        corrected_text = re.sub(r',\s*"([^"]*)"\s*}', r', "\1"}', corrected_text)
        
        # 3. Corriger les virgules multiples
        corrected_text = re.sub(r',\s*,', ',', corrected_text)
        
        # 4. Supprimer les espaces en trop autour des virgules
        corrected_text = re.sub(r'\s*,\s*', ', ', corrected_text)
        
        # 5. S'assurer que les chaînes sont bien fermées
        # Compter les guillemets et s'assurer qu'ils sont pairs
        quote_count = corrected_text.count('"')
        if quote_count % 2 != 0:
            # Ajouter un guillemet fermant si nécessaire
            corrected_text += '"'
        
        # Deuxième tentative de parsing avec le texte corrigé
        try:
            data = json.loads(corrected_text)
            
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
            
            #print(f"✅ JSON corrigé avec succès")
            return json.dumps(data, ensure_ascii=False)
            
        except json.JSONDecodeError as e2:
            print(f"❌ Échec de la correction automatique: {str(e2)}")
            print(f"📝 Texte corrigé: {corrected_text}")
            
            # Dernière tentative: essayer d'extraire un JSON valide en supprimant les lignes problématiques
            try:
                # Essayer de trouver un objet JSON valide dans le texte
                lines = corrected_text.split('\n')
                cleaned_lines = []
                brace_count = 0
                in_object = False
                
                for line in lines:
                    line = line.strip()
                    if not line:
                        continue
                    
                    # Compter les accolades pour détecter le début/fin d'objet
                    brace_count += line.count('{') - line.count('}')
                    
                    if '{' in line and not in_object:
                        in_object = True
                    
                    if in_object:
                        # Nettoyer la ligne des virgules trailing
                        line = re.sub(r',\s*$', '', line)
                        cleaned_lines.append(line)
                    
                    if brace_count <= 0 and in_object:
                        break
                
                final_text = '\n'.join(cleaned_lines)
                data = json.loads(final_text)
                
                # Nettoyer les dates
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
                
                print(f"✅ JSON extrait avec succès après nettoyage avancé")
                return json.dumps(data, ensure_ascii=False)
                
            except Exception as e3:
                print(f"❌ Échec de l'extraction avancée: {str(e3)}")
                # Retourner le texte original en cas d'échec total
                return text
