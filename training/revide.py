"""REVIDE real-world paired haze dataset for the transmission refiner.

REVIDE (CVPR 2021) records the same indoor scenes with and without machine
haze, giving pixel-aligned hazy/clear frame pairs. Samples mirror the tuple
layout of SyntheticHazeDataset so the two can be concatenated for training:
(inputs, hazy, clean, t_anchor, atmosphere_est).

Real scenes have no ground-truth transmission, so t_anchor is the coarse DCP
transmission itself — a weak physics prior keeping the refined map close to
DCP unless the reconstruction loss demands otherwise. This preserves the
project's hybrid identity: the CNN corrects physics, it does not replace it.
"""

from pathlib import Path

import cv2
import numpy as np
import torch
from torch.utils.data import Dataset

from backend.services.dehazing.atmosphere import estimate_atmospheric_light
from backend.services.dehazing.dark_channel import compute_dark_channel
from backend.services.dehazing.transmission import estimate_transmission


class RevidePairDataset(Dataset):
    """Random aligned crops from REVIDE hazy/clear frame pairs.

    root points at the REVIDE directory containing Train/ and Test/;
    split is "Train" or "Test". Each frame pair yields crops_per_frame
    samples, deterministic per (seed, index) for reproducible epochs.
    """

    def __init__(
        self,
        root: str,
        split: str,
        patch_size: int,
        dcp_patch_size: int,
        crops_per_frame: int = 2,
        seed: int = 0,
    ) -> None:
        self.patch_size = patch_size
        self.dcp_patch_size = dcp_patch_size
        self.crops_per_frame = crops_per_frame
        self.seed = seed
        hazy_root = Path(root) / split / "hazy"
        self.pairs: list[tuple[Path, Path]] = []
        for hazy_path in sorted(hazy_root.glob("*/*.jpg")):
            gt_path = Path(root) / split / "gt" / hazy_path.parent.name / hazy_path.name
            if gt_path.is_file():
                self.pairs.append((hazy_path, gt_path))
        if not self.pairs:
            raise FileNotFoundError(f"No REVIDE pairs found under {hazy_root}")

    def __len__(self) -> int:
        return len(self.pairs) * self.crops_per_frame

    def __getitem__(
        self, index: int
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor]:
        hazy_path, gt_path = self.pairs[index // self.crops_per_frame]
        rng = np.random.default_rng(self.seed * 1_000_003 + index)

        hazy_full = cv2.imread(str(hazy_path)).astype(np.float32) / 255.0
        clean_full = cv2.imread(str(gt_path)).astype(np.float32) / 255.0
        height, width = hazy_full.shape[:2]
        y0 = int(rng.integers(0, max(1, height - self.patch_size)))
        x0 = int(rng.integers(0, max(1, width - self.patch_size)))
        hazy = hazy_full[y0 : y0 + self.patch_size, x0 : x0 + self.patch_size]
        clean = clean_full[y0 : y0 + self.patch_size, x0 : x0 + self.patch_size]

        gray = cv2.cvtColor(hazy, cv2.COLOR_BGR2GRAY)
        dark = compute_dark_channel(hazy, patch_size=self.dcp_patch_size)
        atmosphere_est = estimate_atmospheric_light(hazy, dark, top_k_ratio=0.001)
        t_coarse = estimate_transmission(
            hazy, atmosphere_est, omega=0.95, patch_size=self.dcp_patch_size
        )

        inputs = torch.from_numpy(np.stack([gray, dark, t_coarse], axis=0))
        return (
            inputs,
            torch.from_numpy(hazy.transpose(2, 0, 1)),
            torch.from_numpy(clean.transpose(2, 0, 1)),
            torch.from_numpy(t_coarse[None, ...]),
            torch.from_numpy(atmosphere_est),
        )
