from fastapi import FastAPI, File, UploadFile
import pdfplumber
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Configurer CORS pour autoriser les requêtes du frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Remplace par l'URL de ton frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/extract-text/")
async def extract_text(file: UploadFile = File(...)):
    # Ouvrir le fichier PDF
    with pdfplumber.open(file.file) as pdf:
        text = ""
        # Lire chaque page du PDF
        for page in pdf.pages:
            # Extraire le texte de la page
            page_text = page.extract_text()

            # Vérifier s'il y a du texte extrait
            if page_text:
                # Diviser le texte par PAGE_BREAK
                parts = page_text.split("[PAGE_BREAK]")

                # Traiter chaque partie
                for part in parts:
                    # Rechercher "MONTANT DU REPORT" et sa position
                    montant_line_index = part.find("MONTANT DU REPORT")

                    if montant_line_index != -1:
                        # Garder le texte après "MONTANT DU REPORT" jusqu'à la prochaine nouvelle ligne
                        text_before = part[:montant_line_index].strip()  # Texte avant "MONTANT DU REPORT"
                        text_after = part[montant_line_index:].strip()  # Texte à partir de "MONTANT DU REPORT"

                        # Garder tout ce qui est après "MONTANT DU REPORT" (incluant la ligne suivante)
                        next_line_index = text_after.find("\n")
                        if next_line_index != -1:
                            # Conserver le texte à partir de "MONTANT DU REPORT" jusqu'à la fin
                            text += text_after[next_line_index + 1:].strip() + "[PAGE_BREAK]"
                        else:
                            text += text_after.strip() + "[PAGE_BREAK]"
                    else:
                        # Si "MONTANT DU REPORT" n'est pas trouvé, garder le texte complet avant
                        text += part.strip() + "[PAGE_BREAK]"

    text = text.replace("[PAGE_BREAK]", "[NEWLINE]")

    # Retourner le texte extrait
    return {"text": text}
