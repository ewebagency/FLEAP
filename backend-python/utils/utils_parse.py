import requests
import tempfile
import pdfplumber
import os

async def parse_pdf(pdf_url):
    try:
        # Télécharger le PDF
        response = requests.get(pdf_url)
        if not response.ok:
            return {"error": "Failed to fetch PDF"}
        
        # Sauvegarder temporairement le PDF
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(response.content)
            tmp_path = tmp.name

        # Extraire le texte du PDF
        text = ""
        with pdfplumber.open(tmp_path) as pdf:
            for page in pdf.pages:
                text += page.extract_text() or ""

        # Nettoyer le fichier temporaire
        os.unlink(tmp_path)

        if not text:
            return {"error": "No text could be extracted from PDF"}

        return text

    except Exception as e:
        return {"error": f"Failed to process PDF: {str(e)}"}

async def parse_pdf_file(file):
    """
    Parse un fichier PDF uploadé et retourne le texte extrait.
    Si le parsing échoue, retourne une erreur pour permettre l'utilisation d'OCR.
    """
    try:
        # Sauvegarder temporairement le fichier uploadé
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        # Extraire le texte du PDF
        text = ""
        with pdfplumber.open(tmp_path) as pdf:
            for page in pdf.pages:
                text += page.extract_text() or ""

        # Nettoyer le fichier temporaire
        os.unlink(tmp_path)

        if not text:
            return {"error": "No text could be extracted from PDF"}

        return {"text": text, "success": True}

    except Exception as e:
        return {"error": f"Failed to parse PDF: {str(e)}", "success": False}