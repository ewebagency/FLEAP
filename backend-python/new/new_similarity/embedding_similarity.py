from __future__ import annotations

import threading
from typing import Iterable, List

import numpy as np
from sentence_transformers import SentenceTransformer

from .new_similarity import calculate_tfidf_similarity

_MODEL: SentenceTransformer | None = None
_MODEL_LOCK = threading.Lock()
DEFAULT_EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


def _get_embedding_model() -> SentenceTransformer:
    global _MODEL
    if _MODEL is None:
        with _MODEL_LOCK:
            if _MODEL is None:
                _MODEL = SentenceTransformer(DEFAULT_EMBEDDING_MODEL, device="cpu")
    return _MODEL


def _encode_texts(texts: Iterable[str]) -> np.ndarray:
    model = _get_embedding_model()
    embeddings = model.encode(
        list(texts),
        convert_to_numpy=True,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    return np.asarray(embeddings, dtype=np.float32)


def encode_corpus(texts: List[str]) -> np.ndarray:
    """
    Encode une liste de textes en un seul batch.
    Retourne un tableau (n_docs, dim) normalisé.
    """
    return _encode_texts(texts)


def encode_query(text: str) -> np.ndarray:
    """
    Encode un seul texte (requête) et retourne un vecteur normalisé (dim,).
    """
    embeddings = _encode_texts([text])
    return embeddings[0]


def embedding_cosine_similarity(text1: str, text2: str) -> float:
    embeddings = _encode_texts([text1, text2])
    return float(np.dot(embeddings[0], embeddings[1]))


def hybrid_tfidf_embedding_similarity(text1: str, text2: str) -> float:
    tfidf_score = calculate_tfidf_similarity(text1, text2)
    embedding_score = embedding_cosine_similarity(text1, text2)
    return float((tfidf_score + embedding_score) / 2)

