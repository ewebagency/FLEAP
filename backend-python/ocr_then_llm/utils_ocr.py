import os
import hashlib
import time
from datetime import datetime
from fastapi import HTTPException
import shutil
import threading
from marker.scripts.convert_single import convert_single_cli
from .utils_llm import gemini_api_key

# Cache directory for storing converted PDFs
CACHE_DIR = "cache"
os.makedirs(CACHE_DIR, exist_ok=True)

# Input and output directories for marker
INPUT_DIR = "input_pdfs"
OUTPUT_DIR = "output_markdown"
os.makedirs(INPUT_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Test mode flag
TEST_MODE = False  # Set to False to use real marker

def log_progress():
    """Log progress every minute"""
    start_time = time.time()
    while True:
        time.sleep(60)  # Wait for 1 minute
        elapsed_time = time.time() - start_time
        minutes = int(elapsed_time // 60)
        seconds = int(elapsed_time % 60)
        print(f"⏳ Traitement en cours depuis {minutes} minutes et {seconds} secondes...")
        
        # Check if output directory has any files
        if os.path.exists(OUTPUT_DIR):
            files = os.listdir(OUTPUT_DIR)
            print(f"📁 Fichiers dans le dossier de sortie: {files}")
            
            # Check input directory
            if os.path.exists(INPUT_DIR):
                input_files = os.listdir(INPUT_DIR)
                print(f"📁 Fichiers dans le dossier d'entrée: {input_files}")
            
            # Check if markdown file exists
            markdown_path = os.path.join(OUTPUT_DIR, "input.md")
            if os.path.exists(markdown_path):
                file_size = os.path.getsize(markdown_path)
                print(f"📄 Taille du fichier markdown: {file_size / 1024:.2f} KB")
            else:
                print("❌ Fichier markdown non trouvé")

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

def simulate_marker_output(input_pdf: str):
    """Simulate marker output for testing"""
    # Create the output directory structure
    output_subdir = os.path.join(OUTPUT_DIR, "input")
    os.makedirs(output_subdir, exist_ok=True)
    
    # Create a fake markdown file
    markdown_path = os.path.join(output_subdir, "input.md")
    with open(markdown_path, 'w', encoding='utf-8') as f:
        f.write("""# Test Document

## Section 1
This is a test document generated in test mode.

## Section 2
- Item 1
- Item 2
- Item 3

## Section 3
Some more test content here.
""")
    
    return markdown_path

def convert_pdf_to_markdown(pdf_file) -> str:
    """
    Convert a PDF file to markdown using marker with caching
    
    Args:
        pdf_file: The PDF file object from FastAPI upload
        
    Returns:
        str: The generated markdown text
        
    Raises:
        HTTPException: If there's an error during conversion
    """
    try:
        # Start progress logging in a separate thread
        progress_thread = threading.Thread(target=log_progress, daemon=True)
        progress_thread.start()
        
        # Read PDF content
        pdf_content = pdf_file.file.read()
        
        if not pdf_content:
            raise HTTPException(status_code=400, detail="Le fichier PDF est vide")
            
        print(f"📊 Taille du PDF: {len(pdf_content) / 1024:.2f} KB")
            
        # Generate hash for the PDF
        pdf_hash = get_pdf_hash(pdf_content)
        
        # Check cache first
        cached_markdown = get_cached_markdown(pdf_hash)
        if cached_markdown:
            print("✅ Using cached markdown")
            return cached_markdown
            
        print("🔄 Converting PDF to markdown (this may take a while)...")
        
        # Clean up any existing files
        for file in os.listdir(INPUT_DIR):
            os.remove(os.path.join(INPUT_DIR, file))
        for file in os.listdir(OUTPUT_DIR):
            if os.path.isdir(os.path.join(OUTPUT_DIR, file)):
                shutil.rmtree(os.path.join(OUTPUT_DIR, file))
            else:
                os.remove(os.path.join(OUTPUT_DIR, file))
        
        # Save the PDF to input directory
        input_pdf = os.path.join(INPUT_DIR, "input.pdf")
        with open(input_pdf, 'wb') as f:
            f.write(pdf_content)
        
        print(f"Running marker on file: {input_pdf}")
        timestamp = time.time()
        readable_time = datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S')
        print(f"Current timestamp: {readable_time}")
        
        try:
            # Run marker directly using its API
            try:
                convert_single_cli([
                    input_pdf,
                    "--output_dir", OUTPUT_DIR,
                    "--output_format", "markdown",
                    "--languages", "fr",
                    "--force_ocr",
                    "--disable_image_extraction",
                    "--use_llm",
                    "--gemini_api_key", gemini_api_key
                ])
            except SystemExit as e:
                # Click fait un sys.exit(0) même en cas de succès
                if e.code != 0:
                    raise Exception(f"Marker a échoué avec le code {e.code}")
                print("✅ Marker a terminé avec succès")
            
            # Attendre un peu pour s'assurer que les fichiers sont écrits
            print("⏳ Attente de 5 secondes pour s'assurer que les fichiers sont écrits...")
            time.sleep(5)
            
            # Vérifier le contenu des dossiers
            print("\n📁 Vérification des dossiers:")
            print(f"Dossier d'entrée ({INPUT_DIR}):")
            if os.path.exists(INPUT_DIR):
                print(f"  Contenu: {os.listdir(INPUT_DIR)}")
            else:
                print("  ❌ Dossier d'entrée non trouvé")
                
            print(f"\nDossier de sortie ({OUTPUT_DIR}):")
            if os.path.exists(OUTPUT_DIR):
                print(f"  Contenu: {os.listdir(OUTPUT_DIR)}")
                
                # Vérifier le contenu du sous-dossier input
                input_subdir = os.path.join(OUTPUT_DIR, "input")
                if os.path.exists(input_subdir):
                    print(f"\nSous-dossier input ({input_subdir}):")
                    print(f"  Contenu: {os.listdir(input_subdir)}")
                    
                    # Chercher tous les fichiers .md
                    md_files = [f for f in os.listdir(input_subdir) if f.endswith('.md')]
                    if md_files:
                        print(f"  Fichiers markdown trouvés: {md_files}")
                    else:
                        print("  ❌ Aucun fichier markdown trouvé")
                else:
                    print("  ❌ Sous-dossier input non trouvé")
            else:
                print("  ❌ Dossier de sortie non trouvé")
            
            # Read the generated markdown file
            output_subdir = os.path.join(OUTPUT_DIR, "input")
            if not os.path.exists(output_subdir):
                raise Exception(f"Dossier de sortie non trouvé: {output_subdir}")
                
            # Chercher le fichier markdown
            markdown_files = [f for f in os.listdir(output_subdir) if f.endswith('.md')]
            if not markdown_files:
                raise Exception(f"Aucun fichier markdown trouvé dans {output_subdir}")
                
            # Utiliser le premier fichier markdown trouvé
            markdown_path = os.path.join(output_subdir, markdown_files[0])
            print(f"\n📄 Lecture du fichier: {markdown_path}")
            
            # Check if file exists
            if not os.path.exists(markdown_path):
                raise Exception(f"Fichier markdown non trouvé: {markdown_path}")
                
            with open(markdown_path, 'r', encoding='utf-8') as f:
                markdown = f.read()
            
            if not markdown.strip():
                raise Exception("Le fichier markdown généré est vide")
            
            # Save to cache
            save_to_cache(pdf_hash, markdown)
            print("✅ PDF converted and cached")
            
            return markdown
                
        except Exception as e:
            print(f"❌ Erreur lors de l'exécution de marker: {str(e)}")
            raise
            
    except Exception as e:
        print(f"Error in convert_pdf_to_markdown: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la conversion en markdown: {str(e)}")
