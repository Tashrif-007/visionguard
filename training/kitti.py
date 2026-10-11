"""KITTI outdoor dataset for the transmission refiner.

Real outdoor driving frames with LiDAR depth (see training/prepare_kitti.py).
The camera frame is the clean image J; haze is rendered with the atmospheric
scattering model I = J*t + A*(1-t) using t = exp(-beta * depth), so t is
derived from real scene geometry instead of a random field. Network inputs are
computed with the deployed DCP code, as in the other datasets.

Samples: (inputs, hazy, clean, t_true, atmosphere_est, t_valid) where t_valid
marks pixels whose depth was measured by LiDAR (the rest is interpolated).
Deterministic per (seed, index) for reproducible epochs.
"""

from pathlib import Path

import cv2
import numpy as np
import torch
from torch.utils.data import Dataset

from backend.services.dehazing.atmosphere import estimate_atmospheric_light
from backend.services.dehazing.dark_channel import compute_dark_channel
from backend.services.dehazing.transmission import estimate_transmission
from training.haze import patchy_transmission

BETA_RANGE = (0.01, 0.05)  # 1/m; t at 40 m ranges from 0.67 to 0.14
T_RENDER_MIN = 0.05


class KittiHazeDataset(Dataset):
    """Random crops of KITTI frames with depth-derived haze."""

    def __init__(
        self,
        root: str,
        split: str,
        patch_size: int,
        dcp_patch_size: int,
        crops_per_frame: int = 8,
        seed: int = 0,
        patchy: bool = False,
    ) -> None:
        self.patchy = patchy
        self.patch_size = patch_size
        self.dcp_patch_size = dcp_patch_size
        self.crops_per_frame = crops_per_frame
        self.seed = seed
        self.frames = sorted((Path(root) / split).glob("*.png"))
        if not self.frames:
            raise FileNotFoundError(f"No KITTI frames under {Path(root) / split}")

    def __len__(self) -> int:
        return len(self.frames) * self.crops_per_frame

    def __getitem__(
        self, index: int
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor]:
        frame = self.frames[index // self.crops_per_frame]
        rng = np.random.default_rng(self.seed * 1_000_003 + index)

        image = cv2.imread(str(frame)).astype(np.float32) / 255.0
        with np.load(frame.with_suffix(".npz")) as data:
            depth = data["depth"].astype(np.float32)
            valid = data["valid"]
        height, width = image.shape[:2]
        y0 = int(rng.integers(0, height - self.patch_size + 1))
        x0 = int(rng.integers(0, width - self.patch_size + 1))
        window = (slice(y0, y0 + self.patch_size), slice(x0, x0 + self.patch_size))
        clean = image[window]
        depth = depth[window]
        valid = valid[window]
        if rng.random() < 0.5:
            clean, depth, valid = clean[:, ::-1], depth[:, ::-1], valid[:, ::-1]
        clean = np.ascontiguousarray(clean)

        beta = rng.uniform(*BETA_RANGE)
        t_true = np.clip(np.exp(-beta * depth), T_RENDER_MIN, 1.0).astype(np.float32)
        if self.patchy:
            t_true = np.clip(patchy_transmission(t_true, rng), T_RENDER_MIN, 1.0)
        atmosphere = rng.uniform(0.7, 1.0, size=3).astype(np.float32)
        hazy = clean * t_true[..., None] + atmosphere * (1.0 - t_true[..., None])
        hazy = np.clip(hazy, 0.0, 1.0).astype(np.float32)

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
            torch.from_numpy(t_true[None, ...]),
            torch.from_numpy(atmosphere_est),
            torch.from_numpy(np.ascontiguousarray(valid[None, ...]).astype(np.float32)),
        )
