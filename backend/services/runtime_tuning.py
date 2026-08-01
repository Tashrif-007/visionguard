import logging

import cv2
import torch

logger = logging.getLogger(__name__)


def configure_cpu_threads(torch_threads: int, cv_threads: int) -> None:
    """Cap torch/OpenCV intra-op thread pools so they don't oversubscribe the CPU.

    Both libraries default to using every core independently on every call;
    on CPU-only edge hardware that's thread-pool contention paid every frame,
    not extra throughput. Never pass 0 to cv2.setNumThreads — that disables
    OpenCV threading entirely rather than resetting it.
    """
    torch.set_num_threads(torch_threads)
    cv2.setNumThreads(cv_threads)
    logger.info("CPU threads configured: torch=%d opencv=%d", torch_threads, cv_threads)
