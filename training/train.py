"""Train the Tiny CNN transmission refiner on synthetic haze.

The loss is computed on the *recovered image*, not the transmission map:
the pipeline inverts the scattering model with the estimated (imperfect)
atmospheric light, so the network is trained to predict the transmission
that yields the best reconstruction under that same estimate. A small L1
term against the ground-truth transmission keeps the map physically sane.

Run from the repo root:
    python -m training.train --epochs 15 --samples 3000
Saves the state dict to backend/weights/tiny_cnn.pth (the path the backend
loads at startup).
"""

import argparse
import logging
from pathlib import Path

import torch
from torch.utils.data import ConcatDataset, DataLoader, Dataset

from backend.models.tiny_cnn import TinyTransmissionCNN
from training.dataset import SyntheticHazeDataset
from training.revide import RevidePairDataset

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
logger = logging.getLogger(__name__)

T_MIN = 0.1  # matches DEHAZE_T_MIN used by the deployed pipeline
T_TRUE_WEIGHT = 0.1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--samples", type=int, default=3000, help="training samples per epoch")
    parser.add_argument("--val-samples", type=int, default=300, help="validation samples")
    parser.add_argument("--epochs", type=int, default=15)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--lr-step", type=int, default=8, help="epochs between halving the lr")
    parser.add_argument("--patch-size", type=int, default=96, help="training patch side in pixels")
    parser.add_argument("--dcp-patch-size", type=int, default=15, help="DCP erosion window")
    parser.add_argument("--out", type=str, default="backend/weights/tiny_cnn.pth")
    parser.add_argument(
        "--revide-dir",
        type=str,
        default="training/data/REVIDE",
        help="REVIDE dataset root; pass an empty string to train on synthetic data only",
    )
    return parser.parse_args()


def recover(hazy: torch.Tensor, t: torch.Tensor, atmosphere: torch.Tensor) -> torch.Tensor:
    """Differentiable radiance recovery, mirroring services/dehazing/radiance.py."""
    a = atmosphere[:, :, None, None]
    radiance = (hazy - a) / torch.clamp(t, min=T_MIN) + a
    return torch.clamp(radiance, 0.0, 1.0)


def reconstruction_l1(
    t: torch.Tensor, hazy: torch.Tensor, clean: torch.Tensor, atmosphere: torch.Tensor
) -> torch.Tensor:
    return torch.mean(torch.abs(recover(hazy, t, atmosphere) - clean))


def evaluate(model: TinyTransmissionCNN, loader: DataLoader) -> float:
    """Mean reconstruction L1 on the validation set."""
    model.eval()
    total = 0.0
    count = 0
    with torch.no_grad():
        for inputs, hazy, clean, _, atmosphere in loader:
            total += reconstruction_l1(model(inputs), hazy, clean, atmosphere).item() * inputs.size(0)
            count += inputs.size(0)
    model.train()
    return total / count


def coarse_baseline(loader: DataLoader) -> float:
    """Reconstruction L1 using the unrefined DCP transmission (input channel 2)."""
    total = 0.0
    count = 0
    with torch.no_grad():
        for inputs, hazy, clean, _, atmosphere in loader:
            total += reconstruction_l1(inputs[:, 2:3], hazy, clean, atmosphere).item() * inputs.size(0)
            count += inputs.size(0)
    return total / count


def main() -> None:
    args = parse_args()
    torch.manual_seed(0)

    train_set: Dataset = SyntheticHazeDataset(
        args.samples, args.patch_size, args.dcp_patch_size, seed=1
    )
    val_set: Dataset = SyntheticHazeDataset(args.val_samples, args.patch_size, args.dcp_patch_size, seed=2)
    if args.revide_dir and Path(args.revide_dir).is_dir():
        revide_train = RevidePairDataset(args.revide_dir, "Train", args.patch_size, args.dcp_patch_size, seed=3)
        val_set = RevidePairDataset(
            args.revide_dir, "Test", args.patch_size, args.dcp_patch_size, crops_per_frame=1, seed=4
        )
        train_set = ConcatDataset([train_set, revide_train])
        logger.info(
            "Training on %d synthetic + %d REVIDE samples; validating on %d real REVIDE crops",
            args.samples, len(revide_train), len(val_set),
        )
    train_loader = DataLoader(train_set, batch_size=args.batch_size, shuffle=True)
    val_loader = DataLoader(val_set, batch_size=args.batch_size)

    model = TinyTransmissionCNN()
    model.train()
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)
    scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=args.lr_step, gamma=0.5)

    baseline = coarse_baseline(val_loader)
    logger.info("Unrefined DCP baseline val reconstruction L1: %.4f", baseline)

    best_val = float("inf")
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    for epoch in range(1, args.epochs + 1):
        running = 0.0
        for inputs, hazy, clean, t_true, atmosphere in train_loader:
            optimizer.zero_grad()
            t_pred = model(inputs)
            loss = reconstruction_l1(t_pred, hazy, clean, atmosphere) + T_TRUE_WEIGHT * torch.mean(
                torch.abs(t_pred - t_true)
            )
            loss.backward()
            optimizer.step()
            running += loss.item() * inputs.size(0)
        scheduler.step()
        train_loss = running / len(train_set)
        val_loss = evaluate(model, val_loader)
        logger.info(
            "epoch %d/%d — train loss %.4f, val reconstruction L1 %.4f",
            epoch, args.epochs, train_loss, val_loss,
        )
        if val_loss < best_val:
            best_val = val_loss
            torch.save(model.state_dict(), out_path)
            logger.info("Saved best weights to %s", out_path)

    logger.info(
        "Done. Best val reconstruction L1 %.4f vs DCP baseline %.4f (%s)",
        best_val,
        baseline,
        "improved" if best_val < baseline else "NOT improved — train longer",
    )


if __name__ == "__main__":
    main()
