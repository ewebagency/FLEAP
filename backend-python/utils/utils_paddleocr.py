"""
from fastapi import UploadFile
from collections import defaultdict
from paddleocr import PaddleOCR
import numpy as np
import cv2
import tempfile
import os
import pdfplumber
from PIL import Image
import io
import requests
import json
from typing import Dict, Any, Optional
import re
from datetime import datetime
from utils.utils_gemini import extract_bsd_with_gemini

ocr = PaddleOCR(lang='fr')  # ✅ Chargé une seule fois


def group_lines(rec_texts, rec_boxes, y_thresh=10):
    lines = defaultdict(list)
    
    for text, box in zip(rec_texts, rec_boxes):
        x1, y1, x2, y2 = box
        y_center = (y1 + y2) / 2

        # Trouver une ligne existante proche en Y
        found_line = None
        for ly in lines:
            if abs(ly - y_center) < y_thresh:
                found_line = ly
                break
        
        if found_line is None:
            found_line = y_center
        
        lines[found_line].append((x1, text))

    # Trier chaque ligne par X
    sorted_lines = []
    for ly in sorted(lines):
        line_text = " ".join([t for _, t in sorted(lines[ly], key=lambda x: x[0])])
        sorted_lines.append(line_text)
    
    return "\n".join(sorted_lines)

def extract_text_from_result(result):
    all_text = []
    for page in result:  # multi-pages possible
        lines_text = group_lines(page["rec_texts"], page["rec_boxes"])
        all_text.append(lines_text)
    return "\n".join(all_text)

async def run_paddle_ocr(file: UploadFile):
    # Lire le contenu du fichier
    contents = await file.read()

    # Sauvegarder temporairement le fichier
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    all_text = []
    
    try:
        # Convertir PDF en images avec pdfplumber
        with pdfplumber.open(tmp_path) as pdf:
            for page in pdf.pages:
                # Convertir la page en image
                img = page.to_image()
                img_bytes = img.original.convert('RGB')
                
                # Convertir PIL Image en numpy array
                img_array = np.array(img_bytes)
                
                # OCR sur l'image originale
                result = ocr.predict(img_array)
                
                # Extraire le texte de cette page
                if result:
                    page_text = extract_text_from_result(result)
                    all_text.append(page_text)
    
    finally:
        # Nettoyer le fichier temporaire
        try:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
        except PermissionError:
            # Si on ne peut pas supprimer le fichier, on l'ignore
            pass
    
    return {"text": "\n".join(all_text), "raw_result": result}


def extract_bs_with_paddle_ocr(text: str) -> str:
    #Nettoie la réponse de Gemini en supprimant les backticks et le mot 'json'
    # Supprimer les backticks et le mot "json" s'ils sont présents
    cleaned = text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    
    return cleaned.strip()

"""