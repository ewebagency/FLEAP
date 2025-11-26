from __future__ import annotations

import io
import zipfile
from dataclasses import dataclass
from tempfile import SpooledTemporaryFile
from typing import Callable, Dict, List, Optional, Tuple

import fitz  # type: ignore
from fastapi import UploadFile
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter

from utils.utils_doctr import group_lines, ocr_this_pdf_with_doctr

from .embedding_similarity import (
    embedding_cosine_similarity,
    encode_corpus,
    hybrid_tfidf_embedding_similarity,
)
from .new_similarity import (
    SEUIL_MAX_NON_MATCH,
    SEUIL_MIN_MATCH,
    calculate_tfidf_similarity,
)

# ⚠️ Remplacer le contenu de cette liste par votre vérité terrain.
# Vous pouvez coller le JSON fourni dans la demande utilisateur ici même.

GROUND_TRUTH_DATA: List[Dict[str, Optional[str]]] = [
    {"source": "facture_ECOBTP_ENVIRONNEMENT_Demathieu_Bard_B_timent_IDF_FACT_-_082025_st_germain_page_1.pdf.pdf", "voisin": "facture_Location_de_Bennes_Centre_de_tri_Demathieu_Bard_B_timent_IDF_facture_luxo-1.pdf"},
    {"source": "facture_RECYCLAGE_DE_L_OUEST__Groupe_Ravate_R2D2__FACT_7182_pages_1_to_2.pdf.pdf", "voisin": None},
    {"source": "facture_Location_de_Bennes_Centre_de_tri_Demathieu_Bard_B_timent_IDF_facture_luxo-1.pdf", "voisin": "facture_ECOBTP_ENVIRONNEMENT_Demathieu_Bard_B_timent_IDF_FACT_-_082025_st_germain_page_1.pdf.pdf"},
    {"source": "facture_PROSERVE_DASRI_CH_NIORT_PROSERVE-1-2.pdf", "voisin": None},
    {"source": "facture_AFM_Recyclage_Demosten_RA088_EPC_DEMOSTEN_SEGRE_EN_ANJOU_20251030.pdf", "voisin": None},
    {"source": "facture_TRI_N_COLLECT_ORLEANS_Bouygues_B_timent_Centre_Sud-Ouest_TNC_-_Factures_chantier_Jean_Monnet_Luisant_page_32.pdf.pdf", "voisin": None},
    {"source": "facture_PASSENAUD_DENIS_SAS_Bouygues_B_timent_Centre_Sud-Ouest_FV_06-25080748.pdf", "voisin": None},
    {"source": "facture_CEP_SOLUTIONS_CEP_Solutions_CEP_SOL_25050074.Zeendoc.pdf", "voisin": None},
    {"source": "facture_L2T_Groupe_Ravate_R2D2__25-0422_page_1.pdf", "voisin": None},
    {"source": "facture_STS_Groupe_Ravate_R2D2__R2D2_25108260_BL.pdf", "voisin": None},
    {"source": "facture_SARL_RUN_ENVIRONNEMENT_SBTPC_SOGEA_REUNION_IMAGE-17847_22548-1655906856-FC6143_-_SBTPC_SOGEA_REUNION_-_SEP_50.pdf", "voisin": None},
    {"source": "facture_ROUVREAU_RECYCLAGE_CH_NIORT_ROUVREAU-1-3.pdf", "voisin": None},
    {"source": "facture_CHIMIREC_MASSIF_CENTRAL_CEP_Solutions_05062025172558160-DOC050625.Zeendoc.pdf", "voisin": None},
    {"source": "facture_CYCLEA_Groupe_Ravate_R2D2__F-25-08-00075_R2D2_pages_1_to_3.pdf", "voisin": None},
    {"source": "facture_NTCS_Groupe_Ravate_R2D2__Facture_FAC00003524.pdf", "voisin": None},
    {"source": "facture_AC2V_SERVICE_Groupe_Ravate_R2D2__FC25_01475_pages_1_to_2.pdf", "voisin": None},
    {"source": "facture_Bourgogne_Recyclage__Ter_lian_0796_001 (1).pdf", "voisin": "facture_Bourgogne_Recyclage__Ter_lian_0796_001.pdf"},
    {"source": "facture_Bourgogne_Recyclage__Ter_lian_0796_001.pdf", "voisin": "facture_Bourgogne_Recyclage__Ter_lian_0796_001 (1).pdf"},
    {"source": "facture_Suez_Espace_D_mo_exemple_facture_2_1_.pdf", "voisin": "facture_SUEZ_RV_CENTRE_OUEST_Bouygues_B_timent_Centre_Sud-Ouest_Facture_N_G060286483.pdf"},
    {"source": "facture_PAPREC_GRAND_OUEST_Eiffage_nergie_Syst_mes_250330_PAPREC_Bordereau_achats.pdf", "voisin": "facture_PAPREC_GRAND_OUEST_Eiffage_nergie_Syst_mes_240430_PAPREC_REN24040424-3.pdf"},
    {"source": "facture_CTSP_CENTRE_Bouygues_B_timent_Centre_Sud-Ouest_BOU00294962_20251015_150057.pdf", "voisin": "facture_CTSP_CENTRE_Bouygues_B_timent_Centre_Sud-Ouest_BOU00295818_20251015_150106.pdf"},
    {"source": "facture_CTSP_CENTRE_Bouygues_B_timent_Centre_Sud-Ouest_BOU00295818_20251015_150106.pdf", "voisin": "facture_CTSP_CENTRE_Bouygues_B_timent_Centre_Sud-Ouest_BOU00294962_20251015_150057.pdf"},
    {"source": "facture_PAPREC_GRAND_ILE_DE_FRANCE_Groupe_IDEC_203422.pdf", "voisin": "facture_PAPREC_GRAND_ILE_DE_FRANCE_GENNEVILLIERS__Demathieu_Bard_B_timent_IDF_202747.pdf"},
    {"source": "facture_SUEZ_RV_CENTRE_OUEST_Bouygues_B_timent_Centre_Sud-Ouest_Facture_N_G060286483.pdf", "voisin": "facture_SUEZ_RV_CENTRE_OUEST_Bouygues_B_timent_Centre_Sud-Ouest_Facture_N_G060290302.pdf"},
    {"source": "facture_PAPREC_GRAND_ILE_DE_FRANCE_GENNEVILLIERS__Demathieu_Bard_B_timent_IDF_GEN25090389_pages_1_to_2.pdf.pdf", "voisin": "facture_PAPREC_GRAND_ILE_DE_FRANCE_Groupe_IDEC_GEN25090462.pdf"},
    {"source": "facture_SUEZ_RV_CENTRE_OUEST_Bouygues_B_timent_Centre_Sud-Ouest_Facture_N_G060290302.pdf", "voisin": "facture_SUEZ_RV_CENTRE_OUEST_Bouygues_B_timent_Centre_Sud-Ouest_Facture_N_G060291038 (1).pdf"},
    {"source": "facture_SUEZ_RV_CENTRE_OUEST_Bouygues_B_timent_Centre_Sud-Ouest_Facture_N_G060291038 (1).pdf", "voisin": "facture_SUEZ_RV_CENTRE_OUEST_Bouygues_B_timent_Centre_Sud-Ouest_Facture_N_G060291038.pdf"},
    {"source": "facture_SUEZ_RV_CENTRE_OUEST_Bouygues_B_timent_Centre_Sud-Ouest_Facture_N_G060291038.pdf", "voisin": "facture_SUEZ_RV_CENTRE_OUEST_Bouygues_B_timent_Centre_Sud-Ouest_Facture_N_G060291038 (1).pdf"},
    {"source": "facture_SUEZ_RV_CENTRE_OUEST_Bouygues_B_timent_Centre_Sud-Ouest_Facture_N_G060291039.pdf", "voisin": "facture_SUEZ_RV_CENTRE_OUEST_Bouygues_B_timent_Centre_Sud-Ouest_Facture_N_G060285394.pdf"},
    {"source": "facture_SUEZ_RV_CENTRE_OUEST_Bouygues_B_timent_Centre_Sud-Ouest_Facture_N_G060285394.pdf", "voisin": "facture_SUEZ_RV_CENTRE_OUEST_Bouygues_B_timent_Centre_Sud-Ouest_Facture_N_G060291039.pdf"},
    {"source": "facture_VALORUN_SBTPC_SOGEA_REUNION_IMAGE-17847_22548-1652176998-S2R_SOGEREP_2509-4438 (1).pdf", "voisin": "facture_VALORUN_SBTPC_SOGEA_REUNION_IMAGE-17847_22548-1652176998-S2R_SOGEREP_2509-4438.pdf"},
    {"source": "facture_VALORUN_SBTPC_SOGEA_REUNION_IMAGE-17847_22548-1652176998-S2R_SOGEREP_2509-4438.pdf", "voisin": "facture_VALORUN_SBTPC_SOGEA_REUNION_IMAGE-17847_22548-1652176998-S2R_SOGEREP_2509-4438 (1).pdf"},
    {"source": "facture_PAPREC_GRAND_OUEST_Eiffage_nergie_Syst_mes_240229_PAPREC_REN24020467-3.pdf", "voisin": "facture_PAPREC_GRAND_OUEST_Eiffage_nergie_Syst_mes_240430_PAPREC_REN24040424-3.pdf"},
    {"source": "facture_VALORUN_SBTPC_SOGEA_REUNION_IMAGE-17847_22548-1670643288-SBTPC_O2513_F2510-4890.pdf", "voisin": "facture_VALORUN_SBTPC_SOGEA_REUNION_IMAGE-17847_22548-1657044947-SBTPC_R406_F2509-4507.pdf"},
    {"source": "facture_PAPREC_GRAND_OUEST_Eiffage_nergie_Syst_mes_240430_PAPREC_REN24040424-3.pdf", "voisin": "facture_PAPREC_GRAND_OUEST_Eiffage_nergie_Syst_mes_240229_PAPREC_REN24020467-3.pdf"},
    {"source": "facture_VALORUN_SBTPC_SOGEA_REUNION_IMAGE-17847_22548-1657044947-SBTPC_R406_F2509-4507.pdf", "voisin": "facture_VALORUN_SBTPC_SOGEA_REUNION_IMAGE-17847_22548-1670643288-SBTPC_O2513_F2510-4890.pdf"},
    {"source": "facture_PAPREC_GRAND_OUEST_Eiffage_nergie_Syst_mes_PAPREC_REN25060966-1.pdf", "voisin": "facture_PAPREC_GRAND_OUEST_Eiffage_nergie_Syst_mes_240131_PAPREC_REN24010477-1.pdf"},
    {"source": "facture_PAPREC_GRAND_OUEST_Eiffage_nergie_Syst_mes_240731_PAPREC_REN24070386-1.pdf", "voisin": "facture_PAPREC_GRAND_OUEST_Eiffage_nergie_Syst_mes_240131_PAPREC_REN24010477-1.pdf"},
    {"source": "facture_PAPREC_GRAND_OUEST_Eiffage_nergie_Syst_mes_240131_PAPREC_REN24010477-1.pdf", "voisin": "facture_PAPREC_GRAND_OUEST_Eiffage_nergie_Syst_mes_240731_PAPREC_REN24070386-1.pdf"},
    {"source": "facture_PAPREC_GRAND_ILE_DE_FRANCE_Groupe_IDEC_GEN25090462.pdf", "voisin": "facture_PAPREC_GRAND_ILE_DE_FRANCE_GENNEVILLIERS__Demathieu_Bard_B_timent_IDF_GEN25090389_pages_1_to_2.pdf.pdf"},
    {"source": "facture_PAPREC_GRAND_ILE_DE_FRANCE_GENNEVILLIERS__Demathieu_Bard_B_timent_IDF_202747.pdf", "voisin": "facture_PAPREC_GRAND_ILE_DE_FRANCE_Groupe_IDEC_203422.pdf"}
]

