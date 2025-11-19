from fastapi import FastAPI, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from typing import Any

#from prompts import prompt_bon
from parse_ocr_extract_facture import process_facture_pdf, process_facture_pdf_only_ocr, extract_facture_with_gemini_from_data
#from utils.utils_paddleocr import run_paddle_ocr
from utils.utils_gemini import extract_gemini

from utils.utils_parse import parse_pdf, parse_pdf_file
from prompts import prompt_bsd, prompt_bon
from new.new_smart_split import smart_split_pdf, recognize_type_one_page_llm


import json
import psutil
import os
import gc

from utils.utils_enrich import enrich_text
from utils.document_types import get_prompt, transform_document_data
from utils.utils_doctr import ocr_this_pdf_with_doctr, cleanup_model, initialize_model
from utils.utils_manuscrit import classify_ocr_with_density, extract_handwritten_lines

# ===== CONFIGURATION DE VERSION =====
V2 = True  # Mettre à True pour utiliser les nouveaux prompts et structures v2

from new.new_prompts import get_specific_prompt
from new.new_extract_raw import get_raw_text_from_pdf
from new.new_confidence import (
    get_confidence,
    handwritten_confidence,
    analyze_large_word_misreads,
)
from new.new_large_word_alert import evaluate_large_word_legibility

# Import conditionnel selon la version
if V2:
    from new.new_structure_v2 import structure, reverse_structure
    print("✅ Mode V2 activé - Utilisation de new_structure_v2")
else:
    from new.new_structure import structure, reverse_structure
    print("✅ Mode V1 activé - Utilisation de new_structure")

from new.new_recognize_type import recognize_type_one_page
from new.new_alerte import alerte_function
from new.new_similarity.new_find_best_proxy import create_best_prompt_example
import time
from new.extract_text_layout_v2 import (
    extract_text_with_grid_for_llm,
    render_large_word_confidence_preview,
)
from new.extract_multi_page_gemini import extract_gemini_multi_page
from new.extract_image_gemini import extract_gemini_with_images, should_use_image_mode, log_image_mode_decision
from fastapi.responses import Response
from new.parse_or_ocr import compare_parse_and_ocr

# Compteur global de pages traitées pour reset du modèle OCR
_pages_processed = 0
MAX_PAGES_BEFORE_RESET = 8




def get_memory_usage():
    #Retourne l'utilisation mémoire actuelle en MB
    process = psutil.Process(os.getpid())
    memory_info = process.memory_info()
    return {
        "rss_mb": memory_info.rss / 1024 / 1024,  # Resident Set Size en MB
        "vms_mb": memory_info.vms / 1024 / 1024,  # Virtual Memory Size en MB
        "percent": process.memory_percent()  # Pourcentage d'utilisation
    }

def print_memory_usage(stage=""):
    #Affiche l'utilisation mémoire avec un label
    memory = get_memory_usage()
    #print(f"🔄 MÉMOIRE {stage}: RSS={memory['rss_mb']:.1f}MB, VMS={memory['vms_mb']:.1f}MB, {memory['percent']:.1f}%")

def reset_ocr_model_if_needed():
    """Reset le modèle OCR si le nombre de pages traitées dépasse la limite"""
    global _pages_processed
    if _pages_processed >= MAX_PAGES_BEFORE_RESET:
        print(f"🔄 Reset modèle OCR après {_pages_processed} pages traitées")
        cleanup_model()
        initialize_model()
        _pages_processed = 0
        gc.collect()
        print("✅ Modèle OCR réinitialisé")


load_dotenv()

app = FastAPI()


@app.on_event("startup")
async def startup_event():
    #Initialise les ressources au démarrage du serveur
    print("Démarrage du serveur Fleap...")
    # Initialiser le modèle OCR
    initialize_model()
    print("Serveur Fleap démarré avec succès")

@app.on_event("shutdown")
async def shutdown_event():
    #Nettoyer les ressources lors de l'arrêt du serveur
    print("Arrêt du serveur Fleap...")
    cleanup_model()
    print("Serveur Fleap arrêté")



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


@app.post("/parse-pdf-and-extract-info/") #Sur les BSD
async def parse_pdf_and_extract_info(request: PDFRequest):
    parsed_pdf = parse_pdf(request.pdf_url)
    print("======Parsed PDF:", parsed_pdf)
    json_from_gemini = await extract_gemini(parsed_pdf, prompt_bsd)
    print("======JSON from Gemini:", json_from_gemini)
    return json_from_gemini


#=============================================FACTURES=============================================
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

#=============================================FACTURES=============================================




#=============================================BSD=============================================

@app.post("/extract-bsd-with-paddle-ocr")
async def extract_bsd_with_paddle_ocr(file: UploadFile):
    print("Extract Raw Data with Paddle OCR")
    #result = await run_paddle_ocr(file)
    result = await ocr_this_pdf_with_doctr(file)
    text = result["text"]
    print("Text extracted from Paddle OCR", text)
    print("Extract Parsed Data with Gemini")
    parsed_info = await extract_gemini(text, prompt_bsd)
    return parsed_info


#@app.post("/extract-bsd-with-doctr")
#async def extract_bsd_with_doctr(file: UploadFile):
#    print("Extract Raw Data with Doctr")
#    result = await ocr_this_pdf_with_doctr(file)
#    text = result["text"]
#    print("Text extracted from DocTR OCR", text)
#    print("Extract Parsed Data with Gemini")
#    parsed_info = await extract_gemini(text, prompt_bsd)
#    return parsed_info

