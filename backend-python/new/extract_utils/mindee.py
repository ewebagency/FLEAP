import requests
import tempfile
import os
import json
import pdfplumber
from typing import Dict, Any, Optional
import re
from datetime import datetime
#from mindee import Client, product




async def send_to_mindee(file): # -> tuple[Optional[str], Optional[str]]
    """
    Extrait le texte d'un PDF avec l'API Mindee en utilisant le client Python officiel
    Retourne (prediction_text, full_result)
    """
    try:
        from mindee import Client, product
        
        # Préparer la clé API
        api_key = os.getenv('MINDEE_API_KEY')
        if not api_key:
            raise Exception('MINDEE_API_KEY not configured')

        # Init a new client
        mindee_client = Client(api_key=api_key)

        # Sauvegarder temporairement le fichier uploadé
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        # Reset file position for potential future reads
        await file.seek(0)

        try:
            # Load a file from disk and parse it
            with open(tmp_path, 'rb') as file_obj:
                input_doc = mindee_client.source_from_file(file_obj)
                result = mindee_client.parse(
                    product.FinancialDocumentV1,
                    input_doc,
                )
        finally:
            # Nettoyer le fichier temporaire
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

        # Extraire et formater la prediction pour Gemini
        prediction_text = None
        if hasattr(result, 'document') and hasattr(result.document, 'inference') and hasattr(result.document.inference, 'prediction'):
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
            if hasattr(prediction, 'line_items') and prediction.line_items:
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

        return prediction_text, result.document.inference.prediction if hasattr(result, 'document') and hasattr(result.document, 'inference') and hasattr(result.document.inference, 'prediction') else None
        
    except Exception as e:
        print(f"Erreur avec Mindee: {str(e)}")
        return None, None
