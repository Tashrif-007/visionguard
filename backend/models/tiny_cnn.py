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


def load_tiny_cnn(weights_path: str) -> TinyTransmissionCNN | None:
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

    model = TinyTransmissionCNN()
    state_dict = torch.load(path, map_location="cpu", weights_only=True)
    model.load_state_dict(state_dict)
    model.eval()
    logger.info("Loaded Tiny CNN weights from %s", weights_path)
    return model
