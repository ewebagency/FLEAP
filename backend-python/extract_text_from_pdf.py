import pdfplumber
from fastapi import UploadFile


async def extract_text(file: UploadFile):
    text = ""
    with pdfplumber.open(file.file) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                parts = page_text.split("[PAGE_BREAK]")
                for part in parts:
                    montant_line_index = part.find("MONTANT DU REPORT")
                    if montant_line_index != -1:
                        text_before = part[:montant_line_index].strip()
                        text_after = part[montant_line_index:].strip()
                        next_line_index = text_after.find("\n")
                        if next_line_index != -1:
                            text += text_after[next_line_index + 1:].strip() + "[PAGE_BREAK]"
                        else:
                            text += text_after.strip() + "[PAGE_BREAK]"
                    else:
                        text += part.strip() + "[PAGE_BREAK]"

    text = text.replace("[PAGE_BREAK]", "[NEWLINE]")
    return {"text": text}
