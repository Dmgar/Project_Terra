"""
Módulo para entrenamiento y evaluación de algoritmos de clustering
en Project Terra.
"""

from typing import Dict, Any, List, Literal, Tuple, Optional, Sequence
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans, AgglomerativeClustering
from sklearn.mixture import GaussianMixture
from sklearn.metrics import silhouette_score, davies_bouldin_score, calinski_harabasz_score
from sklearn.metrics.cluster import contingency_matrix
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


# ---------------------------------------------------------------------------
# Gaussian Mixture Models (GMM)
# ---------------------------------------------------------------------------


def find_optimal_gmm(
    X: np.ndarray,
    k_range: Sequence[int] = range(2, 11),
    covariance_types: Sequence[str] = ("full", "tied", "diag", "spherical"),
    sample_size_silhouette: Optional[int] = 5000,
    random_state: int = 42,
    n_init: int = 5,
) -> pd.DataFrame:
    """
    Evalúa modelos GMM para un rango de componentes K y tipos de covarianza.

    Para cada combinación (K, covariance_type) calcula:
      - BIC  (Bayesian Information Criterion)  — criterio primario de selección
      - AIC  (Akaike Information Criterion)    — criterio secundario
      - Log-likelihood                          — ajuste generativo
      - Silhouette Score (asignación hard)      — comparabilidad con K-Means

    Args:
        X: Matriz de características preprocesadas/escaladas.
        k_range: Rango de número de componentes a evaluar.
        covariance_types: Tipos de estructura de covarianza a probar.
        sample_size_silhouette: Muestra para acelerar el score de silueta.
        random_state: Semilla para reproducibilidad.
        n_init: Número de inicializaciones aleatorias del EM.

    Returns:
        DataFrame con columnas ['k', 'covariance_type', 'bic', 'aic',
        'log_likelihood', 'silhouette', 'converged'].
    """
    records = []

    for cov_type in covariance_types:
        for k in k_range:
            gmm = GaussianMixture(
                n_components=k,
                covariance_type=cov_type,
                random_state=random_state,
                n_init=n_init,
                max_iter=200,
            )
            gmm.fit(X)

            bic = gmm.bic(X)
            aic = gmm.aic(X)
            log_lik = gmm.score(X) * len(X)  # score() retorna log-lik promedio

            hard_labels = gmm.predict(X)

            # Silhouette requiere al menos 2 clústeres distintos
            if len(np.unique(hard_labels)) > 1:
                if sample_size_silhouette and len(X) > sample_size_silhouette:
                    sil = silhouette_score(
                        X,
                        hard_labels,
                        sample_size=sample_size_silhouette,
                        random_state=random_state,
                    )
                else:
                    sil = silhouette_score(X, hard_labels)
            else:
                sil = float("nan")

            records.append({
                "k": k,
                "covariance_type": cov_type,
                "bic": bic,
                "aic": aic,
                "log_likelihood": log_lik,
                "silhouette": sil,
                "converged": gmm.converged_,
            })

    return pd.DataFrame(records)


def run_gmm(
    X: np.ndarray,
    k: int,
    covariance_type: str = "full",
    random_state: int = 42,
    n_init: int = 10,
) -> Tuple[np.ndarray, np.ndarray, GaussianMixture]:
    """
    Ajusta un modelo GMM final con los hiperparámetros seleccionados.

    Args:
        X: Matriz de características escaladas.
        k: Número de componentes (clústeres).
        covariance_type: Tipo de covarianza ('full', 'tied', 'diag', 'spherical').
        random_state: Semilla para reproducibilidad.
        n_init: Número de inicializaciones para evitar mínimos locales.

    Returns:
        Tupla (hard_labels, soft_probs, modelo_ajustado).
          - hard_labels: array de enteros con el clúster asignado (argmax de probs).
          - soft_probs:  array (N, k) con la probabilidad de pertenencia a cada componente.
          - modelo:      objeto GaussianMixture entrenado.
    """
    model = GaussianMixture(
        n_components=k,
        covariance_type=covariance_type,
        random_state=random_state,
        n_init=n_init,
        max_iter=200,
    )
    model.fit(X)
    hard_labels = model.predict(X)
    soft_probs = model.predict_proba(X)
    return hard_labels, soft_probs, model


def _purity(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Calcula Purity Score internamente sin depender del módulo profiling."""
    cm = contingency_matrix(y_true, y_pred)
    return float(np.sum(np.amax(cm, axis=0)) / np.sum(cm))


def compare_models(
    X: np.ndarray,
    labels_kmeans: np.ndarray,
    labels_gmm: np.ndarray,
    y_true: Optional[np.ndarray] = None,
    gmm_model: Optional[GaussianMixture] = None,
    sample_size_silhouette: Optional[int] = 5000,
    random_state: int = 42,
) -> pd.DataFrame:
    """
    Compara K-Means y GMM con un conjunto de métricas comunes.

    Métricas calculadas:
      - Silhouette Score        (mayor = mejor, rango [-1, 1])
      - Davies-Bouldin Score    (menor = mejor)
      - Calinski-Harabasz Score (mayor = mejor)
      - BIC / AIC               (solo GMM, menor = mejor)
      - Purity Score vs. etiqueta real (si y_true es provisto)

    Args:
        X: Datos escalados originales.
        labels_kmeans: Labels asignadas por K-Means.
        labels_gmm: Labels asignadas por GMM (hard).
        y_true: Etiquetas reales opcionales (ej. columna 'Crop') para Purity.
        gmm_model: Modelo GMM entrenado (para calcular BIC/AIC).
        sample_size_silhouette: Muestra para Silhouette.
        random_state: Semilla.

    Returns:
        DataFrame con índice ['kmeans', 'gmm'] y columnas de métricas.
    """
    results: Dict[str, Dict[str, Any]] = {}

    for name, labels in [("kmeans", labels_kmeans), ("gmm", labels_gmm)]:
        row: Dict[str, Any] = {}

        # Silhouette
        if len(np.unique(labels)) > 1:
            if sample_size_silhouette and len(X) > sample_size_silhouette:
                row["silhouette"] = silhouette_score(
                    X, labels, sample_size=sample_size_silhouette, random_state=random_state
                )
            else:
                row["silhouette"] = silhouette_score(X, labels)
        else:
            row["silhouette"] = float("nan")

        row["davies_bouldin"] = davies_bouldin_score(X, labels)
        row["calinski_harabasz"] = calinski_harabasz_score(X, labels)

        # BIC / AIC solo para GMM
        if name == "gmm" and gmm_model is not None:
            row["bic"] = gmm_model.bic(X)
            row["aic"] = gmm_model.aic(X)
        else:
            row["bic"] = float("nan")
            row["aic"] = float("nan")

        # Purity Score (requiere etiqueta real)
        if y_true is not None:
            row["purity"] = _purity(np.asarray(y_true), labels)
        else:
            row["purity"] = float("nan")

        results[name] = row

    df = pd.DataFrame(results).T
    df.index.name = "model"
    return df.round(4)