EXPECTED_NEIGHBORS: List[Dict[str, Optional[str]]] = GROUND_TRUTH_DATA
EXPECTED_NEIGHBOR_MAP: Dict[str, Optional[str]] = {
    entry["source"]: entry["voisin"] for entry in EXPECTED_NEIGHBORS
}

DEFAULT_MIN_THRESHOLD = SEUIL_MIN_MATCH
DEFAULT_MAX_THRESHOLD = SEUIL_MAX_NON_MATCH
MEDIUM_MIN_THRESHOLD = round(SEUIL_MIN_MATCH + 0.07, 2)
HIGH_MIN_THRESHOLD = round(SEUIL_MIN_MATCH + 0.12, 2)

SIMILARITY_FUNCTIONS: Dict[str, Callable[[str, str], float]] = {
    "tfidf": calculate_tfidf_similarity,
    "embedding": embedding_cosine_similarity,
    "hybrid": hybrid_tfidf_embedding_similarity,
    # "rrf" et "retrieval_rerank" ont leur logique dédiée plus bas
}

MODE_CONFIG = [
    {
        "key": "mode1_all_pages",
        "label": "Mode 1 - Toutes pages (OCR) seuil par défaut",
        "include_all_pages": True,
        "allow_ocr_fallback": True,
        "min_threshold": DEFAULT_MIN_THRESHOLD,
        "max_threshold": DEFAULT_MAX_THRESHOLD,
        "strategy": "tfidf",
    },
    {
        "key": "mode1_all_pages_medium_threshold",
        "label": "Mode 1 - Toutes pages (OCR) seuil +0.07",
        "include_all_pages": True,
        "allow_ocr_fallback": True,
        "min_threshold": MEDIUM_MIN_THRESHOLD,
        "max_threshold": DEFAULT_MAX_THRESHOLD,
        "strategy": "tfidf",
    },
    {
        "key": "mode1_all_pages_high_threshold",
        "label": "Mode 1 - Toutes pages (OCR) seuil +0.12",
        "include_all_pages": True,
        "allow_ocr_fallback": True,
        "min_threshold": HIGH_MIN_THRESHOLD,
        "max_threshold": DEFAULT_MAX_THRESHOLD,
        "strategy": "tfidf",
    },
    {
        "key": "mode_embedding",
        "label": "Mode 2 - Embedding (toutes pages)",
        "include_all_pages": True,
        "allow_ocr_fallback": True,
        "min_threshold": 0.85,
        "max_threshold": 0.30,
        "strategy": "embedding",
    },
    {
        "key": "mode_hybrid",
        "label": "Mode 3 - Hybride TF-IDF + Embedding",
        "include_all_pages": True,
        "allow_ocr_fallback": True,
        "min_threshold": 0.52,
        "max_threshold": 0.25,
        "strategy": "hybrid",
    },
    {
        "key": "mode_rrf",
        "label": "Mode 4 - RRF TF-IDF + Embedding",
        "include_all_pages": True,
        "allow_ocr_fallback": True,
        "min_threshold": 0.020,
        "max_threshold": 0.005,
        "strategy": "rrf",
    },
    {
        "key": "mode_retrieval_rerank",
        "label": "Mode 5 - Retrieval TF-IDF + Rerank Embedding",
        "include_all_pages": True,
        "allow_ocr_fallback": True,
        "min_threshold": 0.65,
        "max_threshold": 0.25,
        "strategy": "retrieval_rerank",
    },
    {
        "key": "mode_retrieval_rerank_norm",
        "label": "Mode 6 - Retrieval TF-IDF + Rerank Embedding (norm + 0.7/0.3)",
        "include_all_pages": True,
        "allow_ocr_fallback": True,
        "min_threshold": 0.65,
        "max_threshold": 0.25,
        "strategy": "retrieval_rerank_norm",
    },
]


