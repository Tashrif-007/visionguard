"""Convert Cityscapes clear frames + Foggy Cityscapes transmittance into per-frame files.

Clear frames come from the Hugging Face parquet shards of Chris1/cityscapes
(row order == sorted Cityscapes filenames, verified by correlating image and
transmittance gradients). The dense, sky-inclusive transmittance maps for
beta in {0.005, 0.01, 0.02} come from the open ETH Foggy Cityscapes zip,
fetched with HTTP range requests so only the needed files are downloaded.

Run from the repo root, one shard at a time (raw shards are large):
    python -m training.prepare_city --shard train-00000-of-00014 --split train --offset 0
Writes training/data/CITY/<split>/<name>.jpg + <name>.npz (half resolution).
"""

import argparse
import logging
from pathlib import Path

import cv2
import numpy as np
import pyarrow.parquet as pq
from remotezip import RemoteZip

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
logger = logging.getLogger(__name__)

TRANSMITTANCE_URL = (
    "https://data.vision.ee.ethz.ch/csakarid/shared/SFSU_synthetic/Downloads/"
    "Foggy_Cityscapes/leftImg8bit_trainvaltest_transmittance.zip"
)
BETAS = ("0.005", "0.01", "0.02")
HALF_SIZE = (1024, 512)  # (width, height)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--shard", required=True, help="parquet basename without extension")
    parser.add_argument("--split", choices=("train", "val"), required=True)
    parser.add_argument("--offset", type=int, required=True, help="index of the shard's first row in the sorted split")
    parser.add_argument("--root", default="training/data/CITY")
    args = parser.parse_args()

    root = Path(args.root)
    out_dir = root / args.split
    out_dir.mkdir(parents=True, exist_ok=True)
    zip_split = "val" if args.split == "val" else "train"

    archive = RemoteZip(TRANSMITTANCE_URL)
    names = sorted(
        {
            member.split("_leftImg8bit_transmittance")[0].split("/")[-1]
            for member in archive.namelist()
            if f"/{zip_split}/" in member and member.endswith(".png")
        }
    )
    parquet = pq.ParquetFile(root / "raw" / f"{args.shard}.parquet")
    row = 0
    for group in range(parquet.metadata.num_row_groups):
        for item in parquet.read_row_group(group, columns=["image"]).to_pylist():
            name = names[args.offset + row]
            row += 1
            image = cv2.imdecode(np.frombuffer(item["image"]["bytes"], np.uint8), cv2.IMREAD_COLOR)
            maps = []
            for beta in BETAS:
                member = (
                    f"leftImg8bit_transmittance/{zip_split}/{name.split('_')[0]}/"
                    f"{name}_leftImg8bit_transmittance_beta_{beta}.png"
                )
                t_map = cv2.imdecode(np.frombuffer(archive.read(member), np.uint8), cv2.IMREAD_UNCHANGED)
                maps.append(cv2.resize(t_map, HALF_SIZE, interpolation=cv2.INTER_AREA))
            cv2.imwrite(
                str(out_dir / f"{name}.jpg"),
                cv2.resize(image, HALF_SIZE, interpolation=cv2.INTER_AREA),
                [cv2.IMWRITE_JPEG_QUALITY, 95],
            )
            np.savez_compressed(out_dir / f"{name}.npz", t=np.stack(maps).astype(np.uint8))
        logger.info("%s: %d rows done", args.shard, row)
    logger.info("%s: wrote %d frames to %s", args.shard, row, out_dir)


if __name__ == "__main__":
    main()
