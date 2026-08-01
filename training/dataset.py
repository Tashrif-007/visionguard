"""Synthetic haze dataset for training the Tiny CNN transmission refiner.

Each sample starts from a randomly generated clean scene and a smooth
ground-truth transmission field. Haze is applied with the atmospheric
scattering model I = J*t + A*(1-t) — the same model the pipeline inverts —
and the network inputs are computed with the *actual* DCP code from
backend/services/dehazing, so the CNN learns to correct the real estimator's
errors (block halos at depth edges, over-dark flat regions).
"""

import cv2
import numpy as np
import torch
from torch.utils.data import Dataset

from backend.services.dehazing.atmosphere import estimate_atmospheric_light
from backend.services.dehazing.dark_channel import compute_dark_channel
from backend.services.dehazing.transmission import estimate_transmission


def _random_clean_scene(rng: np.random.Generator, size: int) -> np.ndarray:
    """A textured scene with random flat shapes, float32 BGR in [0, 1].

    A portion of the shapes is forced near-black: the dark channel prior
    assumes haze-free scenes contain dark pixels, and training scenes must
    satisfy it for the coarse-transmission input to carry real signal.
    """
    base = rng.uniform(0.05, 0.6, size=3).astype(np.float32)
    scene = np.ones((size, size, 3), np.float32) * base
    for shape_index in range(rng.integers(4, 10)):
        if shape_index % 3 == 0:
            color = rng.uniform(0.0, 0.08, size=3).astype(np.float32)  # shadow / dark object
        else:
            color = rng.uniform(0.0, 1.0, size=3).astype(np.float32)
        x0, y0 = rng.integers(0, size, 2)
        if rng.random() < 0.5:
            w, h = rng.integers(size // 8, size // 2, 2)
            cv2.rectangle(scene, (int(x0), int(y0)), (int(x0 + w), int(y0 + h)), color.tolist(), -1)
        else:
            cv2.circle(scene, (int(x0), int(y0)), int(rng.integers(size // 10, size // 3)), color.tolist(), -1)
    noise = rng.normal(0.0, 0.02, scene.shape).astype(np.float32)
    return np.clip(scene + noise, 0.0, 1.0)


def _random_transmission(rng: np.random.Generator, size: int) -> np.ndarray:
    """A smooth transmission field in [0.2, 0.95], (H, W) float32.

    Low-resolution noise upscaled with cubic interpolation gives smooth
    depth-like variation; an optional vertical gradient mimics scenes where
    haze thickens with distance.
    """
    coarse = rng.uniform(0.0, 1.0, size=(rng.integers(2, 6), rng.integers(2, 6))).astype(np.float32)
    field = cv2.resize(coarse, (size, size), interpolation=cv2.INTER_CUBIC)
    if rng.random() < 0.5:
        gradient = np.linspace(rng.uniform(0.0, 0.4), 0.0, size, dtype=np.float32)[:, None]
        field = field + gradient
    field = (field - field.min()) / max(float(field.max() - field.min()), 1e-6)
    t_lo = rng.uniform(0.2, 0.45)
    t_hi = rng.uniform(0.6, 0.95)
    return (t_lo + field * (t_hi - t_lo)).astype(np.float32)


class SyntheticHazeDataset(Dataset):
    """Generates training samples for the transmission refiner.

    Each sample is (inputs, hazy, clean, t_true, atmosphere_est):
      inputs:         (3, H, W) — grayscale hazy patch, dark channel, coarse DCP t
      hazy / clean:   (3, H, W) — BGR image pair for reconstruction loss
      t_true:         (1, H, W) — ground-truth transmission
      atmosphere_est: (3,)      — Top-K atmospheric light as the pipeline estimates it

    The estimated (not true) atmospheric light is returned deliberately: the
    deployed pipeline recovers radiance with the estimated A, so training must
    let the predicted transmission compensate for that estimate's error.
    Samples are deterministic per (seed, index) so epochs are reproducible.
    """

    def __init__(self, num_samples: int, patch_size: int, dcp_patch_size: int, seed: int = 0) -> None:
        self.num_samples = num_samples
        self.patch_size = patch_size
        self.dcp_patch_size = dcp_patch_size
        self.seed = seed

    def __len__(self) -> int:
        return self.num_samples

    def __getitem__(
        self, index: int
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor]:
        rng = np.random.default_rng(self.seed * 1_000_003 + index)
        clean = _random_clean_scene(rng, self.patch_size)
        t_true = _random_transmission(rng, self.patch_size)
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
        )