@dataclass
class DocumentSimilarity:
    source: str
    closest_candidate: Optional[str]
    similarity_score: float
    found_neighbor: bool
    status: str
    expected_neighbor: Optional[str]
    matches_expectation: bool
    notes: str


def _extract_first_page_text(pdf_bytes: bytes) -> str:
    try:
        with fitz.open(stream=pdf_bytes, filetype="pdf") as document:
            if document.page_count == 0:
                return ""
            first_page = document.load_page(0)
            text_content = first_page.get_text("text") or ""
            return text_content.strip()
    except Exception as error:  # pragma: no cover - logging only
        print(f"❌ Impossible d'extraire le texte du PDF: {error}")
        return ""


def _extract_first_page_text_from_ocr(raw_result: dict) -> str:
    pages = raw_result.get("pages", []) if isinstance(raw_result, dict) else []
    if not pages:
        return ""

    first_page = pages[0]
    collected_lines: List[str] = []
    for block in first_page.get("blocks", []):
        for line in block.get("lines", []):
            words = [word.get("value", "") for word in line.get("words", [])]
            line_text = " ".join(filter(None, words)).strip()
            if line_text:
                collected_lines.append(line_text)
    return "\n".join(collected_lines)


async def _run_ocr(pdf_bytes: bytes, filename: str) -> dict:
    temp_file = SpooledTemporaryFile()
    temp_file.write(pdf_bytes)
    temp_file.seek(0)
    upload = UploadFile(filename=filename, file=temp_file)
    try:
        ocr_result = await ocr_this_pdf_with_doctr(upload)
    finally:
        await upload.close()

    return ocr_result if isinstance(ocr_result, dict) else {}


