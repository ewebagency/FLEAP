import subprocess
import openai
import os
from typing import Dict, Any
import tempfile
from fastapi import HTTPException
import hashlib
import json
import shutil
import requests
import time
from datetime import datetime

# Cache directory for storing converted PDFs
CACHE_DIR = "cache"
os.makedirs(CACHE_DIR, exist_ok=True)

# Input and output directories for marker
INPUT_DIR = "input_pdfs"
OUTPUT_DIR = "output_markdown"
os.makedirs(INPUT_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

def get_pdf_hash(pdf_content: bytes) -> str:
    """Generate a unique hash for the PDF content"""
    return hashlib.md5(pdf_content).hexdigest()

def get_cached_markdown(pdf_hash: str) -> str:
    """Get markdown from cache if it exists"""
    cache_file = os.path.join(CACHE_DIR, f"{pdf_hash}.md")
    if os.path.exists(cache_file):
        with open(cache_file, 'r', encoding='utf-8') as f:
            return f.read()
    return None

def save_to_cache(pdf_hash: str, markdown: str):
    """Save markdown to cache"""
    cache_file = os.path.join(CACHE_DIR, f"{pdf_hash}.md")
    with open(cache_file, 'w', encoding='utf-8') as f:
        f.write(markdown)

def convert_pdf_to_markdown(pdf_file) -> str:
    """
    Convert a PDF file to markdown using marker with caching
    """
    try:
        # Read PDF content
        pdf_content = pdf_file.file.read()
        
        # Generate hash for the PDF
        pdf_hash = get_pdf_hash(pdf_content)
        
        # Check cache first
        cached_markdown = get_cached_markdown(pdf_hash)
        if cached_markdown:
            print("✅ Using cached markdown")
            return cached_markdown
            
        print("🔄 Converting PDF to markdown (this may take a while)...")
        
        # Save the PDF to input directory
        input_pdf = os.path.join(INPUT_DIR, "input.pdf")
        with open(input_pdf, 'wb') as f:
            f.write(pdf_content)
        
        print(f"Running marker command on directory: {INPUT_DIR}")
        timestamp = time.time()
        readable_time = datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S')
        print(f"Current timestamp: {readable_time}")
        # Run marker command with additional options
        result = subprocess.run(
            [
                "marker",
                INPUT_DIR,
                "--output_dir", OUTPUT_DIR,
                "--output_format", "markdown",
                "--languages", "fr",
                #"--force_ocr",
                "--disable_image_extraction",
            ],
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            print(f"Marker error: {result.stderr}")
            raise Exception(f"Erreur lors de la conversion: {result.stderr}")
        
        # Wait a moment to ensure the file is written
        time.sleep(1)
        
        # Read the generated markdown file
        markdown_path = os.path.join(OUTPUT_DIR, "input", "input.md")
        print(f"Reading markdown from: {markdown_path}")
        
        # Check if file exists
        if not os.path.exists(markdown_path):
            print(f"Files in output directory: {os.listdir(OUTPUT_DIR)}")
            if os.path.exists(os.path.join(OUTPUT_DIR, "input")):
                print(f"Files in input subdirectory: {os.listdir(os.path.join(OUTPUT_DIR, 'input'))}")
            raise Exception(f"Markdown file not found at {markdown_path}")
            
        with open(markdown_path, 'r', encoding='utf-8') as f:
            markdown = f.read()
        
        # Save to cache
        save_to_cache(pdf_hash, markdown)
        print("✅ PDF converted and cached")
        
        return markdown
            
    except Exception as e:
        print(f"Error in convert_pdf_to_markdown: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la conversion en markdown: {str(e)}")

def extract_invoice_info_from_markdown(markdown_text: str) -> Dict[str, Any]:
    """
    Extract structured information from markdown text using ChatGPT
    """
    # Initialize OpenAI client
    openai = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    json_format = """
        {
        "footer": {
            "total_ht": 295 #Le total HT de la facture -> il faut que la somme des montants HT soit égale au total HT ça te permet de voir si tu as des erreurs de virgule ou autres
        },
        "header": {
            "num_facture": "",
            "date_facture": "2025-02-22T00:00:00.000Z",
            "prestataire_nom": "Suez",
            "prestataire_siret": "41025264700236",
            "prestataire_num_client": "",
            "prestataire_description": ""
        },
        "departs": [
            {
            "line_body": [
                {
                "unite": "", #Tonnes, Unité, T, etc...  
                "quantite": 0, #Nombre
                "montant_ht": 0, #Nombre (Le montant en €, attention au virgule il faut que ce soit cohérent)
                "prix_unitaire": 0, #Nombre
                "type_operation": "" #le type d'opération parmi ces valeurs : Préparation/Transport/Traitement/Gestion globale/Rachat/Location/Mise à disposition/Maintenance/Autres : Contenant/Autres/Non expliqués/Pénalités/Déclassement/TGAP
                },
                ...
            ],
            "line_header": {
                "filiere": "",
                "site_nom": "Chantier Dijon",
                "bon_pesee": "",
                "site_siret": "55445162211591",
                "code_dechet": "15 01 03",
                "date_depart": "2025-02-22T00:00:00.000Z",
                "num_dossier": "",
                "type_dechet": "Bois",
                "bon_intention": "",
                "site_description": "Chantier Dijon",
                "site_num_affaire": "",
                "dechet_description": ""
            },
            "linked_to_bsd": false
            }
        ]
        }
        """

    prompt = f"""
        Tu es un assistant qui convertit un facture en format markdown en un JSON structuré.
        Voici le format du json : {json_format}. 
        Attention les siret sont composé de 14 chiffres.
    """

    response = openai.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": markdown_text}
        ]
    )

    # Extract the JSON response
    try:
        import json
        return json.loads(response.choices[0].message.content)
    except json.JSONDecodeError:
        return {"error": "Failed to parse invoice information"}

def process_invoice_file(file) -> Dict[str, Any]:
    """
    Main function to process an invoice file
    """
    # Convert PDF to markdown
    markdown_text = convert_pdf_to_markdown(file)
    
    # Extract information using ChatGPT
    invoice_info = extract_invoice_info_from_markdown(markdown_text)
    
    return invoice_info
