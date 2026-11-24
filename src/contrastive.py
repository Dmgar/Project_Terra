"""Self-Supervised Tabular Contrastive Learning (SCARF) in pure NumPy.

Implements the SCARF framework (Bahri et al., ICLR 2022) with:
- Random feature corruption sampled from empirical column marginals.
- MLP encoder + projection head trained with NT-Xent (InfoNCE) loss via Adam.
- Scikit-learn compatible ``BaseEstimator`` / ``TransformerMixin`` interface
  for seamless ``Pipeline`` composition and lightweight ``joblib`` serialization
  without requiring PyTorch in production.
"""

from __future__ import annotations

import numpy as np
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.utils.validation import check_array, check_is_fitted


def _relu(x: np.ndarray) -> np.ndarray:
    return np.maximum(0.0, x)


def _l2_normalize(x: np.ndarray, eps: float = 1e-8) -> tuple[np.ndarray, np.ndarray]:
    norms = np.linalg.norm(x, axis=1, keepdims=True)
    norms = np.maximum(norms, eps)
    return x / norms, norms


def _l2_normalize_grad(
    grad_z: np.ndarray, z: np.ndarray, norms: np.ndarray
) -> np.ndarray:
    dot = np.sum(grad_z * z, axis=1, keepdims=True)
    return (grad_z - dot * z) / norms


