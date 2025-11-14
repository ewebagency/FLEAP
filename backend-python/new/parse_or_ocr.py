from __future__ import annotations

from typing import TypedDict

from fastapi import UploadFile

from utils.utils_doctr import ocr_this_pdf_with_doctr


class ParseOcrComparison(TypedDict):
    """
    Représente le résultat de la comparaison Parse vs OCR.
    """

    extra_chars: int
    force_ocr: bool
    ocr_text: str
    ocr_json: dict[str, object] | None


async def compare_parse_and_ocr(file: UploadFile, parsed_text: str, threshold: int = 20) -> ParseOcrComparison:
    """
    Compare le texte parsé et le texte OCR.

    Args:
        file: Fichier PDF d'origine.
        parsed_text: Texte obtenu via parsing natif.
        threshold: Nombre minimal de caractères supplémentaires à trouver côté OCR pour
                   considérer que l'on perd de l'information.

    Returns:
        ParseOcrComparison
    """

    await file.seek(0)
    ocr_result = await ocr_this_pdf_with_doctr(file)

    ocr_text = ocr_result.get("text", "") or ""
    extra_chars = max(0, len(ocr_text.strip()) - len(parsed_text.strip()))
    force_ocr = extra_chars > threshold

    return ParseOcrComparison(
        extra_chars=extra_chars,
        force_ocr=force_ocr,
        ocr_text=ocr_text,
        ocr_json=ocr_result.get("raw_result"),
    )