#=============================================BSD=============================================


#=============================================BONS=============================================
@app.post("/ocr-enrich-bon")
async def ocr_enrich_bon(file: UploadFile = Form(...), known_data: str = Form(...), pdf_status: str = Form(None), entreprise_name: str = Form(None)):
    
    #Parse le PDF, si ça marche pas utilise l'OCR
    #Enrichi le texte avec les données connues
    #Envoie le texte enrichi à Gemini
    #Renvoie les données structurées

    known_data_dict = json.loads(known_data)
    
    # Log du statut du PDF reçu
    if pdf_status:
        print(f"📊 Statut du PDF reçu: {pdf_status}")
    else:
        print("📊 Aucun statut de PDF fourni")
    
    # Log du nom de l'entreprise reçu
    if entreprise_name:
        print(f"🏢 Nom de l'entreprise reçu: {entreprise_name}")
    else:
        print("🏢 Aucun nom d'entreprise fourni")
   
    print("\nTentative de parsing PDF...")
    
    # Essayer d'abord le parsing PDF
    parse_result = await parse_pdf_file(file)
    
    if parse_result.get("success"):
        print("✅ Parsing PDF réussi")
        text = parse_result["text"]
    else:
        print("❌ Parsing PDF échoué, utilisation de l'OCR...")
        # Réinitialiser le fichier pour l'OCR
        await file.seek(0)
        #result = await run_paddle_ocr(file)
        result = await ocr_this_pdf_with_doctr(file)
        text = result["text"]

    print("\nEnrichment with BDD")
    enriched_text = enrich_text(text, known_data_dict)
    
    print("\nExtract Data with Gemini")
    prompt = get_prompt("bon", entreprise_name)
    gemini_result = await extract_gemini(enriched_text, prompt)
    
    # Vérifier si Gemini a retourné une erreur
    if "error" in gemini_result:
        return {"error": gemini_result["error"]}
    
    # Extraire les données JSON de la réponse Gemini
    extracted_data = gemini_result.get("extracted_data", "{}")
    
    # Transform the extracted data to BSDCerfa format
    print("\nFormat data to JSON")
    bsd_cerfa_data = transform_document_data("bon", extracted_data, known_data_dict)
    
    # Extraire le perfect_extract du résultat
    perfect_extract = bsd_cerfa_data.get("perfect_extract", False)
    
    return {
        "extracted_data": extracted_data,
        "bsd_cerfa_data": bsd_cerfa_data,
        "perfect_extract": perfect_extract
    }


#=============================================BONS=============================================





#=============================================OCR ONLY=============================================
#@app.post("/paddle-ocr")
#async def paddle_ocr_from_main(file: UploadFile):
#    return await run_paddle_ocr(file)


