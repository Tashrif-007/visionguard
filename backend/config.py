from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    model_path: str = "backend/weights/tiny_cnn.pth"
    video_source: str = "0"
    confidence_threshold: float = 0.5
    roi_padding: int = 20
    upload_dir: str = "uploads"
    snapshot_dir: str = "snapshots"
    motion_min_area: int = 500
    motion_warmup_frames: int = 30
    event_cooldown_seconds: float = 5.0

    dcp_patch_size: int = 15
    atmo_top_k_ratio: float = 0.001
    dehaze_omega: float = 0.95
    dehaze_t_min: float = 0.1
    dehaze_gamma: float = 0.85
    refine_max_side: int = 256
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-opus-5"
    anthropic_max_tokens: int = 2048
    anthropic_timeout_seconds: float = 15.0

    jwt_secret_key: str = "dev-insecure-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 720
    admin_username: str = "admin"
    admin_password: str = ""

    motion_max_side: int = 480
    roi_max_area_ratio: float = 0.35
    dehaze_max_side: int = 256
    atmo_min_pixels: int = 32
    guided_filter_radius: int = 24
    guided_filter_eps: float = 1e-3
    preview_max_width: int = 960
    preview_jpeg_quality: int = 70
    preview_fps: float = 12.0
    capture_max_lag_frames: int = 5
    torch_num_threads: int = 2
    cv_num_threads: int = 4

    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "visionguard"
    postgres_password: str = ""
    postgres_db: str = "visionguard"

    @computed_field
    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


settings = Settings()
