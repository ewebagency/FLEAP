from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from extract_text_from_pdf import extract_text, extract_text_only
from utils import compta_lines_from_text, header_from_text
from extract_info_xlsx_autocompletion.lecture_excel_autocompletion import data_from_excel
from extract_info_from_text import extract_all_info
from typing import Optional

app = FastAPI()

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
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # Permet toutes les méthodes HTTP
    allow_headers=["*"],  # Permet tous les headers
    expose_headers=["*"]  # Expose tous les headers dans la réponse
)


@app.post("/treat-pdf/")
async def treat_pdf(file: UploadFile = File(...)):
    # Appelle la fonction extract_text et retourne le résultat
    result = await extract_text(file)
    text = result["text"]
    
    # Extraction des informations du texte
    extracted_info = extract_all_info(text)
    compta_lines = compta_lines_from_text(text)
    header = header_from_text(text)
    
    return {
        'compta_lines': compta_lines,
        'header': header,
        'extracted_info': extracted_info
    }


@app.post("/extract-text-only/")
async def extract_text_only_endpoint(file: UploadFile = File(...)):
    result = await extract_text_only(file)
    text = result["text"]
    method = result["method"]
    
    # Extraction des informations supplémentaires si le texte a été extrait avec succès
    extracted_info = {}
    if text != "Impossible":
        extracted_info = extract_all_info(text)
    
    print(f'Texte extrait avec la méthode : {method}')
    print('Contenu extrait :', text)
    
    return {
        'text': text, 
        'method': method,
        'extracted_info': extracted_info
    }


@app.get("/get-table-demande-collecte/")
async def get_table_demande_collecte(
                                    userId: Optional[str] = None,
                                    site: Optional[str] = None,
                                    filiere: Optional[str] = None,
                                    dechet: Optional[str] = None):
    return data_from_excel(userId, site, filiere, dechet)
