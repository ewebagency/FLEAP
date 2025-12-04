from new.new_extract_raw import get_raw_text_from_pdf
from fastapi import UploadFile
import json
from .new_find_best_proxy import get_supabase_client
from .embedding_similarity import encode_corpus


async def process_document_for_rag(
    file: UploadFile,
    pdf_id: str,
    extracted_data: dict,
    document_type: str,
    entreprise_id: int,
    create_placeholder_only: bool = False
) -> dict:
    """
    Traite un document pour le système RAG :
    1. Vérifie si un RAG existe déjà pour ce PDF
    2. Reconstruit gemini_data avec reverse_structure (sauf si create_placeholder_only=True)
    3. Extrait le texte brut du PDF
    4. Met à jour le RAG existant ou crée un nouveau RAG
    
    Args:
        file: Fichier PDF uploadé
        pdf_id: ID du PDF
        extracted_data: Données structurées extraites (peut être vide si create_placeholder_only=True)
        document_type: Type de document (bon, bsd, facture)
        entreprise_id: ID de l'entreprise
        create_placeholder_only: Si True, crée un placeholder sans perfect_answer
    
    Returns:
        dict: Objets pour RAG (pdf_id, raw_text, gemini_answer, document_type, requires_pdf_info_link, is_update, existing_rag_id)
    """
    
    try:
        print(f"🔄 Début du traitement RAG pour PDF {pdf_id} (entreprise: {entreprise_id})")
        
        # 1. Vérifier si un RAG existe déjà pour ce PDF
        supabase = get_supabase_client()
        existing_rag = None
        existing_rag_id = None
        existing_prompt = None
        existing_pdf_infos_id = None
        pdf_changed = False
        
        try:
            # D'abord, récupérer id_rag depuis pdf_infos du PDF actuel
            pdf_info_response = supabase.table('pdf_infos')\
                .select('id_rag')\
                .eq('id', pdf_id)\
                .eq('entreprise_id', entreprise_id)\
                .execute()
            
            rag_id_from_pdf = None
            if pdf_info_response.data and len(pdf_info_response.data) > 0:
                id_rag_value = pdf_info_response.data[0].get('id_rag')
                if id_rag_value:
                    rag_id_from_pdf = str(id_rag_value)
                    print(f"📋 PDF a un id_rag: {rag_id_from_pdf}")
            
            # Si le PDF a un id_rag, chercher le RAG par son ID
            if rag_id_from_pdf:
                rag_response = supabase.table('bdd_rag')\
                    .select('id, prompt, pdf_infos_id, document_type')\
                    .eq('id', rag_id_from_pdf)\
                    .eq('entreprise_id', entreprise_id)\
                    .execute()
                
                if rag_response.data and len(rag_response.data) > 0:
                    existing_rag = rag_response.data[0]
                    existing_rag_id = existing_rag.get('id')
                    existing_prompt = existing_rag.get('prompt')
                    existing_pdf_infos_id = existing_rag.get('pdf_infos_id')
                    
                    # Vérifier si le PDF a changé
                    if existing_pdf_infos_id and str(existing_pdf_infos_id) != str(pdf_id):
                        pdf_changed = True
                        print(f"📋 RAG existant trouvé (ID: {existing_rag_id}) - PDF changé : {existing_pdf_infos_id} -> {pdf_id}")
                    else:
                        print(f"📋 RAG existant trouvé (ID: {existing_rag_id}) - même PDF")
                    
                    if existing_prompt:
                        print(f"📝 Prompt existant préservé ({len(str(existing_prompt))} caractères)")
        except Exception as e:
            print(f"⚠️ Erreur lors de la recherche de RAG existant: {str(e)}")
            # Continue même si la recherche échoue
        
        # 2. Reconstruire gemini_data avec reverse_structure (sauf si create_placeholder_only)
        if create_placeholder_only:
            # Mode placeholder : pas de perfect_answer
            print("📋 Mode placeholder : pas de reconstruction gemini_data")
            gemini_data = {}
        else:
            # Importer reverse_structure selon la version V2 depuis main
            try:
                from main import V2
            except ImportError:
                V2 = False
            
            if V2:
                from new.new_structure_v2 import reverse_structure
            else:
                from new.new_structure import reverse_structure
            
            # Reconstruire gemini_data avec reverse_structure
            print("📋 Reconstruction des données Gemini...")
            gemini_data = reverse_structure(document_type, extracted_data)
            print(f"✅ Données Gemini reconstruites: {len(gemini_data)} champs")
        
        # 3. Extraire le texte brut du PDF
        print("📄 Extraction du texte brut...")
        raw_text, _, parse_or_ocr = await get_raw_text_from_pdf(file)
        print(f"✅ Texte extrait: {len(raw_text)} caractères (méthode: {parse_or_ocr})")

        # 3b. Calculer l'embedding pour le texte brut
        embedding_vector = None
        if raw_text.strip():
            try:
                emb = encode_corpus([raw_text])
                embedding_vector = emb[0].tolist()
                print(f"✅ Embedding calculé (dim={len(embedding_vector)})")
            except Exception as emb_err:
                print(f"⚠️ Impossible de calculer l'embedding: {emb_err}")
                embedding_vector = None
        
        # 4. Créer les objets pour RAG
        rag_objects = {
            "pdf_id": pdf_id,
            "raw_text": raw_text,
            "embedding": embedding_vector,
            "gemini_answer": gemini_data,
            "document_type": document_type,
            "extraction_method": parse_or_ocr,
            "structured_data": extracted_data,
            # Indique au frontend qu'une création/mise à jour RAG implique une mise à jour de pdf_infos
            "requires_pdf_info_link": True,
            # Indique si c'est une mise à jour ou une création
            "is_update": existing_rag_id is not None,
            "existing_rag_id": existing_rag_id,
            # Préserver le prompt existant si disponible
            "preserve_prompt": existing_prompt is not None,
            # Indique si le PDF a changé (nécessite mise à jour pdf_infos_id et raw_text)
            "pdf_changed": pdf_changed,
            "old_pdf_infos_id": str(existing_pdf_infos_id) if existing_pdf_infos_id else None
        }
        
        action = "mis à jour" if existing_rag_id else "créé"
        placeholder_note = " (placeholder sans perfect_answer)" if create_placeholder_only else ""
        print(f"✅ Traitement RAG terminé pour PDF {pdf_id} (RAG {action}{placeholder_note})")
        if create_placeholder_only:
            print(f"📊 Résumé: {len(raw_text)} caractères, placeholder créé")
        else:
            print(f"📊 Résumé: {len(raw_text)} caractères, {len(gemini_data)} champs Gemini")
        
        return {
            "success": True,
            "message": f"Document traité avec succès pour RAG ({action})",
            "data": rag_objects
        }
        
    except Exception as e:
        print(f"❌ Erreur dans process_document_for_rag: {str(e)}")
        return {
            "success": False,
            "error": f"Erreur lors du traitement RAG: {str(e)}",
            "pdf_id": pdf_id
        }

