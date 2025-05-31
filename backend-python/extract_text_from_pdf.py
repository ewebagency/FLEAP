# import pdfplumber
# from fastapi import UploadFile
# import pytesseract
# from pdf2image import convert_from_path
# import os
# import io

# # Configuration des chemins
# poppler_path = r"C:\Program Files\poppler\Library\bin"
# os.environ["PATH"] += os.pathsep + poppler_path
# pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# async def extract_text(file: UploadFile):
#     text = ""
#     with pdfplumber.open(file.file) as pdf:
#         for page in pdf.pages:
#             page_text = page.extract_text()
#             if page_text:
#                 parts = page_text.split("[PAGE_BREAK]")
#                 for part in parts:
#                     montant_line_index = part.find("MONTANT DU REPORT")
#                     if montant_line_index != -1:
#                         text_before = part[:montant_line_index].strip()
#                         text_after = part[montant_line_index:].strip()
#                         next_line_index = text_after.find("\n")
#                         if next_line_index != -1:
#                             text += text_after[next_line_index + 1:].strip() + "[PAGE_BREAK]"
#                         else:
#                             text += text_after.strip() + "[PAGE_BREAK]"
#                     else:
#                         text += part.strip() + "[PAGE_BREAK]"

#     text = text.replace("[PAGE_BREAK]", "[NEWLINE]")
#     return {"text": text}

# async def extract_text_with_ocr(file_content):
#     """Extrait le texte d'un PDF en utilisant Tesseract OCR"""
#     try:
#         # Sauvegarde temporaire du fichier pour pdf2image
#         temp_path = "temp_pdf.pdf"
#         with open(temp_path, "wb") as temp_file:
#             temp_file.write(file_content)
        
#         # Conversion et OCR
#         images = convert_from_path(
#             temp_path,
#             poppler_path=poppler_path
#         )
#         text = ""
#         for image in images:
#             page_text = pytesseract.image_to_string(image, lang='fra')
#             text += page_text + "\n"
        
#         # Nettoyage
#         os.remove(temp_path)
#         return text.strip()
#     except Exception as e:
#         print(f"Erreur OCR: {str(e)}")
#         return ""

# async def extract_text_only(file: UploadFile):
#     try:
#         # Lecture du contenu du fichier
#         content = await file.read()
        
#         # Première tentative avec pdfplumber
#         with pdfplumber.open(io.BytesIO(content)) as pdf:
#             text = ""
#             for page in pdf.pages:
#                 page_text = page.extract_text()
#                 if page_text:
#                     text += page_text + "\n"
            
#             # Si pdfplumber n'a pas réussi à extraire assez de texte, on essaie l'OCR
#             if len(text.strip()) < 20:
#                 print("Tentative d'extraction avec OCR...")
#                 text = await extract_text_with_ocr(content)
#                 if len(text.strip()) < 20:
#                     return {"text": "Impossible", "method": "none"}
#                 return {"text": text.strip(), "method": "ocr"}
                
#             return {"text": text.strip(), "method": "pdfplumber"}
            
#     except Exception as e:
#         print(f"Erreur lors de l'extraction du texte: {str(e)}")
#         return {"text": "Impossible", "method": "none"}