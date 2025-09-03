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

"""
import json
import psutil
import os
import gc
"""
"""
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
import time
"""


"""
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
"""

load_dotenv()

app = FastAPI()

"""
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
"""


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
    json_from_gemini = extract_gemini(parsed_pdf, prompt_bsd)
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




"""
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
async def meta_ocr(file: UploadFile, pdfInfos: str = Form("{}"), clusterParams: str = Form("{}"), type: str = Form("inconnu"), liste_nom_a_eviter: str = Form("[]"), voir: bool = Form(False)):
    
    start = time.time()
    # Parser les paramètres JSON
    try:
        pdfInfos_dict = json.loads(pdfInfos) if pdfInfos else {"site_siret_plus": [], "provider": None}
        clusterParams_dict = json.loads(clusterParams) if clusterParams else {"data": {"params_mapping_site": {}, "params_mapping_presta": {}}}
        liste_nom_a_eviter_list = json.loads(liste_nom_a_eviter) if liste_nom_a_eviter else []
    except json.JSONDecodeError as e:
        return {"error": f"Invalid JSON format: {str(e)}"}
    
    ############### Détection du type à l'avance ###############
    raw_text_first, _, _ = await get_raw_text_from_pdf(file, 'inconnu')
    type_lu = recognize_type_one_page(raw_text_first)["type"]
    
    if type == "inconnu":
        #type = detect_type(file)
        type = "bsd"
        alerte_type = False
    else:
        if type_lu != type:
            alerte_type = True
        else:
            alerte_type = False
    #########################################################


    # Reset file position to ensure it can be read properly
    await file.seek(0)
    
    try:
        raw_text, potential_json_from_ocr, parse_or_ocr = await get_raw_text_from_pdf(file, type_lu) #ATTENTION TYPE LU OU NON LU ???
        if voir:
            print( "="*(43),"Données brutes : ", "\n", raw_text, "\n"*4)

        prompt = get_specific_prompt(type_lu, liste_nom_a_eviter_list, parse_or_ocr) #prompt, json_interface
        
        gemini_response = await extract_gemini(raw_text, prompt) #gemini_data = json
        
        # Check if Gemini returned an error
        if "error" in gemini_response:
            return {"error": gemini_response["error"]}
        
        gemini_data = json.loads(gemini_response.get("extracted_data", "{}"))
        
        structured_response = structure(type_lu, gemini_data)
        
        if parse_or_ocr == "ocr":
            confidence = get_confidence(gemini_data, potential_json_from_ocr)
            confidence["handwritten"] = handwritten_confidence(file, potential_json_from_ocr)
        else:
            confidence =  { "brute": 100, "spec": 100, "handwritten": [0, False] }
        
        #print("\n"*4, "RECOGNIZE TYPE \n", "-"*50, recognize_type_one_page(raw_text), "-"*50, "\n"*4)
        alerte = alerte_function(alerte_type, confidence, structured_response, pdfInfos_dict, clusterParams_dict)

    except Exception as e:
        print(f"❌ ERREUR dans meta-ocr: {str(e)}")
        return {"error": f"Failed to process document: {str(e)}"}
    
    dt = time.time() - start
    print("\n\n------------Result Meta OCR")
    print("\nMéthode utilisée : ", parse_or_ocr)
    print("Type détecté : ", type_lu)
    print("Temps : ", dt//60, "min", dt%60, "s")
    print("Confidence : ", confidence)
    print("Alerte : ", alerte)
    print("Response : ", structured_response)
    print("\n"*2)
    return {
        "structured_response": structured_response,
        "confidence": confidence,  
        "alerte" : alerte
    }

#=============================================META OCR - Nouvelle structure Fin=============================================



@app.post("/detect-type")
async def detect_type(files: list[UploadFile]):
    results = []
    for file in files:
        raw_text, _, _ = await get_raw_text_from_pdf(file, "inconnu")
        results.append(recognize_type_one_page(raw_text))
    return results

"""