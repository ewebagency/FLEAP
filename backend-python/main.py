from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from extract_text_from_pdf import extract_text
from utils import compta_lines_from_text, header_from_text

app = FastAPI()

# Configurer CORS pour autoriser les requêtes du frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Remplace par l'URL de ton frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/treat-pdf/")
async def treat_pdf(file: UploadFile = File(...)):
    # Appelle la fonction extract_text et retourne le résultat
    result = await extract_text(file)
    text = result["text"]
    #infos_json = await extract_infos_json_from_text(text)
    compta_lines = compta_lines_from_text(text)
    header = header_from_text(text)
    #return {'header':header, 'compta_lines':compta_lines}
    return {'compta_lines':compta_lines}