@app.post("/extract-with-doctr")
async def extract_raw_text_with_doctr(file: UploadFile):
    global _pages_processed
    
    print("=" * 60)
    print("🚀 DÉBUT EXTRACTION OCR AVEC DOCTR")
    
    try:
        result = await ocr_this_pdf_with_doctr(file)
        
        # Count pages for OCR model reset
        text = result["text"]
        estimated_pages = max(1, len(text) // 2000)
        _pages_processed += estimated_pages
        
        print(f"📝 Texte extrait: {len(text)} caractères")
        print(f"📊 Pages traitées: {_pages_processed}/{MAX_PAGES_BEFORE_RESET}")
        
        # Reset OCR model if needed
        reset_ocr_model_if_needed()
        
        # Cleanup memory
        gc.collect()
        
        return result
        
    except Exception as e:
        print(f"❌ ERREUR lors de l'extraction: {str(e)}")
        raise e

#@app.post("/extract-with-doctr/bon")
#async def extract_json_with_gemini_using_prompt_bon(file: UploadFile):
#    print("Extract Raw Data with Doctr")
#    result = await ocr_this_pdf_with_doctr(file)
#    text = result["text"]
#    print("Text extracted from DocTR OCR", text)
#    print("Extract Parsed Data with Gemini")
#    parsed_info = await extract_json_with_gemini_using_prompt(text, prompt_bon)
#    return parsed_info


#=============================================OCR ONLY=============================================


#=============================================OCR DENSITY=============================================
@app.post("/ocr-density")
async def ocr_density(file: UploadFile):
    ocr_json = await ocr_this_pdf_with_doctr(file)
    results = classify_ocr_with_density(file, ocr_json, threshold=0.03)
    text_handwritten = extract_handwritten_lines(results)
    return {
        "results": results,
        "text_handwritten": text_handwritten
    }
#=============================================OCR DENSITY=============================================


#=============================================META OCR - Nouvelle structure=============================================

#Related to import_page/ImportComponents/ExtractMeta/MetaDataInterface.ts
@app.post("/meta-ocr")
async def meta_ocr(
    file: UploadFile, 
    pdfInfos: str = Form("{}"), 
    clusterParams: str = Form("{}"), 
    doc_type: str = Form("inconnu"), 
    liste_nom_a_eviter: str = Form("[]"), 
    voir: bool = Form(False), 
    entreprise_id: str = Form(None),
    use_grid_detection: bool = Form(True), ## On utilise toujours la détéction de tableau et le layout -> voir avec viusalizing bounding box pour comprendre ce qu'il se passe
    force_ocr: bool = Form(False),
    force_image: bool = Form(False),
    run_large_word_review: bool = Form(True),
):
    
    global _pages_processed
    auto_force_ocr = False
    parse_vs_ocr_result = None
    ocr_extra_chars = 0
    
    gc.collect()
    start_time = time.time()
    memory_before = get_memory_usage()["rss_mb"]
    
    try:
        # Parse JSON parameters inline
        pdfInfos_dict = json.loads(pdfInfos) if pdfInfos else {"site_siret_plus": [], "provider": None}
        clusterParams_dict = json.loads(clusterParams) if clusterParams else {"data": {"params_mapping_site": {}, "params_mapping_presta": {}}}
        liste_nom_a_eviter_list = json.loads(liste_nom_a_eviter) if liste_nom_a_eviter else []
        
        # Extraction initiale légère pour détecter le type
        raw_text_initial, potential_json_initial, parse_or_ocr = await get_raw_text_from_pdf(file)
        
        # Détecter le type
        try:
            type_lu = await recognize_type_one_page_llm(raw_text_initial)
        except Exception:
            print("❌ Erreur dans recognize_type_one_page_llm -> fallback sans LLM")
            type_lu = recognize_type_one_page(raw_text_initial)["type"]
        
        if parse_or_ocr == "parse":
            try:
                parse_vs_ocr_result = await compare_parse_and_ocr(file, raw_text_initial)
                ocr_extra_chars = parse_vs_ocr_result["extra_chars"]
                auto_force_ocr = parse_vs_ocr_result["force_ocr"]
                print(f"🔎 Comparaison Parse vs OCR: +{ocr_extra_chars} caractères (seuil 30)")
                if auto_force_ocr:
                    print("⚠️ OCR apporte significativement plus de contenu -> bascule OCR forcée")
            except Exception as compare_error:
                auto_force_ocr = False
                parse_vs_ocr_result = None
                print(f"❌ Impossible de comparer Parse vs OCR: {compare_error}")
        
        # Décider si on a besoin de grid_detection
        # Skip grid_detection pour BON parsable (optimisation) sauf si OCR forcé
        needs_grid = use_grid_detection and not (parse_or_ocr == "parse" and type_lu == "bsd" and not auto_force_ocr)
        
        effective_force_ocr = force_ocr or auto_force_ocr

        precomputed_ocr_text = parse_vs_ocr_result["ocr_text"] if auto_force_ocr and parse_vs_ocr_result else None
        precomputed_ocr_json = parse_vs_ocr_result["ocr_json"] if auto_force_ocr and parse_vs_ocr_result else None

        if needs_grid:
            print("🔍 Grid detection activée (non-BSD ou OCR nécessaire)")
            # Réextraire avec grid_detection
            await file.seek(0)  # Reset file
            raw_text, potential_json_from_ocr, parse_or_ocr = await extract_text_with_grid_for_llm(
                file,
                force_ocr=effective_force_ocr,
                precomputed_ocr_text=precomputed_ocr_text,
                precomputed_ocr_json=precomputed_ocr_json,
            )
        else:
            print("⚡ Skip grid detection (BSD parsable - optimisation)")
            # Garder l'extraction initiale
            if auto_force_ocr and parse_vs_ocr_result is not None:
                raw_text = parse_vs_ocr_result["ocr_text"]
                potential_json_from_ocr = parse_vs_ocr_result["ocr_json"]
                parse_or_ocr = "ocr"
            else:
                raw_text, potential_json_from_ocr = raw_text_initial, potential_json_initial
        
        # Count pages for OCR model reset (estimate based on text length)
        estimated_pages = max(1, len(raw_text) // 2000)  # ~2000 chars per page
        _pages_processed += estimated_pages
        
        # Determine document type and alert status
        doc_type = (doc_type or "").strip()
        if not doc_type:
            doc_type = "inconnu"

        if doc_type in {"bon", "bsd", "facture"}:
            type_lu = doc_type
        alerte_type = type_lu != doc_type if doc_type != "bon" else False

        if voir:
            print("="*43, "Données brutes :", "\n", raw_text, "\n"*4)

        # Generate prompt
        prompt = get_specific_prompt(type_lu, liste_nom_a_eviter_list, parse_or_ocr)
        
        # RAG processing inline
        force_image_from_rag = False
        rag_example_id = None
        if entreprise_id and entreprise_id not in ("None", "") and entreprise_id.strip():
            try:
                rag_result = create_best_prompt_example(int(entreprise_id), type_lu, raw_text)
                prompt += rag_result["prompt"]
                rag_found_example = rag_result["found_example"]
                force_image_from_rag = rag_result.get("force_image", False)
                rag_example_id = rag_result.get("rag_example_id")
            except ValueError:
                print(f"❌ Erreur conversion entreprise_id: {entreprise_id}")
                rag_found_example = False
                rag_example_id = None
        else:
            rag_found_example = False
            rag_example_id = None
        
        print("🧠", "Extract data with Gemini (multi-page if needed)", "🧠")
        
        # Décision : Mode Image (vision) ou Mode Texte (OCR) ?
        # Conditions externalisées dans extract_image_gemini.py
        use_image, ocr_score, num_pages, reason = should_use_image_mode(
            potential_json_from_ocr, force_image, force_image_from_rag
        )
        log_image_mode_decision(use_image, ocr_score, num_pages, reason)
        
        if use_image:
            # MODE IMAGE : Envoyer directement l'image du PDF à Gemini (multimodal)
            # Utilisé si : score OCR < 85.7% OU force_image OU force_image_from_rag
            # Limitation : uniquement pour les PDFs d'une seule page
            await file.seek(0)
            gemini_response = await extract_gemini_with_images(file, prompt)
            gc.collect()  # Libérer mémoire après traitement image
        else:
            # MODE TEXTE : Extraction classique avec le texte OCR
            # Pour les documents multi-pages : découpage intelligent par pages avec sliding window
            # (voir extract_multi_page_gemini.py pour la logique de pagination)
            gemini_response = await extract_gemini_multi_page(raw_text, potential_json_from_ocr, prompt)
        
        success_flag = gemini_response.get('success', None) if isinstance(gemini_response, dict) else None
        print(f"🧠 Success: {success_flag if success_flag is not None else 'NO SUCCESS KEY'}")
        if success_flag is None:
            try:
                print(f"🧠 Response sans success: {json.dumps(gemini_response, ensure_ascii=False)[:800]}")
            except Exception:
                print(f"🧠 Response sans success (raw repr): {gemini_response}")
        #print(f"🧠 Extracted data (100 chars): {str(gemini_response.get('extracted_data', ''))[:100]}")
        
        if "error" in gemini_response:
            return {"error": gemini_response["error"]}
        
        # Process data inline
        try:
            extracted_data_str = gemini_response.get("extracted_data", "{}")
            #print(f"📝 Type de extracted_data: {type(extracted_data_str)}")
            gemini_data = json.loads(extracted_data_str)
            #print(f"✅ gemini_data parsé: {type(gemini_data)}, clés: {list(gemini_data.keys()) if isinstance(gemini_data, dict) else 'NOT A DICT'}")
            
            # Afficher le JSON complet formaté
            print("\n" + "="*80)
            print("📄 JSON COMPLET RENVOYÉ PAR GEMINI:")
            print("="*80)
            print(json.dumps(gemini_data, indent=2, ensure_ascii=False))
            print("="*80 + "\n")
            
        except Exception as e:
            print(f"❌ Erreur lors du parsing JSON: {e}")
            print(f"❌ extracted_data brut: {gemini_response.get('extracted_data', '')[:500]}")
            raise
        
        structured_response = structure(type_lu, gemini_data)
        
        # Calculate confidence inline
        default_confidence = {
            "brute": 100.0,
            "spec": 100.0,
            "handwritten": [0, False],
            "large_word_review_llm_can_understand": True,
            "large_word_review_reason": "Évaluation non nécessaire (parse).",
        }
        confidence = (
            get_confidence(gemini_data, potential_json_from_ocr)
            if parse_or_ocr == "ocr"
            else default_confidence.copy()
        )
        confidence.setdefault("large_word_review_llm_can_understand", True)
        confidence.setdefault("large_word_review_reason", "Évaluation non réalisée.")

        if parse_or_ocr == "ocr":
            confidence["handwritten"] = handwritten_confidence(file, potential_json_from_ocr)
            if run_large_word_review and not use_image:
                print("🔍 Review de la confidence par LLM")
                large_words = analyze_large_word_misreads(potential_json_from_ocr)
                need_review = (
                    large_words.get("misread_large_word_count", 0) > 0
                    and confidence.get("brute", 0) < 88
                )
                if need_review and large_words.get("suspect_words"):
                    review = await evaluate_large_word_legibility(
                        type_lu, large_words["suspect_words"]
                    )
                    confidence["large_word_review_llm_can_understand"] = review.get(
                        "llm_can_understand", True
                    )
                    confidence["large_word_review_reason"] = review.get(
                        "reason", "Analyse Gemini indisponible."
                    )
                    print("🔍 Review de la confidence par LLM : ", confidence["large_word_review_reason"])
                else:
                    confidence["large_word_review_reason"] = "OCR suffisamment fiable."
            elif use_image:
                confidence["large_word_review_reason"] = "Évaluation ignorée (mode image)."
            else:
                confidence["large_word_review_reason"] = "Évaluation désactivée."
        
        # Generate alerts inline
        alerte = alerte_function(alerte_type, confidence, structured_response, pdfInfos_dict, clusterParams_dict)
        if not rag_found_example:
            alerte = {"stop": True, "message": f"Il n'existe pas encore d'exemple rag pour ce type de document ({type_lu}). Veuillez d'abord traiter quelques documents de ce type avec le bouton RAG."}
        
        return {
            "structured_response": structured_response,
            "confidence": confidence,
            "alerte": alerte,
            "rag_example_id": rag_example_id,
        }

    except json.JSONDecodeError as e:
        return {"error": f"Invalid JSON format: {str(e)}"}
    except Exception as e:
        print(f"❌ ERREUR dans meta-ocr: {str(e)}")
        return {"error": f"Failed to process document: {str(e)}"}
    
    finally:
        # Log results
        processing_time = time.time() - start_time
        memory_after = get_memory_usage()["rss_mb"]
        print(f"------------Result Meta OCR")
        print(f"Méthode: {parse_or_ocr} | Type: {type_lu} | Temps: {processing_time//60:.0f}min {processing_time%60:.1f}s")
        print(f"Mémoire: {memory_before:.1f}MB → {memory_after:.1f}MB (Δ{memory_after-memory_before:.1f}MB)")
        print(f"Pages traitées: {_pages_processed}/{MAX_PAGES_BEFORE_RESET}")
        
        # Reset OCR model if needed
        reset_ocr_model_if_needed()
        
        await file.close()
        for _ in range(3):
            gc.collect()

#=============================================META OCR - Nouvelle structure Fin=============================================



@app.post("/detect-type")
async def detect_type(files: list[UploadFile]):
    results = []
    for file in files:
        raw_text, _, _ = await get_raw_text_from_pdf(file)
        results.append(recognize_type_one_page(raw_text))
    return results

#=============================================PUSH TO RAG=============================================
@app.post("/push_to_rag")
async def push_to_rag(file: UploadFile, pdf_id: str = Form(...), extracted_data: str = Form(...), document_type: str = Form("inconnu")):
    try:
        # Parser les données extraites
        extracted_data_dict = json.loads(extracted_data)
        
        print(f"📂 Fichier PDF reçu: {file.filename}")
        print(f"📂 PDF ID: {pdf_id}")
        print(f"📂 Type de document: {document_type}")
        print(f"📂 Données extraites: {extracted_data_dict}")
        
        # Importer et utiliser la fonction de traitement RAG
        from new.new_similarity.new_push_to_rag import process_document_for_rag
        
        # Traiter le document pour RAG
        result = await process_document_for_rag(
            file=file,
            pdf_id=pdf_id,
            extracted_data=extracted_data_dict,
            document_type=document_type
        )
        
        return result
        
    except Exception as e:
        print(f"❌ Erreur dans push_to_rag: {str(e)}")
        return {"error": f"Erreur lors du traitement: {str(e)}"}
#=============================================PUSH TO RAG=============================================


#=============================================VISUALIZE BOUNDING BOXES=============================================
@app.post("/visualize-bounding-boxes")
async def visualize_bounding_boxes_route(file: UploadFile, force_ocr: bool = Form(False)):
    """
    Crée trois images côte à côte pour visualiser l'OCR et la détection de tableau.
    
    Retourne une image PNG combinée avec :
    - Image 1 : Mots originaux OCR (rectangles verts)
    - Image 2 : Mots après fusion (rectangles bleus)
    - Image 3 : Tableau détecté avec grille (lignes rouges=colonnes, orange=lignes, violet=contour)
    """
    print("=" * 60)
    print(f"🎨 VISUALISATION BOUNDING BOXES: {file.filename}")
    
    try:
        # Créer une image par page (les trois vues combinées par page)
        from new.extract_text_layout_v2 import visualize_ocr_boxes_comparison_pages
        import io
        try:
            from PIL import Image, ImageDraw
        except Exception:
            # PIL est déjà une dépendance du projet (utilisée ailleurs)
            from PIL import Image, ImageDraw  # type: ignore

        images = await visualize_ocr_boxes_comparison_pages(file, force_ocr=force_ocr)

        if not images:
            return Response(status_code=204)

        # Si une seule page, retourner directement l'image comme avant
        if len(images) == 1:
            return Response(
                content=images[0],
                media_type="image/png",
                headers={
                    "Content-Disposition": f"inline; filename=bboxes_comparison_{file.filename}.png"
                }
            )

        # Sinon, combiner toutes les pages verticalement en une seule grande image PNG
        pil_images = [Image.open(io.BytesIO(b)) for b in images]
        widths = [im.width for im in pil_images]
        heights = [im.height for im in pil_images]
        margin = 40  # espace entre pages
        label_height = 30
        total_width = max(widths)
        total_height = sum(heights) + margin * (len(pil_images) - 1) + label_height * len(pil_images)

        combined = Image.new('RGB', (total_width, total_height), color='white')
        draw = ImageDraw.Draw(combined)

        y_offset = 0
        for idx, im in enumerate(pil_images):
            # Label de page
            label_text = f"Page {idx + 1}"
            draw.text((10, y_offset + 5), label_text, fill="black")
            y_offset += label_height

            # Centrer l'image si moins large que total_width
            x_offset = (total_width - im.width) // 2
            combined.paste(im, (x_offset, y_offset))
            y_offset += im.height
            if idx < len(pil_images) - 1:
                # Séparateur
                draw.line([(0, y_offset + margin // 2), (total_width, y_offset + margin // 2)], fill=(200, 200, 200), width=2)
                y_offset += margin

        out = io.BytesIO()
        combined.save(out, format='PNG')
        out.seek(0)

        return Response(
            content=out.getvalue(),
            media_type="image/png",
            headers={
                "Content-Disposition": f"inline; filename=bboxes_comparison_{file.filename}.png"
            }
        )
        
    except Exception as e:
        print(f"❌ Erreur lors de la visualisation: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": f"Erreur lors de la visualisation: {str(e)}"
        }
    
    finally:
        await file.close()
        print("=" * 60)

#=============================================VISUALIZE BOUNDING BOXES=============================================


@app.post("/highlight-large-ocr-words")
async def highlight_large_ocr_words_route(
    file: UploadFile,
    height_ratio_threshold: float = Form(0.01),
    confidence_threshold: float = Form(0.6),
    page_index: int = Form(0),
):
    """
    Génère une image PNG du PDF avec les mots volumineux encadrés.
    Vert: bonne lecture (confiance >= seuil). Rouge: mauvaise lecture.
    """
    print("=" * 60)
    print(f"🖼️ HIGHLIGHT LARGE OCR WORDS: {file.filename}")

    try:
        image_bytes = await render_large_word_confidence_preview(
            file,
            height_ratio_threshold=height_ratio_threshold,
            confidence_threshold=confidence_threshold,
            page_index=page_index,
        )

        return Response(
            content=image_bytes,
            media_type="image/png",
            headers={
                "Content-Disposition": f"inline; filename=large_words_{file.filename}_{page_index}.png"
            },
        )
    except ValueError as err:
        return {
            "success": False,
            "error": str(err),
        }
    except Exception as err:
        print(f"❌ Erreur highlight_large_ocr_words: {str(err)}")
        return {
            "success": False,
            "error": f"Erreur lors de la génération de l'image: {str(err)}",
        }
    finally:
        await file.close()
        print("=" * 60)


#=============================================EXTRACT TEXT WITH TABLE GRID=============================================
@app.post("/extract-text-with-grid")
async def extract_text_with_grid_route(file: UploadFile, force_ocr: bool = Form(False)):
    """
    Extrait le texte avec détection intelligente de tableaux et formatage avec grille.
    
    Retourne un texte prêt pour LLM avec :
    - Zones de tableau : formatées avec pipes "|" selon la grille détectée
    - Zones normales : formatées avec espacement proportionnel
    """
    print("=" * 60)
    print(f"📄 EXTRACTION TEXTE AVEC GRILLE: {file.filename}")
    
    start_time = time.time()
    
    try:        
        # Extraire le texte formaté pour LLM
        text_for_llm, json_ocr, method = await extract_text_with_grid_for_llm(file, force_ocr=force_ocr)
        
        processing_time = time.time() - start_time
        
        # Afficher le texte formaté
        print("\n" + "="*80)
        print("📄 TEXTE FINAL POUR LLM:")
        print("="*80)
        print(text_for_llm)
        print("="*80 + "\n")
        
        return {
            "success": True,
            "text_for_llm": text_for_llm,
            "json_ocr": json_ocr,
            "method": method,
            "metadata": {
                "processing_time": processing_time,
                "text_length": len(text_for_llm)
            }
        }
        
    except Exception as e:
        print(f"❌ Erreur lors de l'extraction: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": f"Erreur lors de l'extraction: {str(e)}"
        }
    
    finally:
        await file.close()
        gc.collect()
        print("=" * 60)

#=============================================EXTRACT TEXT WITH TABLE GRID=============================================


#=============================================SMART SPLIT=============================================
@app.post("/smart-split")
async def smart_split(file: UploadFile, check_logique: bool = Form(True)):
    """
    Smart Split - Division intelligente de PDFs multi-pages
    Détecte automatiquement les segments et leurs types (facture, bon, bsd, autre)
    
    Args:
        file: Fichier PDF à analyser
        check_logique: Si True, vérifie la cohérence avec la règle logique de reconnaissance de type
    
    Returns:
        {
            "success": bool,
            "segments": [{"type": "facture", "pages": [0, 1]}, ...],
            "metadata": {
                "processing_time": float,
                "total_pages": int,
                "check_logique_enabled": bool,
                "alerts": [...]  # Si incohérences détectées
            }
        }
    """
    print("=" * 60)
    print(f"🧠 SMART SPLIT: {file.filename}")
    
    try:
        from new.new_smart_split import smart_split_pdf
        
        result = await smart_split_pdf(file, check_logique=check_logique)
        
        # Log compact
        if result.get("success"):
            meta = result.get("metadata", {})
            segs = result.get("segments", [])
            alerts = meta.get('alerts', [])
            print(f"✅ {len(segs)} segment(s) | {meta.get('processing_time', 0):.2f}s | {len(alerts)} alerte(s)")
            for idx, seg in enumerate(segs):
                print(f"   #{idx + 1}: {seg.get('type')} {seg.get('pages')}")
        else:
            print(f"❌ {result.get('error', 'Erreur')}")
        
        return result
        
    except Exception as e:
        print(f"❌ {str(e)}")
        return {
            "success": False,
            "error": f"Erreur: {str(e)}",
            "metadata": {"processing_time": 0, "check_logique_enabled": check_logique}
        }
    finally:
        await file.close()
        gc.collect()
        print("=" * 60)
#=============================================SMART SPLIT=============================================


#=============================================ANALYZE PARSE VS OCR=============================================
@app.post("/analyze-parse-vs-ocr")
async def analyze_parse_vs_ocr(file: UploadFile):
    """
    Analyse un PDF en Parse ET OCR pour détecter s'il est hybride.
    
    Retourne une image avec 3 vues :
    1. PDF avec bounding boxes du texte PARSABLE (vert)
    2. PDF avec bounding boxes du texte OCÉRISÉ (bleu)
    3. Résumé textuel + verdict OUI/NON si hybride
    
    Un PDF hybride = mix de texte natif parsable + zones scannées nécessitant OCR
    """
    print("=" * 60)
    print(f"🔬 ANALYSE PARSE VS OCR: {file.filename}")
    
    try:
        import io
        import tempfile
        import fitz  # PyMuPDF
        from PIL import Image, ImageDraw, ImageFont
        
        # Sauvegarder le PDF temporairement
        contents = await file.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(contents)
            tmp_path = tmp.name
        
        # === 1. PARSE : Extraire les bounding boxes du texte natif avec PyMuPDF ===
        print("📖 Extraction PARSE (texte natif avec PyMuPDF)...")
        parse_boxes = []
        parse_text = ""
        parse_chars_count = 0
        
        # Ouvrir avec PyMuPDF pour l'extraction
        pdf_doc = fitz.open(tmp_path)
        page_fitz = pdf_doc[0]  # Première page
        
        # Extraire le texte avec coordonnées
        text_dict = page_fitz.get_text("dict")
        parse_page_width = page_fitz.rect.width
        parse_page_height = page_fitz.rect.height
        
        # Parcourir les blocs, lignes et spans pour extraire les caractères
        for block in text_dict.get("blocks", []):
            if block.get("type") == 0:  # Type texte (pas image)
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        # Récupérer les bounding box du span (groupe de caractères)
                        bbox = span.get("bbox")  # (x0, y0, x1, y1)
                        text = span.get("text", "")
                        
                        if bbox and text and text.strip():  # Ignorer les espaces vides
                            # Calculer la taille de la box
                            width = bbox[2] - bbox[0]
                            height = bbox[3] - bbox[1]
                            
                            # Filtrer les boxes trop petites (probablement des artefacts)
                            if width > 2 and height > 2:  # Au moins 2 points de large/haut
                                parse_boxes.append({
                                    'x0': bbox[0],
                                    'y0': bbox[1],
                                    'x1': bbox[2],
                                    'y1': bbox[3],
                                    'text': text
                                })
                                parse_text += text
                                parse_chars_count += len(text)
        
        print(f"   ✅ Parse: {parse_chars_count} caractères, {len(parse_text)} chars de texte")
        print(f"   📐 Dimensions page PyMuPDF: {parse_page_width}x{parse_page_height} points")
        
        # === 2. OCR : Extraire les bounding boxes du texte OCRisé ===
        print("🔍 Extraction OCR (DocTR)...")
        await file.seek(0)
        ocr_result = await ocr_this_pdf_with_doctr(file)
        ocr_text = ocr_result["text"]
        raw_ocr = ocr_result["raw_result"]
        
        ocr_boxes = []
        ocr_words_count = 0
        
        # Extraire les bounding boxes depuis le résultat DocTR
        if raw_ocr and "pages" in raw_ocr and len(raw_ocr["pages"]) > 0:
            page_data = raw_ocr["pages"][0]
            page_height = page_data["dimensions"][0]
            page_width = page_data["dimensions"][1]
            
            for block in page_data["blocks"]:
                for line in block["lines"]:
                    for word in line["words"]:
                        # Coordonnées normalisées (0-1) → pixels
                        geom = word["geometry"]
                        x0 = geom[0][0] * page_width
                        y0 = geom[0][1] * page_height
                        x1 = geom[1][0] * page_width
                        y1 = geom[1][1] * page_height
                        
                        ocr_boxes.append({
                            'x0': x0,
                            'y0': y0,
                            'x1': x1,
                            'y1': y1,
                            'text': word["value"],
                            'confidence': word.get("confidence", 0)
                        })
                        ocr_words_count += 1
        
        print(f"   ✅ OCR: {ocr_words_count} mots, {len(ocr_text)} chars de texte")
        
        # === 3. COMPARAISON : Détecter si hybride ===
        print("🧮 Analyse et comparaison...")
        
        # Critères pour déterminer si hybride
        parse_has_content = parse_chars_count > 50  # Au moins 50 caractères parsables
        ocr_chars = len(ocr_text.strip())
        parse_chars = len(parse_text.strip())
        extra_chars = max(0, ocr_chars - parse_chars)
        ocr_has_more_content = extra_chars > 30  # OCR trouve plus de 30 caractères supplémentaires
        
        # Si Parse trouve peu/rien mais OCR trouve beaucoup = PDF scanné pur
        # Si Parse trouve beaucoup et OCR aussi avec différences = hybride
        is_hybrid = parse_has_content and ocr_has_more_content
        
        # Calculer similarité textuelle (approximative)
        parse_clean = parse_text.strip().lower()[:500]
        ocr_clean = ocr_text.strip().lower()[:500]
        similarity = sum(c1 == c2 for c1, c2 in zip(parse_clean, ocr_clean)) / max(len(parse_clean), len(ocr_clean), 1) * 100
        
        parse_loses_info = extra_chars > 30
        force_ocr_needed = False
        force_ocr_overkill = False
        
        if not parse_has_content:
            verdict_label = "PDF SCANNÉ (OCR uniquement)"
            verdict_reason = "Aucun texte natif fiable n'a été trouvé, seul l'OCR fournit du contenu exploitable."
            parse_loses_info = True
            force_ocr_needed = True
        elif parse_has_content and not ocr_has_more_content and parse_chars_count > 100:
            verdict_label = "PDF TEXTE NATIF"
            verdict_reason = "Le parsing texte restitue déjà toutes les informations, l'OCR n'ajoute rien de significatif."
            force_ocr_overkill = True
        elif is_hybrid:
            verdict_label = "PDF HYBRIDE"
            verdict_reason = "Présence de texte natif, mais l'OCR récupère au moins 30 caractères supplémentaires (zones scannées)."
            parse_loses_info = extra_chars > 30
            force_ocr_needed = True
        else:
            verdict_label = "PDF MIXTE (différences faibles)"
            verdict_reason = "Les deux méthodes donnent des volumes proches. Quelques variations existent mais restent limitées."
            parse_loses_info = ocr_has_more_content
            force_ocr_needed = parse_loses_info
            force_ocr_overkill = not parse_loses_info
        
        verdict = f"{verdict_label} - {verdict_reason}"
        
        print(f"   📊 Verdict: {verdict_label}")
        print(f"   📊 Similarité texte: {similarity:.1f}%")
        
        # === 4. CRÉATION IMAGE COMPOSITE ===
        print("🎨 Création de l'image composite...")
        
        # Convertir en image (150 DPI pour performance)
        # On réutilise page_fitz et pdf_doc déjà ouverts
        zoom = 150 / 72  # 72 DPI par défaut, on veut 150 DPI
        mat = fitz.Matrix(zoom, zoom)
        pix = page_fitz.get_pixmap(matrix=mat)
        
        # Convertir pixmap en PIL Image
        img_data = pix.tobytes("png")
        base_image = Image.open(io.BytesIO(img_data))
        img_width, img_height = base_image.size
        
        # Créer 3 copies de l'image
        img_parse = base_image.copy()
        img_ocr = base_image.copy()
        img_summary = Image.new('RGB', (img_width, img_height), color='white')
        
        # Dessiner bounding boxes PARSE (vert)
        # PyMuPDF et l'image utilisent le même référentiel, on applique juste le zoom
        draw_parse = ImageDraw.Draw(img_parse)
        for box in parse_boxes[:500]:  # Limiter pour performance
            # Les coordonnées PyMuPDF sont en points, on applique le zoom
            x0 = box['x0'] * zoom
            y0 = box['y0'] * zoom
            x1 = box['x1'] * zoom
            y1 = box['y1'] * zoom
            coords = [(x0, y0), (x1, y1)]
            draw_parse.rectangle(coords, outline='green', width=2)
        
        # Dessiner bounding boxes OCR (bleu)
        # Les coordonnées OCR sont déjà converties en pixels de l'image
        draw_ocr = ImageDraw.Draw(img_ocr)
        for box in ocr_boxes:
            # Recalculer avec les dimensions de l'image réelle
            x0 = (box['x0'] / page_width) * img_width
            y0 = (box['y0'] / page_height) * img_height
            x1 = (box['x1'] / page_width) * img_width
            y1 = (box['y1'] / page_height) * img_height
            coords = [(x0, y0), (x1, y1)]
            draw_ocr.rectangle(coords, outline='blue', width=2)
        
        # Dessiner résumé textuel
        draw_summary = ImageDraw.Draw(img_summary)
        try:
            font_title = ImageFont.truetype("arial.ttf", 32)
            font_text = ImageFont.truetype("arial.ttf", 20)
        except:
            font_title = ImageFont.load_default()
            font_text = ImageFont.load_default()
        
        # Texte du résumé
        y_pos = 50
        draw_summary.text((20, y_pos), "📊 ANALYSE PARSE VS OCR", fill='black', font=font_title)
        y_pos += 80
        
        summary_lines = [
            f"Fichier: {file.filename}",
            "",
            "🟢 PARSE (Texte natif):",
            f"  • Caractères: {parse_chars_count}",
            f"  • Longueur texte: {len(parse_text)} chars",
            "",
            "🔵 OCR (DocTR):",
            f"  • Mots détectés: {ocr_words_count}",
            f"  • Longueur texte: {len(ocr_text)} chars",
            "",
            "📈 COMPARAISON:",
            f"  • Similarité: {similarity:.1f}%",
            f"  • Différence: {extra_chars} chars (OCR vs Parse)",
            "",
            "🔍 VERDICT:",
            f"  • Type: {verdict_label}",
            f"  • Raison: {verdict_reason}",
            "",
            "⚖️ DÉCISION PARSABLE VS OCR:",
            f"  • Perte si PARSE seul ? {'OUI' if parse_loses_info else 'NON'}",
            f"  • Faut-il forcer OCR ? {'OUI' if force_ocr_needed else 'NON'}",
            f"  • OCR superflu ? {'OUI' if force_ocr_overkill else 'NON'}",
        ]
        
        for line in summary_lines:
            draw_summary.text((20, y_pos), line, fill='black', font=font_text)
            y_pos += 35
        
        # Combiner les 3 images côte à côte
        margin = 20
        total_width = img_width * 3 + margin * 4
        total_height = img_height + margin * 2
        
        combined = Image.new('RGB', (total_width, total_height), color='lightgray')
        
        # Labels
        draw_combined = ImageDraw.Draw(combined)
        labels = ["1. PARSE (texte natif)", "2. OCR (DocTR)", "3. RÉSUMÉ"]
        x_positions = [margin, img_width + margin * 2, img_width * 2 + margin * 3]
        
        for i, (label, x_pos) in enumerate(zip(labels, x_positions)):
            draw_combined.text((x_pos + 10, 5), label, fill='black', font=font_text)
        
        # Coller les images
        combined.paste(img_parse, (margin, margin))
        combined.paste(img_ocr, (img_width + margin * 2, margin))
        combined.paste(img_summary, (img_width * 2 + margin * 3, margin))
        
        # Convertir en bytes
        out = io.BytesIO()
        combined.save(out, format='PNG')
        out.seek(0)
        
        # Nettoyage
        pdf_doc.close()
        os.unlink(tmp_path)
        gc.collect()
        
        print(f"✅ Image composite créée: {total_width}x{total_height}px")
        print("=" * 60)
        
        return Response(
            content=out.getvalue(),
            media_type="image/png",
            headers={
                "Content-Disposition": f"inline; filename=parse_vs_ocr_{file.filename}.png"
            }
        )
        
    except Exception as e:
        print(f"❌ Erreur lors de l'analyse: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": f"Erreur lors de l'analyse: {str(e)}"
        }
    
    finally:
        await file.close()
        gc.collect()
        print("=" * 60)

#=============================================ANALYZE PARSE VS OCR=============================================


