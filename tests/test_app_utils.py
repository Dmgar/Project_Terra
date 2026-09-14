import joblib
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

from app import utils


def _fixture_frame():
    return pd.DataFrame(
        {
            feature: [float(index), float(index + 10), float(index + 20)]
            for index, feature in enumerate(utils.FEATURE_COLS)
        }
    )


def test_load_dataset_prefers_processed_fixture(app_data_dir):
    raw_path = app_data_dir / "data" / "raw" / "sensor_Crop_Dataset.csv"
    processed_path = (
        app_data_dir
        / "data"
        / "processed"
        / "sensor_Crop_Dataset_clustered.csv"
    )
    raw = _fixture_frame()
    processed = raw.assign(kmeans_cluster=[0, 1, 1])
    raw.to_csv(raw_path, index=False)
    processed.to_csv(processed_path, index=False)

    loaded = utils.load_dataset()

    pd.testing.assert_frame_equal(loaded, processed)


def test_get_model_and_scaler_loads_fixtures_without_dataset(app_data_dir):
    models_dir = app_data_dir / "data" / "models"
    models_dir.mkdir()
    frame = _fixture_frame()
    scaler = StandardScaler().fit(frame[utils.FEATURE_COLS])
    scaled = scaler.transform(frame[utils.FEATURE_COLS])
    model = KMeans(n_clusters=2, random_state=42, n_init=10).fit(scaled)
    joblib.dump(scaler, models_dir / "scaler.joblib")
    joblib.dump(model, models_dir / "kmeans_k2.joblib")

    loaded_model, loaded_scaler = utils.get_model_and_scaler(k_clusters=2)
    prediction = loaded_model.predict(
        loaded_scaler.transform(frame.loc[[0], utils.FEATURE_COLS])
    )

    assert prediction.shape == (1,)
    assert loaded_model.n_clusters == 2