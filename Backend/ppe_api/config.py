"""Settings read from the environment (and Backend/.env), validated at startup."""

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent


class ConfigError(ValueError):
    pass


def _int_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        value = int(raw)
    except ValueError as exc:
        raise ConfigError(f"{name} must be an integer, got {raw!r}") from exc
    if value <= 0:
        raise ConfigError(f"{name} must be positive, got {value}")
    return value


def _path_env(name: str, default: str) -> Path:
    path = Path(os.getenv(name) or default)
    return path if path.is_absolute() else BACKEND_DIR / path


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    model_path: Path
    class_names_file: Path
    allowed_origins: list[str]
    api_key: str | None
    max_upload_size: int
    host: str
    port: int

    @property
    def incidents_dir(self) -> Path:
        return self.data_dir / "incidents"

    @property
    def images_dir(self) -> Path:
        return self.data_dir / "images"

    @property
    def videos_dir(self) -> Path:
        return self.data_dir / "videos"

    @property
    def models_dir(self) -> Path:
        return self.data_dir / "models"

    def ensure_dirs(self) -> None:
        for directory in (
            self.data_dir,
            self.incidents_dir,
            self.images_dir,
            self.videos_dir,
            self.models_dir,
        ):
            directory.mkdir(parents=True, exist_ok=True)


def load_settings() -> Settings:
    load_dotenv(BACKEND_DIR / ".env")
    origins = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://localhost:5173,http://localhost:8080",
    )
    return Settings(
        data_dir=_path_env("DATA_DIR", "data"),
        model_path=_path_env("MODEL_PATH", "output/weights/best.pt"),
        class_names_file=_path_env("CLASS_NAMES_FILE", "output/weights/ppe_data.yaml"),
        allowed_origins=[o.strip() for o in origins.split(",") if o.strip()],
        api_key=os.getenv("API_KEY") or None,
        max_upload_size=_int_env("MAX_UPLOAD_SIZE", 50 * 1024 * 1024),
        host=os.getenv("HOST", "0.0.0.0"),
        port=_int_env("PORT", 8000),
    )