def _extract_all_pages_text(pdf_bytes: bytes) -> str:
    try:
        with fitz.open(stream=pdf_bytes, filetype="pdf") as document:
            if document.page_count == 0:
                return ""
            pages_text = []
            for page_index in range(document.page_count):
                page = document.load_page(page_index)
                pages_text.append(page.get_text("text") or "")
            text_content = "\n".join(pages_text)
            return text_content.strip()
    except Exception as error:  # pragma: no cover - logging only
        print(f"❌ Impossible d'extraire le texte complet du PDF: {error}")
        return ""


async def _extract_text_with_strategy(
    pdf_bytes: bytes,
    filename: str,
    include_all_pages: bool,
    allow_ocr_fallback: bool,
) -> str:
    parsed_text = (
        _extract_all_pages_text(pdf_bytes)
        if include_all_pages
        else _extract_first_page_text(pdf_bytes)
    )

    if parsed_text.strip():
        return parsed_text

    if not allow_ocr_fallback:
        return ""

    ocr_result = await _run_ocr(pdf_bytes, filename)
    raw_result = ocr_result.get("raw_result")

    if raw_result:
        if include_all_pages:
            from utils.utils_doctr import group_lines  # type: ignore

            ocr_full_text = group_lines(raw_result)
            if ocr_full_text.strip():
                return ocr_full_text
        else:
            ocr_first_page = _extract_first_page_text_from_ocr(raw_result)
            if ocr_first_page.strip():
                return ocr_first_page

    return ocr_result.get("text", "") if isinstance(ocr_result, dict) else ""


