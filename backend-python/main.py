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


import json
import psutil
import os
import gc

from utils.utils_enrich import enrich_text
from utils.document_types import get_prompt, transform_document_data
from utils.utils_doctr import ocr_this_pdf_with_doctr, cleanup_model, initialize_model
from utils.utils_manuscrit import classify_ocr_with_density, extract_handwritten_lines

from new.new_prompts import get_specific_prompt
from new.new_extract_raw import get_raw_text_from_pdf
from new.new_confidence import get_confidence, handwritten_confidence
from new.new_structure import structure
from new.new_recognize_type import recognize_type_one_page
from new.new_alerte import alerte_function
from new.new_similarity.new_find_best_proxy import create_best_prompt_example
import time




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
    # Nettoyer le pool de subprocess OCR
    from utils.subprocess_ocr import cleanup_executor
    cleanup_executor()
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
    print("=" * 60)
    print("🚀 DÉBUT EXTRACTION OCR AVEC DOCTR")
    
    # Mémoire avant traitement
    #print_memory_usage("AVANT TRAITEMENT")
    
    try:
        #print("📄 Début de l'extraction OCR...")
        result = await ocr_this_pdf_with_doctr(file)
        
        # Mémoire après OCR
        #print_memory_usage("APRÈS OCR")
        
        text = result["text"]
        print(f"📝 Texte extrait: {len(text)} caractères")
        
        # Nettoyage mémoire
        gc.collect()
        #print_memory_usage("APRÈS NETTOYAGE")
        
        # Calcul de l'utilisation mémoire
        memory = get_memory_usage()
        memory_usage_mb = memory['rss_mb']
        
        print(f"📊 UTILISATION MÉMOIRE FINALE: {memory_usage_mb:.1f}MB")
        print("=" * 60)
        if memory_usage_mb > 502:
            #print(f"⚠️  ATTENTION: Mémoire proche de la limite (502MB) - {memory_usage_mb:.1f}MB utilisés")
            pass
        else:
            #print(f"✅ Mémoire dans les limites: {memory_usage_mb:.1f}MB / 502MB")
            pass
        
        #print("=" * 60)
        #print("✅ EXTRACTION TERMINÉE")
        #print("=" * 60)
        
        return result
        
    except Exception as e:
        print(f"❌ ERREUR lors de l'extraction: {str(e)}")
        print_memory_usage("EN CAS D'ERREUR")
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
async def meta_ocr(file: UploadFile, pdfInfos: str = Form("{}"), clusterParams: str = Form("{}"), doc_type: str = Form("inconnu"), liste_nom_a_eviter: str = Form("[]"), voir: bool = Form(False), entreprise_id: str = Form(None)):
    
    # Nettoyage préventif
    gc.collect()
    start = time.time()
    memory_before = get_memory_usage()["rss_mb"]
    # Parser les paramètres JSON
    try:
        pdfInfos_dict = json.loads(pdfInfos) if pdfInfos else {"site_siret_plus": [], "provider": None}
        clusterParams_dict = json.loads(clusterParams) if clusterParams else {"data": {"params_mapping_site": {}, "params_mapping_presta": {}}}
        liste_nom_a_eviter_list = json.loads(liste_nom_a_eviter) if liste_nom_a_eviter else []
    except json.JSONDecodeError as e:
        return {"error": f"Invalid JSON format: {str(e)}"}
    
    ############### Extraction initiale + Détection du type ###############
    print(f"[{time.strftime('%H:%M:%S')}] META_OCR_START: Début extraction initiale", flush=True)
    raw_text_first, potential_json_from_ocr_first, parse_or_ocr_first = await get_raw_text_from_pdf(file, 'inconnu')
    print(f"[{time.strftime('%H:%M:%S')}] META_OCR_EXTRACT_DONE: Extraction terminée - méthode: {parse_or_ocr_first}", flush=True)
    print(f"[{time.strftime('%H:%M:%S')}] META_OCR_TYPE_START: Détection du type", flush=True)
    type_lu = recognize_type_one_page(raw_text_first)["type"]
    print(f"[{time.strftime('%H:%M:%S')}] META_OCR_TYPE_DONE: Type détecté: {type_lu}", flush=True)
    
    if doc_type == "inconnu":
        #doc_type = detect_type(file)
        doc_type = "bsd"
        alerte_type = False
    else:
        if type_lu != doc_type:
            alerte_type = True
        else:
            alerte_type = False
    #########################################################

    # Deuxième extraction dépendant du type détecté (conservée), mais avec nettoyage renforcé
    try:
        print(f"[{time.strftime('%H:%M:%S')}] META_OCR_EXTRACT2_START: Deuxième extraction", flush=True)
        # Réinitialiser le fichier pour une nouvelle lecture propre
        await file.seek(0)
        raw_text, potential_json_from_ocr, parse_or_ocr = await get_raw_text_from_pdf(file, type_lu)
        print(f"[{time.strftime('%H:%M:%S')}] META_OCR_EXTRACT2_DONE: Deuxième extraction terminée - méthode: {parse_or_ocr}", flush=True)

        if voir:
            print( "="*(43),"Données brutes : ", "\n", raw_text, "\n"*4)

        prompt = get_specific_prompt(type_lu, liste_nom_a_eviter_list, parse_or_ocr)
        
        # Générer un prompt d'exemple RAG basé sur des documents similaires
        do_rag = True
        if do_rag:
            print(f"🔍 Debug entreprise_id reçu: '{entreprise_id}' (type: {type(entreprise_id)})")
            rag_prompt = ""
            rag_found_example = True
            
            if entreprise_id and entreprise_id != "None" and entreprise_id.strip():
                try:
                    entreprise_id_int = int(entreprise_id)
                    rag_result = create_best_prompt_example(entreprise_id_int, type_lu, raw_text)
                    rag_prompt = rag_result["prompt"]
                    rag_found_example = rag_result["found_example"]
                    #print("🔍 RAG Prompt Example:", rag_prompt)
                    #print("🔍 RAG Found Example:", rag_found_example)
                except ValueError as e:
                    print(f"❌ Erreur conversion entreprise_id en int: {e}")
            else:
                print("⚠️ Pas d'entreprise_id fourni, impossible de générer un exemple RAG")
        else:
            rag_prompt = ""
            rag_found_example = False
        
        print(f"[{time.strftime('%H:%M:%S')}] META_OCR_GEMINI_START: Appel Gemini", flush=True)
        gemini_response = await extract_gemini(raw_text, prompt + rag_prompt)
        print(f"[{time.strftime('%H:%M:%S')}] META_OCR_GEMINI_DONE: Gemini terminé", flush=True)
        
        if "error" in gemini_response:
            print(f"[{time.strftime('%H:%M:%S')}] META_OCR_GEMINI_ERROR: {gemini_response['error']}", flush=True)
            return {"error": gemini_response["error"]}
        
        print(f"[{time.strftime('%H:%M:%S')}] META_OCR_STRUCTURE_START: Structuration des données", flush=True)
        gemini_data = json.loads(gemini_response.get("extracted_data", "{}"))
        structured_response = structure(type_lu, gemini_data)
        print(f"[{time.strftime('%H:%M:%S')}] META_OCR_STRUCTURE_DONE: Structuration terminée", flush=True)
        
        if parse_or_ocr == "ocr":
            confidence = get_confidence(gemini_data, potential_json_from_ocr)
            confidence["handwritten"] = handwritten_confidence(file, potential_json_from_ocr)
        else:
            confidence =  { "brute": 100, "spec": 100, "handwritten": [0, False] }
        
        alerte = alerte_function(alerte_type, confidence, structured_response, pdfInfos_dict, clusterParams_dict)
        
        # Ajouter une alerte si aucun exemple RAG n'a été trouvé
        prevent_from_not_rag = True
        if not rag_found_example and prevent_from_not_rag and do_rag:
            alerte = {
                "stop": True,
                "message": f"Il n'existe pas encore d'exemple pour ce type de document ({type_lu}). Veuillez d'abord traiter quelques documents de ce type avec le bouton RAG."
            }

    except Exception as e:
        print(f"❌ ERREUR dans meta-ocr: {str(e)}")
        return {"error": f"Failed to process document: {str(e)}"}
    
    dt = time.time() - start
    memory_after = get_memory_usage()["rss_mb"]
    memory_delta = memory_after - memory_before
    print("\n\n------------Result Meta OCR")
    print("\nMéthode utilisée : ", parse_or_ocr)
    print("Type détecté : ", type_lu)
    print("Temps : ", dt//60, "min", dt%60, "s")
    print(f"Mémoire: avant={memory_before:.1f}MB, après={memory_after:.1f}MB, delta={memory_delta:.1f}MB")
    print("Confidence : ", confidence)
    print("Alerte : ", alerte)
    print("Response : ", structured_response)
    print("\n"*2)
    response_payload = {
        "structured_response": structured_response,
        "confidence": confidence,  
        "alerte" : alerte
    }
    try:
        return response_payload
    finally:
        # Fermer explicitement le fichier uploadé (au plus tôt)
        try:
            await file.close()
        except Exception:
            pass
        # Mesure mémoire avant GC
        memory_before_gc = get_memory_usage()["rss_mb"]
        # Libérer les grosses variables locales (assignation à None)
        try:
            raw_text_first = None
        except Exception:
            pass
        try:
            potential_json_from_ocr_first = None; parse_or_ocr_first = None
        except Exception:
            pass
        try:
            raw_text = None; potential_json_from_ocr = None; parse_or_ocr = None
        except Exception:
            pass
        try:
            gemini_response = None; gemini_data = None; structured_response = None
        except Exception:
            pass
        try:
            confidence = None; alerte = None; response_payload = None; prompt = None
        except Exception:
            pass
        try:
            pdfInfos_dict = None; clusterParams_dict = None; liste_nom_a_eviter_list = None
        except Exception:
            pass
        try:
            type_lu = None; alerte_type = None
        except Exception:
            pass
        try:
            start = None; dt = None; memory_before = None; memory_after = None; memory_delta = None
        except Exception:
            pass
        # Nettoyage mémoire post-traitement
        gc.collect()
        memory_after_gc = get_memory_usage()["rss_mb"]
        freed_gc = max(0.0, memory_before_gc - memory_after_gc)
        print(f"Mémoire après GC: {memory_after_gc:.1f}MB (libéré ~{freed_gc:.1f}MB)")

#=============================================META OCR - Nouvelle structure Fin=============================================



@app.post("/detect-type")
async def detect_type(files: list[UploadFile]):
    results = []
    for file in files:
        raw_text, _, _ = await get_raw_text_from_pdf(file, "inconnu")
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
