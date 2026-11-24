"""Unit tests for pure-NumPy SCARF tabular contrastive encoder."""

from pathlib import Path

import joblib
import numpy as np
from sklearn.datasets import make_blobs
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from src.contrastive import SCARFEncoder


def test_scarf_loss_decreases_and_produces_deterministic_embeddings():
    X, _ = make_blobs(n_samples=300, n_features=7, centers=5, random_state=42)
    X_scaled = StandardScaler().fit_transform(X)

    enc1 = SCARFEncoder(
        epochs=20, batch_size=64, embedding_dim=12, random_state=42
    ).fit(X_scaled)
    enc2 = SCARFEncoder(
        epochs=20, batch_size=64, embedding_dim=12, random_state=42
    ).fit(X_scaled)

    assert len(enc1.loss_history_) == 20
    assert enc1.loss_history_[-1] < enc1.loss_history_[0]

    z1 = enc1.transform(X_scaled)
    z2 = enc2.transform(X_scaled)
    assert z1.shape == (300, 12)
    assert np.allclose(z1, z2)
    # L2-normalized embeddings should have unit norm
    assert np.allclose(np.linalg.norm(z1, axis=1), 1.0, atol=1e-5)


def test_scarf_pipeline_joblib_roundtrip(tmp_path: Path):
    X, _ = make_blobs(n_samples=160, n_features=7, centers=4, random_state=7)
    pipe = Pipeline(
        [
            ("scaler", StandardScaler()),
            ("scarf", SCARFEncoder(epochs=10, batch_size=64, random_state=7)),
        ]
    )
    z_before = pipe.fit_transform(X)

    artifact = tmp_path / "scarf_pipe.joblib"
    joblib.dump(pipe, artifact)
    loaded = joblib.load(artifact)
    z_after = loaded.transform(X)

    assert z_after.shape == z_before.shape
    assert np.allclose(z_before, z_after)