async def _collect_pdf_texts(
    zip_bytes: bytes,
    include_all_pages: bool,
    allow_ocr_fallback: bool,
) -> Dict[str, str]:
    texts: Dict[str, str] = {}
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as archive:
        for info in archive.infolist():
            filename = info.filename
            if info.is_dir() or not filename.lower().endswith(".pdf"):
                continue
            pdf_bytes = archive.read(filename)
            extracted_text = await _extract_text_with_strategy(
                pdf_bytes,
                filename,
                include_all_pages=include_all_pages,
                allow_ocr_fallback=allow_ocr_fallback,
            )
            texts[filename] = extracted_text
    return texts


def _find_closest_neighbor_with_thresholds(
    subject_text: str,
    candidate_texts: List[str],
    candidate_names: List[str],
    min_threshold: float,
    max_threshold: float,
    similarity_func: Callable[[str, str], float],
) -> Dict[str, Optional[str]]:
    if not candidate_texts:
        return {
            "found": False,
            "similarity_score": 0.0,
            "neighbor_id": None,
            "best_neighbor_id": None,
            "status": "Aucun voisin fourni",
        }

    similarities: List[float] = []
    for candidate in candidate_texts:
        score = similarity_func(subject_text, candidate)
        similarities.append(score)

    best_score = max(similarities)
    best_index = similarities.index(best_score)
    best_neighbor_id = candidate_names[best_index]

    if best_score >= min_threshold:
        status = f"Voisin trouvé (score >= {min_threshold})"
        found = True
        neighbor_id = best_neighbor_id
    elif best_score <= max_threshold:
        status = f"Aucun voisin (score <= {max_threshold})"
        found = False
        neighbor_id = None
    else:
        status = "Voisin potentiel (score intermédiaire)"
        found = False
        neighbor_id = None

    return {
        "found": found,
        "similarity_score": best_score,
        "neighbor_id": neighbor_id,
        "best_neighbor_id": best_neighbor_id,
        "status": status,
    }


