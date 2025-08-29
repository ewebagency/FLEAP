import re
import unicodedata
from typing import Dict, List, Tuple


def _normalize_text(text: str):
    """
    Normalize text for robust matching:
    - lowercase
    - strip accents
    - collapse whitespace
    """
    if text is None:
        return ""
    text_lower = text.lower()
    text_no_accents = unicodedata.normalize("NFKD", text_lower)
    text_no_accents = "".join([c for c in text_no_accents if not unicodedata.combining(c)])
    text_spaces = re.sub(r"\s+", " ", text_no_accents).strip()
    text_no_points = text_spaces.replace(".", "")
    return text_no_points


def _build_keywords():
    """
    Curated keywords commonly found in each document type.
    Keep them short and robust (avoid overly specific numbers).
    """
    return {
        # Bordereau de Suivi de Déchets (BSD / BSDD / BSDA ...)
        "bsd": [
            "bordereau de suivi des dechets",
            "denomination du dechet",
            "emetteur du bordereau",
            "mentions au titre des reglements",
            "cerfa",
            "bordereau de suivi",
            "collecteur-transporteur",
        ],
        # Invoice
        "facture": [
            "facture",           
            "total ht",
            "tva",                      
            #"prix unitaire",
            #"pu",
            "reglement",
            " u ",
            " t ",
            "tva",
            "0,00",
            "1,00",
        ],
        # Delivery/collection order, purchase order, or service order
        "bon": [
            "bon de pesee",
            "brut",
            "tare",
            "net",
            "bon de livraison",
            "bon d'intervention",
            "bon d'enlevement",
        ]
        # Other categories requested
        #"cap": [
        #    "cap",
        #    "certificat d'acceptation prealable",
        #    "certificat acceptation prealable",
        #    "acceptation prealable",
        #],
        #"attestation_de_valorisation": [
        #    "attestation ",
        #],
        #"recepisse": [
        #    "recepisse",
        #    "récépissé",
        #    "numero de recepisse",
        #    "declarant",
        #    "prefecture",
        #],
        #"contrat": [
        #    "contrat",
        #    "conditions generales",
        #    "conditions particulieres",
        #    "duree",
        #    "resiliation",
        #    "signataire",
        #    "objet du contrat",
        #],
        #"mandat": [
        #    "mandat",
        #    "mandataire",
        #    "mandant",
        #    "pouvoir",
        #    "procuration",
    }


def _score_for_type(normalized_text: str, keywords: List[str]):
    """
    Return (matches_count, keywords_count, found_keywords) using whole-word or robust substring matching.
    We count each keyword at most once to avoid over-weighting repetitions.
    """
    matches = 0
    found_keywords = []
    for kw in keywords:
        # Use a relaxed contains for robustness, but require keyword length >= 3
        if not kw or len(kw) < 3:
            continue
        if kw in normalized_text:
            matches += 1
            found_keywords.append(kw)
            continue
        # If keyword is multi-word, try word presence ratio as a fallback
        words = [w for w in re.split(r"[^a-z0-9']+", kw) if len(w) >= 3]
        if words:
            present = sum(1 for w in words if w in normalized_text)
            if present >= max(1, len(words) - 1):
                matches += 1
                found_keywords.append(kw)
    return matches, len(keywords), found_keywords


def recognize_type_one_page(raw_text: str):
    """
    Classify a single page's OCR raw text into a document type.
    Returns a dict: {"type": str, "confidence": float, "scores": Dict[str, float]}
    """
    normalized = _normalize_text(raw_text)
    keywords_by_type = _build_keywords()

    # Compute raw and normalized scores
    raw_scores = {}
    normalized_scores = {}
    found_keywords_by_type = {}
    for doc_type, kw_list in keywords_by_type.items():
        matches, total, found_keywords = _score_for_type(normalized, kw_list)
        raw_scores[doc_type] = matches
        normalized_scores[doc_type] = matches / total if total > 0 else 0.0
        found_keywords_by_type[doc_type] = found_keywords

    # Determine best type
    best_type = max(normalized_scores.items(), key=lambda kv: kv[1])[0] if normalized_scores else "autre"
    best_score = normalized_scores.get(best_type, 0.0)

    # Convert to confidence between 0 and 1 relative to others
    score_sum = sum(normalized_scores.values()) or 1.0
    relative_confidence = best_score / score_sum

    # Apply simple threshold; if too low, fallback to "autre"
    MIN_ABSOLUTE = 0.15  # at least ~15% of that type's keywords present
    MIN_RELATIVE = 0.45  # top score should be reasonably above the rest
    doc_type_result = best_type if (best_score >= MIN_ABSOLUTE and relative_confidence >= MIN_RELATIVE) else "inconnu"

    return {
        "type": doc_type_result,
        "confidence": round(float(max(best_score, relative_confidence)), 4),
        "scores": {
            "raw": raw_scores,
            "normalized": {k: round(v, 4) for k, v in normalized_scores.items()},
        },
        "found_keywords": found_keywords_by_type,
    }

