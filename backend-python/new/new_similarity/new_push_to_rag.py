from new.new_extract_raw import get_raw_text_from_pdf
from fastapi import UploadFile
import json


async def process_document_for_rag(
    file: UploadFile,
    pdf_id: str,
    extracted_data: dict,
    document_type: str
) -> dict:
    """
    Traite un document pour le système RAG :
    1. Reconstruit gemini_data avec reverse_structure
    2. Extrait le texte brut du PDF
    3. Crée les objets nécessaires pour RAG
    
    Args:
        file: Fichier PDF uploadé
        pdf_id: ID du PDF
        extracted_data: Données structurées extraites
        document_type: Type de document (bon, bsd, facture)
    
    Returns:
        dict: Objets pour RAG (pdf_id, raw_text, gemini_answer, document_type)
    """
    
    try:
        print(f"🔄 Début du traitement RAG pour PDF {pdf_id}")
        
        # Importer reverse_structure selon la version V2 depuis main
        try:
            from main import V2
        except ImportError:
            V2 = False
        
        if V2:
            from new.new_structure_v2 import reverse_structure
        else:
            from new.new_structure import reverse_structure
        
        # 1. Reconstruire gemini_data avec reverse_structure
        print("📋 Reconstruction des données Gemini...")
        gemini_data = reverse_structure(document_type, extracted_data)
        print(f"✅ Données Gemini reconstruites: {len(gemini_data)} champs")
        
        # 2. Extraire le texte brut du PDF
        print("📄 Extraction du texte brut...")
        raw_text, _, parse_or_ocr = await get_raw_text_from_pdf(file)
        print(f"✅ Texte extrait: {len(raw_text)} caractères (méthode: {parse_or_ocr})")
        
        # 3. Créer les objets pour RAG
        rag_objects = {
            "pdf_id": pdf_id,
            "raw_text": raw_text,
            "gemini_answer": gemini_data,
            "document_type": document_type,
            "extraction_method": parse_or_ocr,
            "structured_data": extracted_data
        }
        
        print(f"✅ Traitement RAG terminé pour PDF {pdf_id}")
        print(f"📊 Résumé: {len(raw_text)} caractères, {len(gemini_data)} champs Gemini")
        
        return {
            "success": True,
            "message": "Document traité avec succès pour RAG",
            "data": rag_objects
        }
        
    except Exception as e:
        print(f"❌ Erreur dans process_document_for_rag: {str(e)}")
        return {
            "success": False,
            "error": f"Erreur lors du traitement RAG: {str(e)}",
            "pdf_id": pdf_id
        }

