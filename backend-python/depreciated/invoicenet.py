import os
import pdfplumber
from PIL import Image
import pytesseract
from pdf2image import convert_from_path
from dotenv import load_dotenv  # pip install python-dotenv
import io

# Ajouter le chemin de Poppler au PATH au début du script
poppler_path = r"C:\Program Files\poppler\Library\bin"
os.environ["PATH"] += os.pathsep + poppler_path

# Charger les variables d'environnement
load_dotenv()

def check_dependencies():
    """Vérifie si toutes les dépendances sont installées"""
    missing = []
    
    # Vérifie Tesseract
    try:
        pytesseract.get_tesseract_version()
    except Exception:
        missing.append("""Tesseract n'est pas installé ou pas dans le PATH.
        1. Téléchargez depuis https://github.com/UB-Mannheim/tesseract/wiki
        2. Installez dans C:\\Program Files\\Tesseract-OCR
        3. Ajoutez C:\\Program Files\\Tesseract-OCR au PATH
        4. Redémarrez votre terminal""")
    
    # Vérifie Poppler
    try:
        from pdf2image.exceptions import PDFInfoNotInstalledError
        convert_from_path("test", first_page=1, last_page=1)
    except PDFInfoNotInstalledError:
        missing.append("""Poppler n'est pas installé ou pas dans le PATH.
        1. Téléchargez depuis https://github.com/oschwartz10612/poppler-windows/releases/
        2. Extrayez dans C:\\Program Files\\poppler
        3. Ajoutez C:\\Program Files\\poppler\\Library\\bin au PATH
        4. Redémarrez votre terminal""")
    except Exception:
        pass  # Ignore other errors as we just want to check if poppler exists
    
    return missing

def extract_text_with_ocr(pdf_path):
    """Extrait le texte d'un PDF en utilisant Tesseract OCR"""
    # Vérifie les dépendances avant de commencer
    missing_deps = check_dependencies()
    if missing_deps:
        print("\nDépendances manquantes :")
        for dep in missing_deps:
            print(dep)
        return ""

    try:
        images = convert_from_path(
            pdf_path,
            poppler_path=r"C:\Program Files\poppler\Library\bin"
        )
        text = ""
        for image in images:
            pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
            page_text = pytesseract.image_to_string(image, lang='fra')
            text += page_text + "\n"
            
        return text.strip()
    except Exception as e:
        print(f"Erreur OCR: {str(e)}")
        return ""

def check_if_scanned(pdf_page):
    """Vérifie si une page semble être scannée en analysant les images"""
    try:
        images = pdf_page.images
        if len(images) > 0:
            return True
        return False
    except:
        return False

def search_yprema_in_pdfs():
    pdf_directory = os.path.join(os.path.dirname(__file__), "..", "..", "public", "pdfs", "mes_docs")
    results = []
    print('\nDébut de la lecture des PDFs')
    
    for filename in os.listdir(pdf_directory):
        if filename.endswith('.pdf'):
            file_path = os.path.join(pdf_directory, filename)
            try:
                # Première tentative avec pdfplumber
                with pdfplumber.open(file_path) as pdf:
                    text = ""
                    is_scanned = False
                    
                    for page in pdf.pages:
                        if check_if_scanned(page):
                            is_scanned = True
                        page_text = page.extract_text()
                        if page_text:
                            text += page_text + "\n"
                    
                    # Si le texte est trop court ou vide, essayons l'OCR
                    if len(text.strip()) < 20:
                        print(f"\nTentative d'OCR sur {filename}...")
                        text = extract_text_with_ocr(file_path)
                        
                        if len(text.strip()) < 20:
                            error_type = "PDF illisible même avec OCR"
                            if is_scanned:
                                error_type = "PDF scanné - échec OCR"
                                
                            results.append({
                                "filename": filename,
                                "error": error_type,
                                "status": "error"
                            })
                            print(f"Erreur - {filename}: {error_type}")
                        else:
                            results.append({
                                "filename": filename,
                                "text": text,
                                "status": "success",
                                "method": "ocr"
                            })
                            print(f"\nLecture réussie (OCR): {filename}")
                            print("----------------------------------------")
                            print("Contenu extrait:")
                            print(text)
                            print("----------------------------------------")
                    else:
                        results.append({
                            "filename": filename,
                            "text": text,
                            "status": "success",
                            "method": "pdfplumber"
                        })
                        print(f"\nLecture réussie (pdfplumber): {filename}")
                        print("----------------------------------------")
                        print("Contenu extrait:")
                        print(text)
                        print("----------------------------------------")
                    
            except Exception as e:
                error_message = str(e)
                error_type = "Erreur inconnue"
                
                if "encrypted" in str(e).lower():
                    error_type = "PDF protégé/crypté"
                elif "damaged" in str(e).lower() or "invalid" in str(e).lower():
                    error_type = "PDF corrompu ou invalide"
                
                results.append({
                    "filename": filename,
                    "error": f"{error_type}: {error_message}",
                    "status": "error"
                })
                print(f"Erreur lors de la lecture de {filename}: {error_type} - {error_message}")
                
    return results

# Exécute la fonction
results = search_yprema_in_pdfs()

# Affiche un résumé
print("\nRésumé des lectures:")
success_count = sum(1 for r in results if r["status"] == "success")
error_count = sum(1 for r in results if r["status"] == "error")
ocr_count = sum(1 for r in results if r.get("status") == "success" and r.get("method") == "ocr")
print(f"PDFs lus avec succès: {success_count} (dont {ocr_count} par OCR)")
print(f"PDFs en erreur: {error_count}")
