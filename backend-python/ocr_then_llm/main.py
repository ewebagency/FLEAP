from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from .utils import process_pdf_with_llm
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# Configuration CORS
ALLOWED_ORIGINS = os.getenv("NEXT_PUBLIC_APP_URL")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En production, spécifiez les origines autorisées
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/process-pdf")
async def process_pdf(pdf_file: UploadFile = File(...)):
    """
    Endpoint pour traiter un PDF et extraire les informations structurées
    """
    result = process_pdf_with_llm(pdf_file)
    return result

@app.get("/health")
async def health_check():
    """
    Endpoint pour vérifier que l'API est en ligne
    """
    return {"status": "ok tout va bien"}