class SCARFEncoder(BaseEstimator, TransformerMixin):
    """Lightweight pure-NumPy SCARF tabular contrastive encoder.

    Parameters
    ----------
    hidden_dims : tuple[int, int], default=(64, 32)
        Hidden layer widths of the MLP encoder.
    embedding_dim : int, default=16
        Output dimensionality of the learned representation returned by ``transform``.
    projection_dim : int, default=16
        Output dimensionality of the contrastive projection head (used only in ``fit``).
    corruption_rate : float, default=0.4
        Fraction of features corrupted per view from empirical column marginals.
    temperature : float, default=0.3
        Temperature parameter ``tau`` in the NT-Xent (InfoNCE) loss.
    epochs : int, default=80
        Number of training epochs.
    batch_size : int, default=256
        Mini-batch size.
    learning_rate : float, default=3e-3
        Adam learning rate.
    weight_decay : float, default=1e-4
        L2 weight decay applied to weight matrices.
    normalize_embeddings : bool, default=True
        Whether ``transform`` returns L2-normalized embeddings (aligning Euclidean
        clustering with cosine similarity in InfoNCE).
    random_state : int, default=42
        Random seed for deterministic initialization, batching, and corruption.
    """

    def __init__(
        self,
        hidden_dims: tuple[int, int] = (64, 32),
        embedding_dim: int = 16,
        projection_dim: int = 16,
        corruption_rate: float = 0.4,
        temperature: float = 0.3,
        epochs: int = 80,
        batch_size: int = 256,
        learning_rate: float = 3e-3,
        weight_decay: float = 1e-4,
        normalize_embeddings: bool = True,
        random_state: int = 42,
    ) -> None:
        self.hidden_dims = hidden_dims
        self.embedding_dim = embedding_dim
        self.projection_dim = projection_dim
        self.corruption_rate = corruption_rate
        self.temperature = temperature
        self.epochs = epochs
        self.batch_size = batch_size
        self.learning_rate = learning_rate
        self.weight_decay = weight_decay
        self.normalize_embeddings = normalize_embeddings
        self.random_state = random_state

    def _init_params(
        self, n_features: int, rng: np.random.Generator
    ) -> dict[str, np.ndarray]:
        h1, h2 = self.hidden_dims
        dims = [
            (n_features, h1),
            (h1, h2),
            (h2, self.embedding_dim),
            (self.embedding_dim, self.projection_dim),
            (self.projection_dim, self.projection_dim),
        ]
        params: dict[str, np.ndarray] = {}
        for idx, (din, dout) in enumerate(dims, start=1):
            # He initialization for ReLU layers, Xavier for linear outputs
            scale = np.sqrt(2.0 / din) if idx in (1, 2, 4) else np.sqrt(1.0 / din)
            params[f"W{idx}"] = rng.normal(0.0, scale, size=(din, dout)).astype(
                np.float64
            )
            params[f"b{idx}"] = np.zeros((1, dout), dtype=np.float64)
        return params

    def _corrupt_batch(
        self,
        x_batch: np.ndarray,
        x_full: np.ndarray,
        rng: np.random.Generator,
    ) -> np.ndarray:
        bsz, n_feat = x_batch.shape
        mask = rng.random((bsz, n_feat)) < self.corruption_rate
        # Ensure at least 1 feature is corrupted per sample when rate > 0
        if self.corruption_rate > 0.0:
            empty_rows = ~mask.any(axis=1)
            if np.any(empty_rows):
                rand_cols = rng.integers(0, n_feat, size=int(empty_rows.sum()))
                mask[empty_rows, rand_cols] = True
        rand_rows = rng.integers(0, x_full.shape[0], size=(bsz, n_feat))
        col_idx = np.broadcast_to(np.arange(n_feat), (bsz, n_feat))
        corrupted_vals = x_full[rand_rows, col_idx]
        return np.where(mask, corrupted_vals, x_batch)

    @staticmethod
    def _forward(
        x: np.ndarray, params: dict[str, np.ndarray]
    ) -> tuple[np.ndarray, dict[str, np.ndarray]]:
        a1 = x @ params["W1"] + params["b1"]
        h1 = _relu(a1)
        a2 = h1 @ params["W2"] + params["b2"]
        h2 = _relu(a2)
        emb = h2 @ params["W3"] + params["b3"]
        a4 = emb @ params["W4"] + params["b4"]
        p1 = _relu(a4)
        u = p1 @ params["W5"] + params["b5"]
        z, norms = _l2_normalize(u)
        cache = {
            "x": x,
            "a1": a1,
            "h1": h1,
            "a2": a2,
            "h2": h2,
            "emb": emb,
            "a4": a4,
            "p1": p1,
            "z": z,
            "norms": norms,
        }
        return z, cache

    @staticmethod
    def _backward(
        grad_z: np.ndarray,
        cache: dict[str, np.ndarray],
        params: dict[str, np.ndarray],
        weight_decay: float,
    ) -> dict[str, np.ndarray]:
        grads: dict[str, np.ndarray] = {}
        du = _l2_normalize_grad(grad_z, cache["z"], cache["norms"])

        grads["W5"] = cache["p1"].T @ du + weight_decay * params["W5"]
        grads["b5"] = np.sum(du, axis=0, keepdims=True)
        dp1 = du @ params["W5"].T

        da4 = dp1 * (cache["a4"] > 0.0)
        grads["W4"] = cache["emb"].T @ da4 + weight_decay * params["W4"]
        grads["b4"] = np.sum(da4, axis=0, keepdims=True)
        demb = da4 @ params["W4"].T

        grads["W3"] = cache["h2"].T @ demb + weight_decay * params["W3"]
        grads["b3"] = np.sum(demb, axis=0, keepdims=True)
        dh2 = demb @ params["W3"].T

        da2 = dh2 * (cache["a2"] > 0.0)
        grads["W2"] = cache["h1"].T @ da2 + weight_decay * params["W2"]
        grads["b2"] = np.sum(da2, axis=0, keepdims=True)
        dh1 = da2 @ params["W2"].T

        da1 = dh1 * (cache["a1"] > 0.0)
        grads["W1"] = cache["x"].T @ da1 + weight_decay * params["W1"]
        grads["b1"] = np.sum(da1, axis=0, keepdims=True)
        return grads

    def _nt_xent_loss_and_grad(
        self, z: np.ndarray
    ) -> tuple[float, np.ndarray]:
        n2 = z.shape[0]
        bsz = n2 // 2
        tau = float(self.temperature)

        sim = (z @ z.T) / tau
        np.fill_diagonal(sim, -1e9)

        # Numerically stable softmax
        sim_max = np.max(sim, axis=1, keepdims=True)
        exp_sim = np.exp(sim - sim_max)
        np.fill_diagonal(exp_sim, 0.0)
        probs = exp_sim / np.maximum(np.sum(exp_sim, axis=1, keepdims=True), 1e-12)

        pos_idx = np.concatenate([np.arange(bsz, n2), np.arange(0, bsz)])
        pos_probs = np.maximum(probs[np.arange(n2), pos_idx], 1e-12)
        loss = float(-np.mean(np.log(pos_probs)))

        dsim = probs.copy()
        dsim[np.arange(n2), pos_idx] -= 1.0
        dsim /= float(n2)
        np.fill_diagonal(dsim, 0.0)

        grad_z = ((dsim + dsim.T) @ z) / tau
        return loss, grad_z

    def fit(self, X: np.ndarray, y: np.ndarray | None = None) -> SCARFEncoder:
        """Train the SCARF encoder on scaled tabular features ``X``."""
        X_arr = check_array(X, dtype=np.float64)
        n_samples, n_features = X_arr.shape
        self.n_features_in_ = n_features

        rng = np.random.default_rng(self.random_state)
        params = self._init_params(n_features, rng)

        # Adam state
        m = {k: np.zeros_like(v) for k, v in params.items()}
        v = {k: np.zeros_like(v) for k, v in params.items()}
        beta1, beta2, eps = 0.9, 0.999, 1e-8
        step = 0

        bsz = min(int(self.batch_size), n_samples)
        loss_history: list[float] = []

        for _ in range(int(self.epochs)):
            perm = rng.permutation(n_samples)
            epoch_losses: list[float] = []

            for start in range(0, n_samples, bsz):
                idx = perm[start : start + bsz]
                if len(idx) < 4:
                    continue
                x1 = X_arr[idx]
                x2 = self._corrupt_batch(x1, X_arr, rng)
                x_both = np.vstack([x1, x2])

                z, cache = self._forward(x_both, params)
                loss, grad_z = self._nt_xent_loss_and_grad(z)
                grads = self._backward(grad_z, cache, params, self.weight_decay)
                epoch_losses.append(loss)

                step += 1
                lr_t = (
                    self.learning_rate
                    * np.sqrt(1.0 - beta2**step)
                    / (1.0 - beta1**step)
                )
                for k in params:
                    m[k] = beta1 * m[k] + (1.0 - beta1) * grads[k]
                    v[k] = beta2 * v[k] + (1.0 - beta2) * (grads[k] ** 2)
                    params[k] -= lr_t * m[k] / (np.sqrt(v[k]) + eps)

            loss_history.append(float(np.mean(epoch_losses)))

        # Store only encoder weights needed for inference
        self.encoder_weights_ = {
            k: params[k] for k in ("W1", "b1", "W2", "b2", "W3", "b3")
        }
        self.loss_history_ = loss_history
        return self

    def transform(self, X: np.ndarray) -> np.ndarray:
        """Project scaled tabular features into the learned contrastive space."""
        check_is_fitted(self, ["encoder_weights_", "n_features_in_"])
        X_arr = check_array(X, dtype=np.float64)
        w = self.encoder_weights_
        h1 = _relu(X_arr @ w["W1"] + w["b1"])
        h2 = _relu(h1 @ w["W2"] + w["b2"])
        emb = h2 @ w["W3"] + w["b3"]
        if self.normalize_embeddings:
            emb, _ = _l2_normalize(emb)
        return emb
