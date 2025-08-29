import tempfile
import os
import pdfplumber


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
        
        # Reset file position for potential future reads
        await file.seek(0)

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
        return {"error": f"Failed to parse PDF: {str(e)}"}