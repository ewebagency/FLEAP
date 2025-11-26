from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import numpy as np

from .embedding_similarity import encode_corpus, encode_query
from .new_similarity import SEUIL_MAX_NON_MATCH, SEUIL_MIN_MATCH, calculate_tfidf_similarity


@dataclass
class NeighborResult:
    found: bool
    neighbor_id: Optional[Any]
    best_neighbor_id: Optional[Any]
    similarity_score: float
    status: str


def _build_result(
    best_score: float,
    best_neighbor_id: Optional[Any],
    min_threshold: float,
    max_threshold: float,
) -> NeighborResult:
    if best_neighbor_id is None:
        return NeighborResult(
            found=False,
            neighbor_id=None,
            best_neighbor_id=None,
            similarity_score=0.0,
            status="Aucun voisin fourni",
        )

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

    return NeighborResult(
        found=found,
        neighbor_id=neighbor_id,
        best_neighbor_id=best_neighbor_id,
        similarity_score=float(best_score),
        status=status,
    )


def find_closest_neighbor_retrieval_rerank(
    subject_text: str,
    neighbor_texts: List[str],
    neighbor_ids: Optional[List[Any]] = None,
    neighbor_embeddings: Optional[List[List[float]]] = None,
    top_k: int = 30,
    min_threshold: float = 0.65,
    max_threshold: float = 0.25,
) -> Dict[str, Any]:
    """
    Mode retrieval + reranking :
    1) Retrieval large avec TF-IDF sur tout le corpus.
    2) Reranking du top-K avec embeddings (cosinus) combinés à TF-IDF.

    La combinaison se fait par moyenne simple des deux scores sur le top-K.
    """
    if not neighbor_texts:
        return {
            "found": False,
            "neighbor_id": None,
            "best_neighbor_id": None,
            "similarity_score": 0.0,
            "status": "Aucun voisin fourni",
        }

    if neighbor_ids is None:
        neighbor_ids = list(range(len(neighbor_texts)))

    if len(neighbor_texts) != len(neighbor_ids):
        raise ValueError("Le nombre de textes voisins doit correspondre au nombre d'IDs")

    # Retrieval large avec TF-IDF
    tfidf_scores: List[float] = []
    for text in neighbor_texts:
        score = calculate_tfidf_similarity(subject_text, text)
        tfidf_scores.append(score)

    # Top-K indices par TF-IDF
    k = min(top_k, len(neighbor_texts))
    sorted_indices = sorted(
        range(len(neighbor_texts)),
        key=lambda idx: tfidf_scores[idx],
        reverse=True,
    )[:k]

    if not sorted_indices:
        return {
            "found": False,
            "neighbor_id": None,
            "best_neighbor_id": None,
            "similarity_score": 0.0,
            "status": "Aucun voisin après filtrage TF-IDF",
        }

    topk_texts = [neighbor_texts[idx] for idx in sorted_indices]
    topk_ids = [neighbor_ids[idx] for idx in sorted_indices]
    topk_tfidf = [tfidf_scores[idx] for idx in sorted_indices]

    # Embeddings pour subject + top-K voisins
    if neighbor_embeddings is not None and len(neighbor_embeddings) == len(neighbor_texts):
        topk_vecs = np.asarray(
            [neighbor_embeddings[idx] for idx in sorted_indices],
            dtype=np.float32,
        )
        subject_vec = encode_query(subject_text)
    else:
        embeddings = encode_corpus([subject_text] + topk_texts)
        subject_vec = embeddings[0]
        topk_vecs = embeddings[1:]

    # Similarités cosinus embeddings
    cosine_scores = topk_vecs @ subject_vec

    # Fusion simple : moyenne TF-IDF / embedding
    fused_scores: List[float] = []
    for score_embed, score_tfidf in zip(cosine_scores, topk_tfidf):
        fused_scores.append(float((score_embed + score_tfidf) / 2.0))

    best_local_index = int(np.argmax(fused_scores))
    best_score = fused_scores[best_local_index]
    best_neighbor_id = topk_ids[best_local_index]

    result = _build_result(
        best_score=best_score,
        best_neighbor_id=best_neighbor_id,
        min_threshold=min_threshold,
        max_threshold=max_threshold,
    )

    if result.found:
        print(
            f"🧠 retrieval_rerank_v2 | voisin trouvé via embeddings "
            f"(score_fusion={result.similarity_score:.3f}, id={result.best_neighbor_id})"
        )

    return {
        "found": result.found,
        "neighbor_id": result.neighbor_id,
        "best_neighbor_id": result.best_neighbor_id,
        "similarity_score": result.similarity_score,
        "status": result.status,
    }


