"""Cityscapes outdoor dataset (with sky) for the transmission refiner.

Clear Cityscapes frames plus the dense Foggy Cityscapes transmittance maps
(stereo depth, sky included; see training/prepare_city.py). Haze is rendered
with I = J*t + A*(1-t) using the dataset's own t for a randomly chosen
beta in {0.005, 0.01, 0.02}. Unlike KITTI's LiDAR t, this t is dense, so every
pixel is trusted (t_valid is all ones).

Samples have the same 6-tuple layout as KittiHazeDataset. Deterministic per
(seed, index) for reproducible epochs.
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

T_RENDER_MIN = 0.05


class CityHazeDataset(Dataset):
    """Random crops of Cityscapes frames with transmittance-derived haze."""

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
        self.frames = sorted((Path(root) / split).glob("*.jpg"))
        if not self.frames:
            raise FileNotFoundError(f"No Cityscapes frames under {Path(root) / split}")

    def __len__(self) -> int:
        return len(self.frames) * self.crops_per_frame

    def __getitem__(
        self, index: int
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor]:
        frame = self.frames[index // self.crops_per_frame]
        rng = np.random.default_rng(self.seed * 1_000_003 + index)

        image = cv2.imread(str(frame)).astype(np.float32) / 255.0
        with np.load(frame.with_suffix(".npz")) as data:
            t_full = data["t"][int(rng.integers(0, data["t"].shape[0]))].astype(np.float32) / 255.0
        height, width = image.shape[:2]
        y0 = int(rng.integers(0, height - self.patch_size + 1))
        x0 = int(rng.integers(0, width - self.patch_size + 1))
        window = (slice(y0, y0 + self.patch_size), slice(x0, x0 + self.patch_size))
        clean, t_true = image[window], t_full[window]
        if rng.random() < 0.5:
            clean, t_true = clean[:, ::-1], t_true[:, ::-1]
        clean = np.ascontiguousarray(clean)
        t_true = np.clip(np.ascontiguousarray(t_true), T_RENDER_MIN, 1.0).astype(np.float32)
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
            torch.ones(1, self.patch_size, self.patch_size),
        )