def _compare_with_neighbors(
    texts: Dict[str, str],
    min_threshold: float,
    max_threshold: float,
    similarity_strategy: str,
) -> List[DocumentSimilarity]:
    similarity_func = SIMILARITY_FUNCTIONS.get(
        similarity_strategy, calculate_tfidf_similarity
    )
    filenames = list(texts.keys())
    corpus = [texts[name] for name in filenames]
    embeddings = None

    if similarity_strategy in {
        "embedding",
        "hybrid",
        "rrf",
        "retrieval_rerank",
        "retrieval_rerank_norm",
    }:
        embeddings = encode_corpus(corpus)

    results: List[DocumentSimilarity] = []
    for source_index, source_name in enumerate(filenames):
        source_text = texts[source_name]
        candidate_names = [name for name in filenames if name != source_name]
        candidate_texts = [texts[name] for name in candidate_names]

        if not source_text.strip():
            results.append(
                DocumentSimilarity(
                    source=source_name,
                    closest_candidate=None,
                    similarity_score=0.0,
                    found_neighbor=False,
                    status="Texte de la page 1 vide",
                    expected_neighbor=EXPECTED_NEIGHBOR_MAP.get(source_name),
                    matches_expectation=EXPECTED_NEIGHBOR_MAP.get(source_name) is None,
                    notes="Impossible de calculer la similarité sans texte",
                )
            )
            continue

        if not candidate_texts:
            results.append(
                DocumentSimilarity(
                    source=source_name,
                    closest_candidate=None,
                    similarity_score=0.0,
                    found_neighbor=False,
                    status="Aucun autre PDF dans l'archive",
                    expected_neighbor=EXPECTED_NEIGHBOR_MAP.get(source_name),
                    matches_expectation=EXPECTED_NEIGHBOR_MAP.get(source_name) is None,
                    notes="Archive trop petite pour établir un voisin",
                )
            )
            continue

        # Stratégies utilisant directement les embeddings (embedding, hybrid, rrf, retrieval_rerank)
        if embeddings is not None and similarity_strategy in {
            "embedding",
            "hybrid",
            "rrf",
            "retrieval_rerank",
            "retrieval_rerank_norm",
        }:
            source_vec = embeddings[source_index]
            candidate_indices = [filenames.index(name) for name in candidate_names]
            candidate_vecs = embeddings[candidate_indices]
            cosine_scores = candidate_vecs @ source_vec

            best_score = float(cosine_scores.max())
            best_index = int(cosine_scores.argmax())
            best_neighbor_id = candidate_names[best_index]

            if similarity_strategy == "hybrid":
                # Combinaison moyenne simple TF-IDF / embedding (meilleure paire TF-IDF)
                tfidf_scores = [
                    calculate_tfidf_similarity(source_text, texts[name])
                    for name in candidate_names
                ]
                tfidf_best_score = max(tfidf_scores)
                best_score = float((best_score + tfidf_best_score) / 2)
                best_index = tfidf_scores.index(tfidf_best_score)
                best_neighbor_id = candidate_names[best_index]

            elif similarity_strategy == "rrf":
                # Reciprocal Rank Fusion entre classement TF-IDF et embedding
                k_rrf = 60.0
                tfidf_scores = [
                    calculate_tfidf_similarity(source_text, texts[name])
                    for name in candidate_names
                ]

                # Rangs (1 = meilleur)
                sorted_tfidf = sorted(
                    zip(tfidf_scores, candidate_names), key=lambda x: x[0], reverse=True
                )
                sorted_embed = sorted(
                    zip(list(cosine_scores), candidate_names),
                    key=lambda x: x[0],
                    reverse=True,
                )

                tfidf_rank: Dict[str, int] = {
                    name: idx + 1 for idx, (_, name) in enumerate(sorted_tfidf)
                }
                embed_rank: Dict[str, int] = {
                    name: idx + 1 for idx, (_, name) in enumerate(sorted_embed)
                }

                rrf_scores: Dict[str, float] = {}
                for name in candidate_names:
                    r_tfidf = tfidf_rank.get(name, len(candidate_names) + 1)
                    r_embed = embed_rank.get(name, len(candidate_names) + 1)
                    rrf_scores[name] = 1.0 / (k_rrf + r_tfidf) + 1.0 / (k_rrf + r_embed)

                best_neighbor_id = max(rrf_scores.items(), key=lambda x: x[1])[0]
                best_score = float(rrf_scores[best_neighbor_id])

            elif similarity_strategy in {"retrieval_rerank", "retrieval_rerank_norm"}:
                # Retrieval large TF-IDF → reranking embedding
                tfidf_scores = [
                    calculate_tfidf_similarity(source_text, texts[name])
                    for name in candidate_names
                ]
                # Top-K large par TF-IDF
                k_ret = min(30, len(candidate_names))
                sorted_tfidf = sorted(
                    zip(tfidf_scores, candidate_names), key=lambda x: x[0], reverse=True
                )[:k_ret]
                topk_names = [name for _, name in sorted_tfidf]
                topk_indices = [filenames.index(name) for name in topk_names]
                topk_vecs = embeddings[topk_indices]
                topk_cos = topk_vecs @ source_vec

                # Rerank : fusion embedding / TF-IDF sur le top-K
                rerank_scores: Dict[str, float] = {}
                for score_embed, name in zip(topk_cos, topk_names):
                    tfidf_val = calculate_tfidf_similarity(source_text, texts[name])
                    rerank_scores[name] = float((score_embed + tfidf_val) / 2)

                if similarity_strategy == "retrieval_rerank_norm":
                    # Normalisation min-max indépendante pour chaque source
                    emb_vals = [topk_cos[topk_names.index(name)] for name in topk_names]
                    tfidf_vals = [
                        calculate_tfidf_similarity(source_text, texts[name])
                        for name in topk_names
                    ]

                    def _min_max(values: List[float]) -> List[float]:
                        v_min = min(values)
                        v_max = max(values)
                        if v_max <= v_min:
                            return [0.0 for _ in values]
                        return [(v - v_min) / (v_max - v_min) for v in values]

                    emb_norm = _min_max(emb_vals)
                    tfidf_norm = _min_max(tfidf_vals)

                    rerank_scores = {}
                    for idx, name in enumerate(topk_names):
                        score = 0.7 * emb_norm[idx] + 0.3 * tfidf_norm[idx]
                        rerank_scores[name] = float(score)

                best_neighbor_id = max(
                    rerank_scores.items(), key=lambda x: x[1]
                )[0]
                best_score = float(rerank_scores[best_neighbor_id])

            if best_score >= min_threshold:
                status = f"Voisin trouvé (score >= {min_threshold})"
                found = True
                neighbor_id = best_neighbor_id
            elif best_score <= max_threshold:
                status = f"Aucun voisin (score <= {max_threshold})"
                found = False
                neighbor_id = None
            else:
                status = "Voisin potentiel (score intermédiaire)"
                found = False
                neighbor_id = None

            similarity_result = {
                "found": found,
                "similarity_score": best_score,
                "neighbor_id": neighbor_id,
                "best_neighbor_id": best_neighbor_id,
                "status": status,
            }
        else:
            similarity_result = _find_closest_neighbor_with_thresholds(
                source_text,
                candidate_texts,
                candidate_names,
                min_threshold=min_threshold,
                max_threshold=max_threshold,
                similarity_func=similarity_func,
            )

        closest_candidate = similarity_result.get("best_neighbor_id")
        found_neighbor = bool(similarity_result.get("found"))
        matched_neighbor = (
            closest_candidate if found_neighbor else None
        )
        expected_neighbor = EXPECTED_NEIGHBOR_MAP.get(source_name)
        matches_expectation = (
            expected_neighbor == matched_neighbor
            if expected_neighbor is not None
            else matched_neighbor is None
        )

        notes = (
            "Score sous le seuil, voisin non validé"
            if not found_neighbor and closest_candidate
            else ""
        )

        results.append(
            DocumentSimilarity(
                source=source_name,
                closest_candidate=closest_candidate,
                similarity_score=float(similarity_result.get("similarity_score", 0.0)),
                found_neighbor=found_neighbor,
                status=str(similarity_result.get("status", "")),
                expected_neighbor=expected_neighbor,
                matches_expectation=matches_expectation,
                notes=notes,
            )
        )
    return results


