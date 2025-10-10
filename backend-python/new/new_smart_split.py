"""
Smart Split - Division intelligente de PDFs multi-pages
Détecte automatiquement les segments et leurs types (facture, bon, bsd, autre)
"""

import time
import json
import io
from typing import List, Dict, Any
from fastapi import UploadFile
import fitz  # PyMuPDF (déjà installé dans le projet)
from new.new_extract_raw import get_raw_text_from_pdf
from new.new_recognize_type import recognize_type_one_page
from utils.utils_gemini import extract_gemini


def get_smart_split_prompt():
    """
    Prompt pour demander à Gemini de segmenter un PDF multi-pages
    et détecter le type de chaque segment
    """
    return """Tu analyses un PDF découpé page par page.

ENTRÉE: [{"idx_page": 0, "raw_text": "..."}, {"idx_page": 1, "raw_text": "..."}, ...]

TYPES DE DOCUMENTS:
- "facture": Facture avec montants, TVA, prix
- "bon": Bon de commande/pesée/livraison, BL, note de livraison avec poids (brut, tare, net)
- "bsd": Bordereau de Suivi de Déchets (CERFA)
- "autre": Autre type

RÈGLE CRITIQUE DE SEGMENTATION:
→ Pages avec le MÊME identifiant (numéro de bon, numéro de facture, numéro de BSD) = 1 segment
→ Pages avec des identifiants DIFFÉRENTS = segments SÉPARÉS

EXEMPLES CONCRETS:
✅ Facture n°123 sur 3 pages → [{"type": "facture", "pages": [0, 1, 2]}]
✅ 3 bons différents (n°A, n°B, n°C) sur 3 pages → [{"type": "bon", "pages": [0]}, {"type": "bon", "pages": [1]}, {"type": "bon", "pages": [2]}]
✅ Facture n°123 (2 pages) + Bon n°456 (1 page) → [{"type": "facture", "pages": [0, 1]}, {"type": "bon", "pages": [2]}]
✅ BSD n°789 (2 pages) + Bon n°A + Bon n°B → [{"type": "bsd", "pages": [0, 1]}, {"type": "bon", "pages": [2]}, {"type": "bon", "pages": [3]}]

CONSIGNES:
- Toutes les pages doivent être assignées
- Pages consécutives uniquement dans un segment
- Si un numéro n'est pas clair, considère chaque page comme un segment séparé par sécurité

SORTIE (JSON uniquement, aucun texte):
[{"type": "facture", "pages": [0, 1]}, {"type": "bon", "pages": [2]}]
"""


class FakeUploadFile:
    """Classe pour créer un objet compatible avec UploadFile à partir de bytes"""
    def __init__(self, content: bytes, filename: str = "page.pdf"):
        self._content = content
        self._position = 0
        self._filename = filename
    
    async def read(self, size: int = -1) -> bytes:
        if size == -1:
            result = self._content[self._position:]
            self._position = len(self._content)
            return result
        else:
            result = self._content[self._position:self._position + size]
            self._position += len(result)
            return result
    
    async def seek(self, position: int) -> None:
        self._position = position
    
    async def close(self) -> None:
        pass
    
    @property
    def filename(self) -> str:
        return self._filename


async def structure_for_split(file: UploadFile):
    """
    Split physiquement le PDF en pages individuelles, puis extrait le texte de chaque page.
    Garantit que get_raw_text_from_pdf reçoit toujours des PDFs mono-page (parsable ou OCR).
    
    Returns:
        tuple: ([{idx_page, raw_text}, ...], parse_or_ocr_method)
    """
    await file.seek(0)
    pdf_content = await file.read()
    doc = None
    
    try:
        doc = fitz.open(stream=pdf_content, filetype="pdf")
        num_pages = len(doc)
        print(f"📄 {num_pages} page(s) détectée(s)")
        
        # Si une seule page, pas besoin de split
        if num_pages == 1:
            doc.close()
            del pdf_content
            await file.seek(0)
            raw_text, _, parse_or_ocr = await get_raw_text_from_pdf(file)
            return [{"idx_page": 0, "raw_text": raw_text}], parse_or_ocr
        
        # Multi-pages: split physique puis extraction page par page
        pages_data = []
        parse_or_ocr_method = None
        
        for page_idx in range(num_pages):
            new_doc = None
            try:
                # Créer un nouveau document avec juste cette page
                new_doc = fitz.open()
                new_doc.insert_pdf(doc, from_page=page_idx, to_page=page_idx)
                page_bytes = new_doc.tobytes()
                new_doc.close()
                new_doc = None
                
                # Créer un FakeUploadFile et extraire le texte
                fake_file = FakeUploadFile(page_bytes, filename=f"page_{page_idx}.pdf")
                raw_text, _, parse_or_ocr = await get_raw_text_from_pdf(fake_file)
                
                if parse_or_ocr_method is None:
                    parse_or_ocr_method = parse_or_ocr
                
                pages_data.append({"idx_page": page_idx, "raw_text": raw_text})
                
                # Cleanup
                del page_bytes, fake_file
                
            except Exception as e:
                print(f"⚠️ Page {page_idx} erreur: {str(e)}")
                pages_data.append({"idx_page": page_idx, "raw_text": ""})
            finally:
                if new_doc:
                    new_doc.close()
        
        doc.close()
        del pdf_content
        print(f"✅ {len(pages_data)} page(s) extraite(s)")
        return pages_data, parse_or_ocr_method or "parse"
        
    except Exception as e:
        print(f"❌ Split échoué: {str(e)}, fallback extraction globale")
        if doc:
            doc.close()
        del pdf_content
        await file.seek(0)
        raw_text, _, parse_or_ocr = await get_raw_text_from_pdf(file)
        return [{"idx_page": 0, "raw_text": raw_text}], parse_or_ocr


