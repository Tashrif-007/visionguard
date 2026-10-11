"""Train a separate Tiny CNN on real outdoor KITTI frames with depth-derived haze.

Same architecture and reconstruction loss as training/train.py, but the data is
KITTI only (no REVIDE, no random synthetic scenes). The transmission term is
supervised on LiDAR-measured pixels only; interpolated depth is not trusted.
The deployed weights (backend/weights/tiny_cnn.pth) are never touched.

Run from the repo root after `python -m training.prepare_kitti`:
    python -m training.train_outdoor --epochs 15
Saves to backend/weights/tiny_cnn_outdoor.pth and compares against both the
unrefined DCP map and the currently deployed weights on the KITTI val split.
"""

import argparse
import logging
from pathlib import Path

import torch
from torch.utils.data import ConcatDataset, DataLoader, Dataset

from backend.models.tiny_cnn import TinyResidualCNN, TinyTransmissionCNN, load_tiny_cnn
from training.city import CityHazeDataset
from training.kitti import KittiHazeDataset
from training.train import reconstruction_l1

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
logger = logging.getLogger(__name__)

T_VALID_WEIGHT = 0.5  # weight of the LiDAR-pixel t term (train.py uses 0.1 on synthetic t)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--kitti-dir", type=str, default="training/data/KITTI")
    parser.add_argument(
        "--city-dir",
        type=str,
        default="",
        help="Cityscapes root from prepare_city.py (adds frames with sky); empty = KITTI only",
    )
    parser.add_argument("--epochs", type=int, default=15)
    parser.add_argument("--crops-per-frame", type=int, default=8)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--lr-step", type=int, default=8)
    parser.add_argument("--patch-size", type=int, default=96)
    parser.add_argument("--dcp-patch-size", type=int, default=15)
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument(
        "--residual",
        action="store_true",
        help="train TinyResidualCNN (t = t_DCP + delta) on unevenly hazed crops",
    )
    parser.add_argument("--out", type=str, default="backend/weights/tiny_cnn_outdoor.pth")
    parser.add_argument("--compare-with", type=str, default="backend/weights/tiny_cnn.pth")
    return parser.parse_args()


def masked_t_error(t_pred: torch.Tensor, t_true: torch.Tensor, valid: torch.Tensor) -> torch.Tensor:
    return torch.sum(torch.abs(t_pred - t_true) * valid) / torch.clamp(valid.sum(), min=1.0)


def evaluate(model: TinyTransmissionCNN | TinyResidualCNN | None, loader: DataLoader) -> tuple[float, float]:
    """(reconstruction L1, t MAE on LiDAR pixels); model=None scores the unrefined DCP map."""
    recon = t_err = 0.0
    count = 0
    with torch.no_grad():
        for inputs, hazy, clean, t_true, atmosphere, valid in loader:
            t_pred = inputs[:, 2:3] if model is None else model(inputs)
            recon += reconstruction_l1(t_pred, hazy, clean, atmosphere).item() * inputs.size(0)
            t_err += masked_t_error(t_pred, t_true, valid).item() * inputs.size(0)
            count += inputs.size(0)
    return recon / count, t_err / count


def main() -> None:
    args = parse_args()
    torch.manual_seed(0)

    train_set: Dataset = KittiHazeDataset(
        args.kitti_dir, "train", args.patch_size, args.dcp_patch_size, args.crops_per_frame, seed=1,
        patchy=args.residual,
    )
    val_sets: dict[str, Dataset] = {
        "kitti": KittiHazeDataset(
            args.kitti_dir, "val", args.patch_size, args.dcp_patch_size, crops_per_frame=4, seed=2,
            patchy=args.residual,
        )
    }
    if args.city_dir:
        city_train = CityHazeDataset(
            args.city_dir, "train", args.patch_size, args.dcp_patch_size, args.crops_per_frame, seed=3,
            patchy=args.residual,
        )
        train_set = ConcatDataset([train_set, city_train])
        val_sets["city"] = CityHazeDataset(
            args.city_dir, "val", args.patch_size, args.dcp_patch_size, crops_per_frame=4, seed=4,
            patchy=args.residual,
        )
    train_loader = DataLoader(
        train_set, batch_size=args.batch_size, shuffle=True, num_workers=args.workers
    )
    val_loaders = {
        name: DataLoader(ds, batch_size=args.batch_size, num_workers=args.workers)
        for name, ds in val_sets.items()
    }
    logger.info(
        "%d train crops; val crops %s", len(train_set), {n: len(d) for n, d in val_sets.items()}
    )

    model: TinyTransmissionCNN | TinyResidualCNN = (
        TinyResidualCNN() if args.residual else TinyTransmissionCNN()
    )
    model.train()
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)
    scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=args.lr_step, gamma=0.5)

    base: dict[str, tuple[float, float]] = {}
    for name, loader in val_loaders.items():
        base[name] = evaluate(None, loader)
        logger.info("Unrefined DCP val[%s]: reconstruction L1 %.4f, t MAE %.4f", name, *base[name])
    deployed = load_tiny_cnn(args.compare_with)
    if deployed is not None:
        deployed.eval()
        for name, loader in val_loaders.items():
            logger.info(
                "Deployed weights val[%s]: reconstruction L1 %.4f, t MAE %.4f",
                name, *evaluate(deployed, loader),
            )
    base_recon = sum(v[0] for v in base.values()) / len(base)

    best_val = float("inf")
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    for epoch in range(1, args.epochs + 1):
        running = 0.0
        for inputs, hazy, clean, t_true, atmosphere, valid in train_loader:
            optimizer.zero_grad()
            t_pred = model(inputs)
            loss = reconstruction_l1(t_pred, hazy, clean, atmosphere) + T_VALID_WEIGHT * masked_t_error(
                t_pred, t_true, valid
            )
            loss.backward()
            optimizer.step()
            running += loss.item() * inputs.size(0)
        scheduler.step()
        model.eval()
        scores = {name: evaluate(model, loader) for name, loader in val_loaders.items()}
        model.train()
        val_recon = sum(v[0] for v in scores.values()) / len(scores)
        logger.info(
            "epoch %d/%d — train loss %.4f, val (recon L1, t MAE) %s, mean recon %.4f",
            epoch, args.epochs, running / len(train_set),
            {n: (round(r, 4), round(t, 4)) for n, (r, t) in scores.items()}, val_recon,
        )
        if val_recon < best_val:
            best_val = val_recon
            if isinstance(model, TinyResidualCNN):
                torch.save(
                    {"residual_state_dict": model.state_dict(), "max_delta": model.max_delta},
                    out_path,
                )
            else:
                torch.save(model.state_dict(), out_path)
            logger.info("Saved best weights to %s", out_path)

    logger.info("Done. Best val reconstruction L1 %.4f vs DCP baseline %.4f", best_val, base_recon)


if __name__ == "__main__":
    main()
