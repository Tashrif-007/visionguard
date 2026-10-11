"""Convert the KITTI raw-depth parquet shards into per-frame files for training.

Source: WyettZ/kitti-raw-depth on Hugging Face (real outdoor driving frames
with LiDAR depth, ~13% of pixels valid). A hazy image cannot be rendered from
sparse depth, so each frame also gets a dense depth map: normalized Gaussian
convolution of the LiDAR points at several scales, with anything still empty
(sky, far field) set to the maximum range. The LiDAR-valid mask is stored too,
so training can trust the measured pixels and treat the filled ones as weak.

Run from the repo root after downloading the shards into training/data/KITTI/raw:
    python -m training.prepare_kitti
Writes training/data/KITTI/{train,val}/<name>.png + <name>.npz.
"""

import argparse
import logging
from pathlib import Path

import cv2
import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
logger = logging.getLogger(__name__)

MAX_DEPTH_M = 80.0  # KITTI LiDAR range cap; also the value for unfilled sky / far field
FILL_SIGMAS = (3.0, 8.0, 20.0, 50.0)


def densify_depth(depth: np.ndarray, valid: np.ndarray) -> np.ndarray:
    """Fill a sparse depth map; measured pixels are kept exactly."""
    weights = valid.astype(np.float32)
    values = np.where(valid, depth, 0.0).astype(np.float32)
    dense = np.zeros_like(values)
    filled = np.zeros(values.shape, bool)
    for sigma in FILL_SIGMAS:
        norm = cv2.GaussianBlur(weights, (0, 0), sigma)
        estimate = cv2.GaussianBlur(values, (0, 0), sigma) / np.maximum(norm, 1e-6)
        take = (~filled) & (norm > 0.05)
        dense[take] = estimate[take]
        filled |= take
    dense[~filled] = MAX_DEPTH_M
    dense[valid] = depth[valid]
    return np.clip(dense, 0.0, MAX_DEPTH_M).astype(np.float16)


def convert_shard(shard: Path, out_dir: Path) -> int:
    parquet = pq.ParquetFile(shard)
    count = 0
    for group_index in range(parquet.metadata.num_row_groups):
        table = parquet.read_row_group(group_index, columns=["image", "depth", "mask", "path"])
        height, width = 352, 1216
        depth_all = _to_numpy(table["depth"], np.float32, height, width)
        mask_all = _to_numpy(table["mask"], np.bool_, height, width)
        images = table["image"].to_pylist()
        paths = table["path"].to_pylist()
        for image, path, depth, mask in zip(images, paths, depth_all, mask_all):
            parts = path.replace("\\", "/").split("/")
            name = f"{parts[-4]}_{Path(parts[-1]).stem}"
            (out_dir / f"{name}.png").write_bytes(image["bytes"])
            np.savez_compressed(
                out_dir / f"{name}.npz", depth=densify_depth(depth, mask), valid=mask
            )
            count += 1
    return count


def _to_numpy(column: pa.ChunkedArray, dtype: type, height: int, width: int) -> np.ndarray:
    flat = column.combine_chunks().flatten().flatten().to_numpy(zero_copy_only=False)
    return flat.astype(dtype, copy=False).reshape(-1, height, width)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=str, default="training/data/KITTI")
    args = parser.parse_args()
    root = Path(args.root)
    for split in ("train", "val"):
        out_dir = root / split
        out_dir.mkdir(parents=True, exist_ok=True)
        total = sum(convert_shard(shard, out_dir) for shard in sorted((root / "raw").glob(f"{split}-*.parquet")))
        logger.info("%s: wrote %d frames to %s", split, total, out_dir)


if __name__ == "__main__":
    main()