async def send_to_gemini_for_split(pages_data: List[Dict[str, Any]]):
    """
    Envoie les données structurées à Gemini pour obtenir la segmentation
    
    Returns:
        dict: {"success": bool, "segments": [...] or "error": str}
    """
    prompt = get_smart_split_prompt()
    pages_json = json.dumps(pages_data, ensure_ascii=False, indent=2)
    
    gemini_response = await extract_gemini(pages_json, prompt)
    
    if "error" in gemini_response:
        return {"success": False, "error": gemini_response["error"]}
    
    try:
        extracted_data = gemini_response.get("extracted_data", "[]")
        segments = json.loads(extracted_data)
        
        # Valider le format
        if not isinstance(segments, list):
            return {"success": False, "error": "Format invalide"}
        
        for segment in segments:
            if not isinstance(segment, dict) or "type" not in segment or "pages" not in segment:
                return {"success": False, "error": "Segment invalide"}
            if not isinstance(segment["pages"], list):
                return {"success": False, "error": "'pages' doit être une liste"}
        
        # Cleanup
        del pages_json, gemini_response, extracted_data
        
        return {"success": True, "segments": segments}
        
    except json.JSONDecodeError as e:
        return {"success": False, "error": f"Parse JSON: {str(e)}"}


def check_logique_coherence(
    segments: List[Dict[str, Any]], 
    pages_data: List[Dict[str, Any]]
):
    """
    Vérifie la cohérence entre les types détectés par Gemini et la règle logique
    
    Returns:
        list: Liste des alertes/warnings détectés
    """
    alerts = []
    print(f"🔍 Vérification: {len(segments)} segment(s)")
    
    for segment in segments:
        segment_type = segment.get("type", "autre")
        pages_indices = segment.get("pages", [])
        
        for page_idx in pages_indices:
            page_data = next((p for p in pages_data if p["idx_page"] == page_idx), None)
            if not page_data:
                continue
            
            # Appliquer la règle logique
            logic_result = recognize_type_one_page(page_data["raw_text"])
            logic_type = logic_result.get("type", "inconnu")
            logic_confidence = logic_result.get("confidence", 0.0)
            
            # Si incohérence, ajouter une alerte
            if logic_type != segment_type:
                severity = "warning" if logic_type != "inconnu" else "info"
                message_text = f"⚠️ Page {page_idx}: Gemini='{segment_type}' vs Logique='{logic_type}' ({logic_confidence:.0%})"
                print(f"   {message_text}")
                
                alerts.append({
                    "page_idx": page_idx,
                    "gemini_type": segment_type,
                    "logic_type": logic_type,
                    "logic_confidence": logic_confidence,
                    "message": message_text,
                    "severity": severity
                })
            
            # Cleanup
            del logic_result
    
    if not alerts:
        print("   ✅ Aucune incohérence")
    return alerts


async def smart_split_pdf(file: UploadFile, check_logique: bool = True):
    """
    Fonction principale de smart split
    
    Args:
        file: Fichier PDF uploadé
        check_logique: Si True, vérifie la cohérence avec recognize_type_one_page
    
    Returns:
        dict: {
            "success": bool,
            "segments": [...],  # Réponse de Gemini
            "metadata": {
                "processing_time": float,
                "total_pages": int,
                "check_logique_enabled": bool,
                "alerts": [...]  # Si check_logique=True et incohérences détectées
            },
            "error": str  # Si échec
        }
    """
    start_time = time.time()
    
    try:
        # Phase 1: Extraction page par page
        print("📄 Extraction page par page...")
        pages_data, parse_or_ocr = await structure_for_split(file)
        total_pages = len(pages_data)
        print(f"✅ {total_pages} page(s) via {parse_or_ocr}")
        
        # Phase 2: Segmentation Gemini
        print("🧠 Segmentation Gemini...")
        gemini_result = await send_to_gemini_for_split(pages_data)
        
        if not gemini_result.get("success"):
            processing_time = time.time() - start_time
            del pages_data
            return {
                "success": False,
                "error": gemini_result.get("error", "Erreur inconnue"),
                "metadata": {
                    "processing_time": round(processing_time, 2),
                    "total_pages": total_pages,
                    "check_logique_enabled": check_logique
                }
            }
        
        segments = gemini_result.get("segments", [])
        print(f"✅ {len(segments)} segment(s)")
        
        # Phase 3: Vérification logique
        alerts = []
        if check_logique:
            alerts = check_logique_coherence(segments, pages_data)
        
        processing_time = time.time() - start_time
        
        # Cleanup
        del pages_data, gemini_result
        
        return {
            "success": True,
            "segments": segments,
            "metadata": {
                "processing_time": round(processing_time, 2),
                "total_pages": total_pages,
                "parse_or_ocr": parse_or_ocr,
                "check_logique_enabled": check_logique,
                "alerts": alerts if check_logique else None
            }
        }
        
    except Exception as e:
        processing_time = time.time() - start_time
        print(f"❌ Erreur: {str(e)}")
        return {
            "success": False,
            "error": f"Erreur: {str(e)}",
            "metadata": {
                "processing_time": round(processing_time, 2),
                "check_logique_enabled": check_logique
            }
        }

