"""Small independent NumPy score oracle; no retrieval, feedback or production ranking."""

import json
from pathlib import Path

import numpy as np


def main():
    ids = ["axis-x", "axis-y", "three-four", "diagonal", "opposite"]
    raw = np.array([[1, 0], [0, 1], [3, 4], [1, 1], [-1, 0]], dtype=np.float64)
    unit = raw / np.linalg.norm(raw, axis=1, keepdims=True)
    similarities = unit @ unit[:2].T
    fixtures = [
        {
            "id": identifier,
            "cosineX": float(similarities[i, 0]),
            "cosineY": float(similarities[i, 1]),
            "blend": float(0.65 * similarities[i].max() + 0.35 * similarities[i].mean()),
        }
        for i, identifier in enumerate(ids)
    ]
    root = Path(__file__).resolve().parents[2] / "public/catalog"
    pointer = json.loads((root / "current.json").read_text())
    root = root / pointer["catalogVersion"]
    manifest = json.loads((root / "manifest.json").read_text())
    tracks = json.loads((root / "tracks.json").read_text())
    vectors = np.fromfile(root / "embeddings.f32", dtype="<f4").astype(np.float64)
    vectors = vectors.reshape(manifest["trackCount"], manifest["dimension"])
    vectors /= np.linalg.norm(vectors, axis=1, keepdims=True)
    rows = {track["id"]: i for i, track in enumerate(tracks)}
    pairs = [
        ("fma:045099", "fma:045100"),
        ("fma:045099", "fma:071506"),
        ("fma:003832", "fma:006855"),
        ("fma:154307", "fma:141592"),
    ]
    real = [
        {
            "seedId": seed,
            "targetId": target,
            "cosine": float(np.dot(vectors[rows[seed]], vectors[rows[target]])),
        }
        for seed, target in pairs
    ]
    print(
        json.dumps(
            {
                "tolerance": 1e-12,
                "numpyVersion": np.__version__,
                "fixtures": fixtures,
                "catalogVersion": manifest["catalogVersion"],
                "vectorSha256": manifest["files"]["embeddings"]["sha256"],
                "realScores": real,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