def _autofit_columns(worksheet) -> None:
    for column_cells in worksheet.columns:
        column = get_column_letter(column_cells[0].column)
        max_length = 0
        for cell in column_cells:
            cell_value = str(cell.value) if cell.value is not None else ""
            if len(cell_value) > max_length:
                max_length = len(cell_value)
        worksheet.column_dimensions[column].width = min(max_length + 2, 80)


def _build_sheet(
    sheet,
    results: List[DocumentSimilarity],
    label: str,
    min_threshold: float,
    max_threshold: float,
    strategy: str,
) -> None:
    summary = (
        f"{label} | stratégie={strategy} | seuil_min={min_threshold:.2f} | "
        f"seuil_non_match={max_threshold:.2f}"
    )
    sheet.append([summary])
    sheet.merge_cells(start_row=1, start_column=1, end_row=1, end_column=8)
    sheet["A1"].font = Font(bold=True)
    sheet["A1"].fill = PatternFill(
        start_color="FFCCE5FF",
        end_color="FFCCE5FF",
        fill_type="solid",
    )

    total_results = len(results)
    matched_results = sum(1 for item in results if item.matches_expectation)
    match_ratio = (matched_results / total_results * 100) if total_results else 0.0
    stats_text = (
        f"Correspondances ground truth: {match_ratio:.1f}% "
        f"({matched_results}/{total_results})"
    )
    sheet.append([stats_text])
    sheet.merge_cells(start_row=2, start_column=1, end_row=2, end_column=8)
    sheet["A2"].font = Font(bold=True)
    sheet["A2"].fill = PatternFill(
        start_color="FFE2FFE5",
        end_color="FFE2FFE5",
        fill_type="solid",
    )

    headers = [
        "Source",
        "Voisin proposé",
        "Score",
        "Voisin validé",
        "Statut",
        "Voisin attendu",
        "Correspond à l'attendu",
        "Notes",
    ]
    sheet.append(headers)

    header_row_index = 3
    header_fill = PatternFill(start_color="FF1F4E78", end_color="FF1F4E78", fill_type="solid")
    header_font = Font(color="FFFFFFFF", bold=True)
    for cell in sheet[header_row_index]:
        cell.fill = header_fill
        cell.font = header_font

    for item in results:
        sheet.append(
            [
                item.source,
                item.closest_candidate or "",
                round(item.similarity_score, 4),
                "oui" if item.found_neighbor else "non",
                item.status,
                item.expected_neighbor or "",
                "oui" if item.matches_expectation else "non",
                item.notes,
            ]
        )

    match_fill = PatternFill(start_color="FFDFF6DD", end_color="FFDFF6DD", fill_type="solid")
    mismatch_fill = PatternFill(start_color="FFF8D7DA", end_color="FFF8D7DA", fill_type="solid")
    warning_fill = PatternFill(start_color="FFFFF4CE", end_color="FFFFF4CE", fill_type="solid")

    data_start_row = header_row_index + 1
    for index, item in enumerate(results, start=data_start_row):
        if "vide" in item.status.lower() or "archive" in item.status.lower():
            row_fill = warning_fill
        elif item.matches_expectation:
            row_fill = match_fill
        else:
            row_fill = mismatch_fill

        for cell in sheet[index]:
            cell.fill = row_fill

    _autofit_columns(sheet)


