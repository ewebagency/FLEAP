import requests
import tempfile
import os
import json
import pdfplumber
from typing import Dict, Any, Optional
import re
from datetime import datetime

def extract_text_with_pdfplumber(pdf_url: str) -> Optional[str]:
    """
    Tente d'extraire le texte d'un PDF avec pdfplumber
    """
    try:
        # Télécharger le PDF
        response = requests.get(pdf_url)
        if not response.ok:
            return None
        
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

        return text if text.strip() else None
        
    except Exception as e:
        print(f"Erreur avec pdfplumber: {str(e)}")
        return None

def extract_text_with_mindee(pdf_url: str) -> tuple[Optional[str], Optional[str]]:
    """
    Extrait le texte d'un PDF avec l'API Mindee en utilisant le client Python officiel
    Retourne (prediction_text, full_result)
    """
    try:
        from mindee import Client, product
        
        # Télécharger le PDF
        response = requests.get(pdf_url)
        if not response.ok:
            return None, None
        
        # Sauvegarder temporairement le PDF
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(response.content)
            tmp_path = tmp.name

        # Préparer la clé API
        api_key = os.getenv('MINDEE_API_KEY')
        if not api_key:
            raise Exception('MINDEE_API_KEY not configured')

        # Init a new client
        mindee_client = Client(api_key=api_key)

        # Load a file from disk
        input_doc = mindee_client.source_from_path(tmp_path)

        # Load a file from disk and parse it.
        result = mindee_client.parse(
            product.FinancialDocumentV1,
            input_doc,
        )

        # Nettoyer le fichier temporaire
        os.unlink(tmp_path)

                # Extraire et formater la prediction pour Gemini
        prediction_text = None
        if result.document and hasattr(result.document, 'inference') and hasattr(result.document.inference, 'prediction'):
            prediction = result.document.inference.prediction

            
            
            # Fonction helper pour extraire la valeur d'un champ Mindee
            def get_mindee_value(obj, attr_name):
                """Extrait la valeur d'un champ Mindee, gère les objets avec .value et les valeurs directes"""
                if not hasattr(obj, attr_name):
                    return None
                
                attr = getattr(obj, attr_name)
                if attr is None:
                    return None
                
                # Si c'est un objet avec un attribut .value
                if hasattr(attr, 'value'):
                    return attr.value
                # Sinon, c'est probablement une valeur directe
                else:
                    return attr
            
            # Formater les line_items en retirant les champs techniques
            formatted_line_items = []
            if prediction.line_items:
                for item in prediction.line_items:
                    formatted_item = {
                        "description": get_mindee_value(item, 'description'),
                        "product_code": get_mindee_value(item, 'product_code'),
                        "quantity": get_mindee_value(item, 'quantity'),
                        "unit_measure": get_mindee_value(item, 'unit_measure'),
                        "unit_price": get_mindee_value(item, 'unit_price'),
                        "total_amount": get_mindee_value(item, 'total_amount'),
                        "tax_rate": get_mindee_value(item, 'tax_rate'),
                        "tax_amount": get_mindee_value(item, 'tax_amount')
                    }
                    formatted_line_items.append(formatted_item)
            
            # Formater la prediction en structure lisible
            formatted_prediction = {
                "invoiceData": {
                    "montant_ttc": get_mindee_value(prediction, 'total_amount'),
                    "montant_ht": get_mindee_value(prediction, 'total_net'),
                    "total_amount": get_mindee_value(prediction, 'total_amount'),
                    "line_items": formatted_line_items,
                    "customer_name": get_mindee_value(prediction, 'customer_name'),
                    "invoice_number": get_mindee_value(prediction, 'invoice_number'),
                    "date": get_mindee_value(prediction, 'date'),
                    "due_date": get_mindee_value(prediction, 'due_date'),
                    "supplier_name": get_mindee_value(prediction, 'supplier_name'),
                    "supplier_address": get_mindee_value(prediction, 'supplier_address'),
                    "customer_address": get_mindee_value(prediction, 'customer_address')
                }
            }
            
            prediction_text = formatted_prediction

 
        print(f"Prediction text Mindeeee: {prediction_text}")

 
        # Renvoyer prediction formatée et result complet
        return prediction_text, result.document.inference.prediction
        
    except Exception as e:
        print(f"Erreur avec Mindee: {str(e)}")
        return None, None

