import json
from typing import Dict, List, TypedDict, Union

from utils.utils_gemini import extract_gemini

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


MAX_WORDS_FOR_EVALUATION = 40
EvaluationResult = Dict[str, Union[bool, str, int]]


def _format_words_for_prompt(words: List[LargeWordInfo]) -> str:
    lines: List[str] = []
    for word in words[:MAX_WORDS_FOR_EVALUATION]:
        text = word.get("text", "").strip()
        confidence = word.get("confidence", 0.0)
        height_ratio = word.get("height_ratio", 0.0)
        page_number = word.get("page_index", 0) + 1
        lines.append(
            f"- Page {page_number} | '{text}' | confiance={confidence:.2f} | hauteur_ratio={height_ratio:.3f}"
        )
    return "\n".join(lines)


async def evaluate_large_word_legibility(
    document_type: str, suspect_words: List[LargeWordInfo]
) -> EvaluationResult:
    """
    Utilise Gemini pour déterminer si les mots mal lus restent compréhensibles.
    """
    if not suspect_words:
        return {
            "llm_can_understand": True,
            "reason": "Aucun mot volumineux mal lu détecté.",
            "evaluated_word_count": 0,
        }

    words_summary = _format_words_for_prompt(suspect_words)
    prompt = (
        "Contexte: un document a été OCRisé. Les mots listés ci-dessous sont grands mais mal lus."
        f"\nType exact du document: {document_type}."
        "\nÉtape suivante: un autre LLM devra extraire des champs structurés (libellés + valeurs) à partir de ce document."
        "\nQuestion: la qualité actuelle de lecture (cf. liste) est-elle suffisante pour qu'un LLM affecte correctement les bons champs?"
        "\nRéponds objectivement, sans suppositions supplémentaires."
        '\nFormat de réponse UNIQUE (JSON strict): {"llm_can_understand": bool, "reason": "explication courte et neutre"}'
        "\nNe commente pas autre chose."
    )

    gemini_response = await extract_gemini(words_summary, prompt)
    if "error" in gemini_response:
        return {
            "llm_can_understand": True,
            "reason": f"Evaluation impossible ({gemini_response['error']})",
            "evaluated_word_count": min(len(suspect_words), MAX_WORDS_FOR_EVALUATION),
        }

    extracted = gemini_response.get("extracted_data", "{}")
    try:
        parsed = json.loads(extracted)
        llm_can_understand = bool(parsed.get("llm_can_understand", True))
        reason = str(parsed.get("reason", "")).strip() or "Motif non précisé."
        return {
            "llm_can_understand": llm_can_understand,
            "reason": reason,
            "evaluated_word_count": min(len(suspect_words), MAX_WORDS_FOR_EVALUATION),
        }
    except json.JSONDecodeError:
        return {
            "llm_can_understand": True,
            "reason": "Réponse Gemini illisible.",
            "evaluated_word_count": min(len(suspect_words), MAX_WORDS_FOR_EVALUATION),
        }

