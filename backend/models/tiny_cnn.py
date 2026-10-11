import logging
from pathlib import Path

import torch
from torch import nn

logger = logging.getLogger(__name__)


class TinyTransmissionCNN(nn.Module):
    """Refines the coarse DCP transmission map.

    Input is a (B, 3, H, W) tensor stacking grayscale ROI, dark channel and
    coarse transmission, all in [0, 1]. Output is a (B, 1, H, W) refined
    transmission map in [0, 1]. Padding preserves spatial size so the map
    drops straight into radiance recovery.
    """

    def __init__(self) -> None:
        super().__init__()
        self.layers = nn.Sequential(
            nn.Conv2d(3, 16, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(16, 32, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(32, 16, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(16, 1, kernel_size=3, padding=1),
            nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.layers(x)


class TinyResidualCNN(nn.Module):
    """Predicts a bounded correction to the coarse DCP transmission map.

    Same input and the same four-layer stack as TinyTransmissionCNN, but the
    last layer outputs a residual: t_final = clamp(t_coarse + max_delta *
    tanh(out)). The last layer starts at zero, so an untrained model returns
    the DCP map unchanged and training can only move it away where that
    lowers the reconstruction error.
    """

    def __init__(self, max_delta: float = 0.25) -> None:
        super().__init__()
        self.max_delta = max_delta
        self.layers = nn.Sequential(
            nn.Conv2d(3, 16, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(16, 32, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(32, 16, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(16, 1, kernel_size=3, padding=1),
        )
        nn.init.zeros_(self.layers[-1].weight)
        nn.init.zeros_(self.layers[-1].bias)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        delta = self.max_delta * torch.tanh(self.layers(x))
        return torch.clamp(x[:, 2:3] + delta, 0.0, 1.0)


def load_tiny_cnn(weights_path: str) -> TinyTransmissionCNN | TinyResidualCNN | None:
    """Load trained weights once at startup; return None if none exist yet.

    A missing weights file is not an error: the pipeline falls back to the
    unrefined DCP transmission map until a model has been trained.
    """
    path = Path(weights_path)
    if not path.is_file():
        logger.warning(
            "No CNN weights at %s — dehazing will use the unrefined DCP transmission map",
            weights_path,
        )
        return None

    checkpoint = torch.load(path, map_location="cpu", weights_only=True)
    model: TinyTransmissionCNN | TinyResidualCNN
    if "residual_state_dict" in checkpoint:
        model = TinyResidualCNN(max_delta=float(checkpoint["max_delta"]))
        model.load_state_dict(checkpoint["residual_state_dict"])
    else:
        model = TinyTransmissionCNN()
        model.load_state_dict(checkpoint)
    model.eval()
    logger.info("Loaded Tiny CNN weights from %s", weights_path)
    return model
