import requests
import tempfile
import os
import json
import pdfplumber
from typing import Dict, Any, Optional

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

        # Template simple pour les factures
        prompt = f"""Extract information from this invoice/facture text and format it according to this TypeScript interface. Return the result as a valid JSON object without any markdown formatting or backticks.
        The text is in french.
        You have a lot of informations in lin_items.description, trust you to understand the waste, the container, the volume of the container, the date, the location (name of the site) and the type of the operation
        

interface FactureData {{
    header: {{
        prestataire_nom: string;
        prestataire_siret: string;
        prestataire_description: string;
        prestataire_num_client: string;
        num_facture: string;
        date_facture: string;
    }};
    departs: Array<{{
        site_nom: string;
        site_siret: string;
        dechet_nom: string;
        code_ced: string;
        date_collecte: string;
        contenant_nom: string;
        contenant_volume: string;
        contenant_unite: string;
        date_prise_en_charge: string;
        body: Array<{{
            type_operation: string;
            unite: string;
            quantite: number;
            prix_unitaire: number;
            montant_ht: number;
        }}>;
    }}>;
    footer: {{
        total_ht: number;
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
    import re
    
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
        mapped_data = map_gemini_to_facture_structure(extracted_data)
        
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

def map_gemini_to_facture_structure(gemini_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Mappe la réponse de Gemini vers la structure JSON spécifique des factures
    Filtre les éléments avec des valeurs nulles ou 0
    """
    try:
        # Structure de base
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

        # Mapper le header
        if gemini_data.get("header"):
            header = gemini_data["header"]
            mapped_data["header"].update({
                "num_facture": header.get("num_facture", ""),
                "date_facture": header.get("date_facture", ""),
                "prestataire_nom": header.get("prestataire_nom", ""),
                "prestataire_siret": header.get("prestataire_siret", ""),
                "prestataire_num_client": header.get("prestataire_num_client", ""),
                "prestataire_description": header.get("prestataire_description", "")
            })

        # Mapper les départs
        if gemini_data.get("departs"):
            for depart in gemini_data["departs"]:
                mapped_depart = {
                    "line_header": {
                        "filiere": "",
                        "site_nom": "",
                        "bon_pesee": "",
                        "site_siret": "",
                        "code_dechet": "",
                        "date_depart": "",
                        "num_dossier": "",
                        "type_dechet": "",
                        "bon_intention": "",
                        "site_description": "",
                        "site_num_affaire": "",
                        "dechet_description": ""
                    },
                    "line_body": [],
                    "linked_to_bsd": False
                }

                # Mapper le line_header
                if depart.get("site_nom"):
                    mapped_depart["line_header"]["site_nom"] = depart["site_nom"]
                if depart.get("site_siret"):
                    mapped_depart["line_header"]["site_siret"] = depart["site_siret"]
                if depart.get("dechet_nom"):
                    mapped_depart["line_header"]["type_dechet"] = depart["dechet_nom"]
                if depart.get("code_ced"):
                    mapped_depart["line_header"]["code_dechet"] = depart["code_ced"]
                if depart.get("date_collecte"):
                    mapped_depart["line_header"]["date_depart"] = depart["date_collecte"]

                # Mapper le line_body en filtrant les valeurs nulles
                if depart.get("body"):
                    for line in depart["body"]:
                        # Vérifier si la ligne a des valeurs significatives
                        quantite = line.get("quantite", 0)
                        montant_ht = line.get("montant_ht", 0)
                        prix_unitaire = line.get("prix_unitaire", 0)
                        
                        # Ne créer la ligne que si elle a des valeurs significatives
                        if quantite > 0 or montant_ht > 0 or prix_unitaire > 0:
                            mapped_line = {
                                "unite": line.get("unite", ""),
                                "quantite": quantite,
                                "montant_ht": montant_ht,
                                "prix_unitaire": prix_unitaire,
                                "type_operation": line.get("type_operation", "")
                            }
                            mapped_depart["line_body"].append(mapped_line)

                # Ajouter le départ seulement s'il a des données significatives
                if (mapped_depart["line_header"]["site_nom"] or 
                    mapped_depart["line_header"]["site_siret"] or 
                    mapped_depart["line_header"]["type_dechet"] or
                    mapped_depart["line_body"]):
                    mapped_data["departs"].append(mapped_depart)

        # Calculer le total HT
        total_ht = 0
        for depart in mapped_data["departs"]:
            for line in depart["line_body"]:
                total_ht += line.get("montant_ht", 0)
        
        mapped_data["footer"]["total_ht"] = total_ht

        return mapped_data

    except Exception as e:
        print(f"Erreur lors du mapping: {str(e)}")
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
