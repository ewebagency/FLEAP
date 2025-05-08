from .utils_ocr import convert_pdf_to_markdown
from .utils_llm import send_to_gemini
import json
from fastapi import HTTPException

def process_pdf_with_llm(pdf_file) -> dict:
    """
    Process a PDF file through OCR and LLM to extract structured information
    
    Args:
        pdf_file: The PDF file object from FastAPI upload
        
    Returns:
        dict: Structured information extracted from the PDF
        
    Raises:
        HTTPException: If there's an error during processing
    """
    try:
        # Step 1: Convert PDF to markdown using OCR
        markdown_text = convert_pdf_to_markdown(pdf_file)
        
        # Step 2: Prepare prompt for Gemini
        prompt = """
        Analyse le texte suivant et extrait les informations dans un format JSON structuré.
        Si tu trouves les informations suivantes, inclus-les dans le JSON :
        - Numéro de facture
        - Date de facture
        - Nom du prestataire
        - SIRET du prestataire
        - Numéro client
        - Description du prestataire
        - Total HT
        - Détails des opérations (type, quantité, prix unitaire, montant HT)
        - Informations sur le site (nom, SIRET, description)
        - Type de déchet
        - Code déchet
        - Date de départ
        - Numéro de dossier
        - Numéro de bon de pesée
        - Numéro de bon d'intention
        
        Format de réponse attendu :
        {
            "header": {
                "num_facture": "",
                "date_facture": "",
                "prestataire_nom": "",
                "prestataire_siret": "",
                "prestataire_num_client": "",
                "prestataire_description": ""
            },
            "footer": {
                "total_ht": 0
            },
            "departs": [
                {
                    "line_header": {
                        "site_nom": "",
                        "site_siret": "",
                        "site_description": "",
                        "type_dechet": "",
                        "code_dechet": "",
                        "date_depart": "",
                        "num_dossier": "",
                        "bon_pesee": "",
                        "bon_intention": ""
                    },
                    "line_body": [
                        {
                            "type_operation": "",
                            "quantite": 0,
                            "unite": "",
                            "prix_unitaire": 0,
                            "montant_ht": 0
                        }
                    ]
                }
            ]
        }
        
        Si une information n'est pas trouvée, laisse le champ vide ou à 0.
        Assure-toi que le SIRET contient toujours 14 chiffres.
        Les dates doivent être au format ISO (YYYY-MM-DDTHH:mm:ss.sssZ).
        Les montants doivent être des nombres (pas de virgule).
        """
        
        # Step 3: Send to Gemini for analysis
        gemini_response = send_to_gemini(markdown_text, prompt)
        
        if not gemini_response:
            raise HTTPException(status_code=500, detail="Erreur lors de l'analyse par Gemini")
            
        # Step 4: Extract and parse the JSON response
        try:
            # Extract the text content from Gemini's response
            candidates = gemini_response.get('candidates', [])
            if not candidates:
                print("❌ Pas de candidats dans la réponse Gemini")
                print(f"Réponse complète: {json.dumps(gemini_response, indent=2)}")
                raise Exception("Pas de candidats dans la réponse Gemini")
                
            content = candidates[0].get('content', {})
            if not content:
                print("❌ Pas de contenu dans le premier candidat")
                print(f"Candidat: {json.dumps(candidates[0], indent=2)}")
                raise Exception("Pas de contenu dans le premier candidat")
                
            parts = content.get('parts', [])
            if not parts:
                print("❌ Pas de parties dans le contenu")
                print(f"Contenu: {json.dumps(content, indent=2)}")
                raise Exception("Pas de parties dans le contenu")
                
            response_text = parts[0].get('text', '{}')
            print(f"📝 Texte extrait de Gemini: {response_text[:200]}...")  # Affiche les 200 premiers caractères
            
            # Nettoyer la réponse en enlevant les marqueurs de bloc de code
            if response_text.startswith('```json'):
                response_text = response_text[7:]  # Enlever ```json
            if response_text.startswith('```'):
                response_text = response_text[3:]  # Enlever ```
            if response_text.endswith('```'):
                response_text = response_text[:-3]  # Enlever ```
            
            # Nettoyer les espaces et retours à la ligne
            response_text = response_text.strip()
            
            # Trouver le premier { et le dernier }
            start = response_text.find('{')
            end = response_text.rfind('}') + 1
            if start != -1 and end != 0:
                response_text = response_text[start:end]
            
            print(f"📝 Texte nettoyé: {response_text[:200]}...")
            
            # Parse the JSON response
            try:
                structured_data = json.loads(response_text)
                return structured_data
            except json.JSONDecodeError as e:
                print(f"❌ Erreur de parsing JSON: {str(e)}")
                print(f"Texte qui pose problème: {response_text}")
                raise HTTPException(status_code=500, detail=f"Erreur lors du parsing de la réponse: {str(e)}")
            
        except (json.JSONDecodeError, KeyError, IndexError) as e:
            print(f"❌ Erreur lors du parsing de la réponse Gemini: {str(e)}")
            print(f"Texte reçu: {response_text if 'response_text' in locals() else 'Non disponible'}")
            raise HTTPException(status_code=500, detail=f"Erreur lors du parsing de la réponse: {str(e)}")
            
    except Exception as e:
        print(f"Erreur dans process_pdf_with_llm: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur lors du traitement: {str(e)}")