def _build_excel(results_by_mode: Dict[str, List[DocumentSimilarity]]) -> bytes:
    workbook = Workbook()
    first_sheet = True
    for config in MODE_CONFIG:
        sheet_name = config["key"][:31]
        sheet = workbook.active if first_sheet else workbook.create_sheet(title=sheet_name)
        sheet.title = sheet_name
        _build_sheet(
            sheet,
            results_by_mode.get(config["key"], []),
            label=config["label"],
            min_threshold=config["min_threshold"],
            max_threshold=config["max_threshold"],
            strategy=config["strategy"],
        )
        first_sheet = False

    buffer = io.BytesIO()
    workbook.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()


async def generate_zip_similarity_report(zip_upload: UploadFile) -> Tuple[Dict[str, List[DocumentSimilarity]], bytes]:
    archive_bytes = await zip_upload.read()
    results_by_mode: Dict[str, List[DocumentSimilarity]] = {}
    texts_cache: Dict[tuple[bool, bool], Dict[str, str]] = {}

    for config in MODE_CONFIG:
        cache_key = (config["include_all_pages"], config["allow_ocr_fallback"])
        if cache_key not in texts_cache:
            texts_cache[cache_key] = await _collect_pdf_texts(
                archive_bytes,
                include_all_pages=config["include_all_pages"],
                allow_ocr_fallback=config["allow_ocr_fallback"],
            )
        texts = texts_cache[cache_key]
        results_by_mode[config["key"]] = _compare_with_neighbors(
            texts,
            min_threshold=config["min_threshold"],
            max_threshold=config["max_threshold"],
            similarity_strategy=config["strategy"],
        )

    excel_bytes = _build_excel(results_by_mode)
    return results_by_mode, excel_bytes