def extract_data_with_gemini(text: str) -> Dict[str, Any]:
    """
    Extrait les données structurées d'une facture avec Gemini
    """
    try:
        gemini_url = "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent"
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": os.getenv('GEMINI_API_KEY')
        }

        # Nouveau prompt minimaliste pour Gemini
        prompt = f"""Extract the following information from this French invoice/facture text and return a JSON array of 'departs', each with:
- bon_pesee (numéro de bon)
- date_collecte
- dechet_nom
- body: an array of lines, each with type_operation, unite, quantite, prix_unitaire, montant_ht

Example:
{{
  "departs": [
    {{
      "bon_pesee": "",
      "date_collecte": "",
      "dechet_nom": "",
      "body": [
        {{
          "type_operation": "",
          "unite": "",
          "quantite": 0,
          "prix_unitaire": 0,
          "montant_ht": 0
        }}
      ]
    }}
  ]
}}

Return only this minimal JSON structure, nothing else.

Text to analyze:
{text}"""

        payload = {
            "contents": [{
                "parts": [{
                    "text": prompt
                }]
            }]
        }

        print(f"Bouffe pour Gemini: {text}")
        gemini_response = requests.post(gemini_url, headers=headers, json=payload)
        if not gemini_response.ok:
            raise Exception(f"Failed to get response from Gemini: {gemini_response.text}")
        print(f"Gemini response: {gemini_response.text}")
        gemini_data = gemini_response.json()
        raw_extracted_data = gemini_data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        
        # Nettoyer la réponse de Gemini
        cleaned_data = clean_gemini_response(raw_extracted_data)
        
        # Vérifier que c'est du JSON valide
        try:
            json.loads(cleaned_data)
            return json.loads(cleaned_data)
        except json.JSONDecodeError as e:
            raise Exception(f"Invalid JSON from Gemini: {str(e)}")

    except Exception as e:
        print(f"Erreur avec Gemini: {str(e)}")
        return {}

