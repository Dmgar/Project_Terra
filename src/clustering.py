"""
Módulo para entrenamiento y evaluación de algoritmos de clustering
en Project Terra.
"""

from typing import Dict, Any, Tuple, Optional, Sequence
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans, AgglomerativeClustering
from sklearn.metrics import silhouette_score, davies_bouldin_score
from scipy.cluster.hierarchy import linkage, dendrogram
import matplotlib.pyplot as plt


def find_optimal_k(
    X: np.ndarray,
    k_range: Sequence[int] = range(2, 11),
    sample_size_silhouette: Optional[int] = 5000,
    random_state: int = 42,
) -> pd.DataFrame:
    """
    Evalúa métricas de clustering (Inercia, Silueta y Davies-Bouldin)
    para un rango de valores de K usando K-Means.

    Args:
        X: Matriz de características preprocesadas/escaladas.
        k_range: Secuencia o rango de K a evaluar.
        sample_size_silhouette: Muestra opcional para acelerar el cálculo del score de silueta.
        random_state: Semilla para reproducibilidad.

    Returns:
        DataFrame con columnas ['k', 'inertia', 'silhouette', 'davies_bouldin']
    """
    metrics = []

    for k in k_range:
        kmeans = KMeans(n_clusters=k, random_state=random_state, n_init=10)
        labels = kmeans.fit_predict(X)

        inertia = kmeans.inertia_
        
        # Silhouette Score (con sample_size para escalabilidad en grandes datasets)
        if sample_size_silhouette and len(X) > sample_size_silhouette:
            sil = silhouette_score(
                X, labels, sample_size=sample_size_silhouette, random_state=random_state
            )
        else:
            sil = silhouette_score(X, labels)

        db = davies_bouldin_score(X, labels)

        metrics.append({
            "k": k,
            "inertia": inertia,
            "silhouette": sil,
            "davies_bouldin": db,
        })

    return pd.DataFrame(metrics)


def run_kmeans(
    X: np.ndarray,
    k: int,
    random_state: int = 42,
) -> Tuple[np.ndarray, KMeans]:
    """
    Ajusta un modelo K-Means con un K específico.

    Args:
        X: Matriz de características escaladas.
        k: Número de clústeres.
        random_state: Semilla para reproducibilidad.

    Returns:
        Tupla (labels_asignados, modelo_kmeans_entrenado)
    """
    model = KMeans(n_clusters=k, random_state=random_state, n_init=10)
    labels = model.fit_predict(X)
    return labels, model


def compute_hierarchical_linkage(
    X: np.ndarray,
    method: str = "ward",
    sample_size: Optional[int] = 2000,
    random_state: int = 42,
) -> np.ndarray:
    """
    Calcula la matriz de enlace jerárquico (linkage) para dendrogramas.
    Utiliza una muestra representativa si el dataset es muy grande.

    Args:
        X: Matriz de características escaladas.
        method: Método de enlace ('ward', 'complete', 'average').
        sample_size: Muestra máxima para el dendrograma (evita cuelgues de memoria con O(N^2)).
        random_state: Semilla aleatoria.

    Returns:
        Matriz de linkage de scipy.
    """
    if sample_size and len(X) > sample_size:
        np.random.seed(random_state)
        indices = np.random.choice(len(X), size=sample_size, replace=False)
        X_sample = X[indices]
    else:
        X_sample = X

    return linkage(X_sample, method=method)


def run_hierarchical(
    X: np.ndarray,
    k: int,
    linkage_method: str = "ward",
) -> Tuple[np.ndarray, AgglomerativeClustering]:
    """
    Ajusta un modelo de Clustering Jerárquico Aglomerativo.

    Args:
        X: Matriz de características.
        k: Número de clústeres.
        linkage_method: Criterio de enlace ('ward', etc.).

    Returns:
        Tupla (labels, modelo_ajustado)
    """
    model = AgglomerativeClustering(n_clusters=k, linkage=linkage_method)
    labels = model.fit_predict(X)
    return labels, model
