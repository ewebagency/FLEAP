from typing import Dict, Optional, TypedDict

from utils.utils_manuscrit import classify_ocr_with_density


class LargeWordBox(TypedDict):
    x0: float
    y0: float
    x1: float
    y1: float


class LargeWordInfo(TypedDict):
    text: str
    confidence: float
    height_ratio: float
    page_index: int
    bbox: LargeWordBox


class LargeWordMetrics(TypedDict, total=False):
    ratio: float
    has_issue: bool
    large_word_count: int
    misread_large_word_count: int
    suspect_words: list[LargeWordInfo]

def extract_values(d):
    values = []
    if isinstance(d, dict):
        for v in d.values():
            values.extend(extract_values(v))
    elif isinstance(d, list):
        for item in d:
            values.extend(extract_values(item))
    else:
        values.append(d)
    return values


def analyze_large_word_misreads(
    ocr_json: Optional[Dict],
    height_ratio_threshold: float = 0.01,
    confidence_threshold: float = 0.6,
) -> LargeWordMetrics:
    """
    Détecte les mots très grands mais avec une faible confiance OCR.
    Renvoie un score (ratio) et un indicateur booléen.
    """
    metrics: LargeWordMetrics = {
        "ratio": 0.0,
        "has_issue": False,
        "large_word_count": 0,
        "misread_large_word_count": 0,
        "suspect_words": [],
    }

    if not ocr_json or "pages" not in ocr_json:
        return metrics

    large_words = 0
    misread_large_words = 0

    suspect_words: list[LargeWordInfo] = []

    for page_index, page in enumerate(ocr_json.get("pages", [])):
        for block in page.get("blocks", []):
            for line in block.get("lines", []):
                for word in line.get("words", []):
                    geometry = word.get("geometry")
                    if (
                        geometry is None
                        or not isinstance(geometry, (list, tuple))
                        or len(geometry) != 2
                    ):
                        continue

                    (x0, y0), (x1, y1) = geometry
                    try:
                        height_ratio = max(0.0, float(y1) - float(y0))
                    except (TypeError, ValueError):
                        continue

                    if height_ratio < height_ratio_threshold:
                        continue

                    confidence_value = word.get("confidence")
                    try:
                        confidence_float = float(confidence_value)
                    except (TypeError, ValueError):
                        continue

                    large_words += 1
                    if confidence_float < confidence_threshold:
                        misread_large_words += 1
                        suspect_words.append(
                            {
                                "text": str(word.get("value") or ""),
                                "confidence": confidence_float,
                                "height_ratio": height_ratio,
                                "page_index": page_index,
                                "bbox": {
                                    "x0": float(x0),
                                    "y0": float(y0),
                                    "x1": float(x1),
                                    "y1": float(y1),
                                },
                            }
                        )

    if large_words > 0:
        metrics["ratio"] = misread_large_words / large_words
        metrics["has_issue"] = misread_large_words > 0
    metrics["large_word_count"] = large_words
    metrics["misread_large_word_count"] = misread_large_words
    metrics["suspect_words"] = suspect_words
    return metrics


def get_confidence(gemini_data, potential_json_from_ocr):
    json = potential_json_from_ocr
    score_brute, n, score_spec, n_spec = 0, 0, 0, 0
    raw_gemini_values = extract_values(gemini_data)
    #print("="*43, "les valeurs de gemini : ", "\n", raw_gemini_values, "\n"*4)
    if not json or "pages" not in json:
        return {"brute": 100.0, "spec": 100.0}
    for page in json["pages"] :
        for block in page["blocks"] :
            for line in block["lines"] :
                for word in line["words"] :
                    word_value = str(word["value"]) if word.get("value") is not None else ""
                    confidence = word["confidence"]
                    
                    score_brute += confidence
                    n += 1
                    for raw_g_value in raw_gemini_values :
                        # Convertir en string pour éviter l'erreur si raw_g_value est un bool
                        raw_g_value_str = str(raw_g_value) if raw_g_value is not None else ""
                        if raw_g_value_str and word_value and ((raw_g_value_str in word_value) or (word_value in raw_g_value_str)) and len(word_value) > 3 :
                            score_spec += confidence
                            n_spec += 1
                            break
    score_brute = (score_brute / n) * 100 if n > 0 else 100.0
    score_spec = (score_spec / n_spec) * 100 if n_spec > 0 else 100.0

    return {"brute": score_brute, "spec": score_spec}



def handwritten_confidence(file, ocr_json):
    # Normaliser la forme du JSON OCR attendu par classify_ocr_with_density
    # Ce dernier s'attend à un dict avec la clé 'raw_result' contenant 'pages'
    if ocr_json is None:
        normalized = {"raw_result": {"pages": []}}
    elif isinstance(ocr_json, dict) and "raw_result" in ocr_json:
        normalized = ocr_json
    else:
        # Quand on reçoit déjà le "raw_result" (ex: utils_doctr), on l'encapsule
        normalized = {"raw_result": ocr_json}

    results = classify_ocr_with_density(file, normalized, threshold=0.03)
    
    handwritten_words_list = [
        word for word in results 
        if word.get('classification') == 'handwritten'
    ]
    n = len(handwritten_words_list)
    too_much_handwritten_words = n > 6
    
    return n, too_much_handwritten_words