def clean_gemini_response(text: str) -> str:
    """
    Nettoie la réponse de Gemini pour extraire le JSON
    """
    # Supprimer les backticks et le mot "json" s'ils sont présents
    text = re.sub(r'^```json\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    text = text.strip()
    
    try:
        # Parser le JSON pour vérifier qu'il est valide
        data = json.loads(text)
        # Convertir en JSON propre
        return json.dumps(data, ensure_ascii=False)
    except json.JSONDecodeError:
        return text

def normalize_date(date_str):
    """Convertit une date jj/mm/aaaa ou j/m/aaaa en aaaa-mm-jj (format ISO)"""
    if not date_str or not isinstance(date_str, str):
        return ""
    # Cherche un format jj/mm/aaaa ou j/m/aaaa
    match = re.match(r"(\d{1,2})[/-](\d{1,2})[/-](\d{4})", date_str)
    if match:
        day, month, year = match.groups()
        try:
            return datetime(int(year), int(month), int(day)).strftime("%Y-%m-%d")
        except Exception:
            return date_str
    # Si déjà au format ISO ou autre, retourne tel quel
    return date_str

def normalize_unite(unite):
    """Convertit les abréviations d'unité en libellé attendu par le front"""
    if not unite or not isinstance(unite, str):
        return ""
    mapping = {
        "U": "unités",
        "u": "unités",
        "UNITE": "unités",
        "Unité": "unités",
        "T": "tonnes",
        "t": "tonnes",
        "Tonne": "tonnes",
        "KG": "kg",
        "Kg": "kg",
        "kg": "kg",
        "L": "L",
        "l": "L",
        "M3": "m³",
        "m3": "m³",
        "M³": "m³",
        "m³": "m³"
    }
    return mapping.get(unite.strip(), unite)

def process_facture_pdf(pdf_url: str) -> Dict[str, Any]:
    """
    Fonction principale pour traiter un PDF de facture
    """
    try:
        mindee_result = None
        
        # 1. Tenter l'extraction avec pdfplumber
        print("Tentative d'extraction avec pdfplumber...")
        text = extract_text_with_pdfplumber(pdf_url)
        
        # 2. Si pdfplumber échoue, utiliser Mindee
        if not text:
            print("pdfplumber a échoué, tentative avec Mindee...")
            prediction_text, mindee_result = extract_text_with_mindee(pdf_url)
            text = prediction_text
        
        # 3. Si les deux échouent, retourner une erreur
        if not text:
            raise Exception("Impossible d'extraire le texte du PDF avec pdfplumber et Mindee")
        
        print(f"Texte extrait ({len(text)} caractères)")
        
        # 4. Extraire les données structurées avec Gemini
        print("Extraction des données structurées avec Gemini...")
        extracted_data = extract_data_with_gemini(text)
        
        # 5. Retourner les résultats
        result = {
            "text": text,
            "extracted_data": extracted_data,
            "success": True
        }
        
        # Ajouter le result Mindee si disponible
        if mindee_result:
            result["mindee_result"] = mindee_result
        
        return result
        
    except Exception as e:
        print(f"Erreur lors du traitement: {str(e)}")
        return {
            "error": str(e),
            "success": False
        }

def process_facture_pdf_only_ocr(pdf_url: str) -> Dict[str, Any]:
    """
    Fonction pour seulement parser/OCR sans Gemini
    """
    try:
        mindee_result = None
        
        # 1. Tenter l'extraction avec pdfplumber
        print("Tentative d'extraction avec pdfplumber...")
        text = extract_text_with_pdfplumber(pdf_url)
        
        # 2. Si pdfplumber échoue, utiliser Mindee
        if not text:
            print("pdfplumber a échoué, tentative avec Mindee...")
            prediction_text, mindee_result = extract_text_with_mindee(pdf_url)
            text = prediction_text
        
        # 3. Si les deux échouent, retourner une erreur
        if not text:
            raise Exception("Impossible d'extraire le texte du PDF avec pdfplumber et Mindee")
        
        print(f"Texte extrait ({len(text)} caractères)")
        
        # 4. Retourner les résultats (sans Gemini)
        result = {
            "text": text,
            "success": True
        }
        
        # Ajouter le result Mindee si disponible
        if mindee_result:
            result["mindee_result"] = mindee_result
        
        return result
        
    except Exception as e:
        print(f"Erreur lors du traitement: {str(e)}")
        return {
            "error": str(e),
            "success": False
        }

def extract_facture_with_gemini_from_data(mindee_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extrait les données structurées avec Gemini à partir de données Mindee existantes
    """
    try:
        # Préparer le texte pour Gemini
        text_for_gemini = ""
        
        # Si on a des données Mindee formatées, les utiliser
        if mindee_data.get("invoiceData"):
            text_for_gemini = str(mindee_data["invoiceData"])
        # Sinon, utiliser le texte brut
        elif mindee_data.get("text"):
            text_for_gemini = mindee_data["text"]
        else:
            # Essayer de convertir les données Mindee en texte
            text_for_gemini = str(mindee_data)
        
        print(f"Extraction Gemini avec {len(text_for_gemini)} caractères")
        
        # Extraire les données structurées avec Gemini
        extracted_data = extract_data_with_gemini(text_for_gemini)
        
        # Mapper vers la structure spécifique
        mapped_data = map_gemini_minimal_to_facture_structure(extracted_data)
        
        return {
            "extracted_data": mapped_data,
            "success": True
        }
        
    except Exception as e:
        print(f"Erreur lors de l'extraction Gemini: {str(e)}")
        return {
            "error": str(e),
            "success": False
        }

def map_gemini_minimal_to_facture_structure(gemini_data: dict) -> dict:
    """
    Reconstruit la structure FactureData complète à partir de la réponse minimale de Gemini
    """
    try:
        mapped_data = {
            "footer": {"total_ht": 0},
            "header": {
                "num_facture": "",
                "date_facture": "",
                "prestataire_nom": "",
                "prestataire_siret": "",
                "prestataire_num_client": "",
                "prestataire_description": ""
            },
            "departs": []
        }
        total_ht = 0
        for depart in gemini_data.get("departs", []):
            mapped_depart = {
                "line_header": {
                    "filiere": "",
                    "site_nom": "",
                    "bon_pesee": depart.get("bon_pesee", ""),
                    "bon_intention": "",
                    "site_siret": "",
                    "code_dechet": "",
                    "date_depart": normalize_date(depart.get("date_collecte", "")),
                    "num_dossier": "",
                    "type_dechet": depart.get("dechet_nom", ""),
                    "site_description": "",
                    "site_num_affaire": "",
                    "dechet_description": "",
                    "nom_contenant": "",
                    "volume_contenant": "",
                    "unite_contenant": ""
                },
                "line_body": [],
                "linked_to_bsd": False
            }
            for line in depart.get("body", []):
                mapped_line = {
                    "unite": normalize_unite(line.get("unite", "")),
                    "quantite": line.get("quantite", 0),
                    "montant_ht": line.get("montant_ht", 0),
                    "prix_unitaire": line.get("prix_unitaire", 0),
                    "type_operation": line.get("type_operation", "")
                }
                total_ht += mapped_line["montant_ht"]
                mapped_depart["line_body"].append(mapped_line)
            mapped_data["departs"].append(mapped_depart)
        mapped_data["footer"]["total_ht"] = total_ht
        return mapped_data
    except Exception as e:
        print(f"Erreur lors du mapping minimal: {str(e)}")
        return {
            "footer": {"total_ht": 0},
            "header": {
                "num_facture": "",
                "date_facture": "",
                "prestataire_nom": "",
                "prestataire_siret": "",
                "prestataire_num_client": "",
                "prestataire_description": ""
            },
            "departs": []
        }
