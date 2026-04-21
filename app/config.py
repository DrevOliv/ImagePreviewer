import os
import secrets
from pathlib import Path

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parent.parent


def _load_env_file() -> None:
    """Load environment variables from a .env file, if one exists.

    Resolution order (real env vars always take precedence over file values):
    1. `ENV_FILE` env var, if set, points to the file to load.
    2. Otherwise, `<project root>/.env` is loaded if it exists.
    """
    override = os.environ.get("ENV_FILE")
    if override:
        load_dotenv(override, override=False)
        return

    default = PROJECT_ROOT / ".env"
    if default.exists():
        load_dotenv(default, override=False)


_load_env_file()


class Settings:
    def __init__(self) -> None:
        self.data_root: Path = Path(os.environ.get("DATA_ROOT", "/data")).resolve()
        self.cache_root: Path = Path(os.environ.get("CACHE_ROOT", "/cache")).resolve()
        self.state_root: Path = Path(os.environ.get("STATE_ROOT", "/state")).resolve()

        self.password: str = os.environ.get("APP_PASSWORD", "")
        self.secret_key: str = os.environ.get("SECRET_KEY") or secrets.token_urlsafe(32)
        self.session_cookie: str = "imageviewer_session"
        self.session_max_age: int = int(os.environ.get("SESSION_MAX_AGE", 60 * 60 * 24 * 30))

        self.thumbnail_size: int = int(os.environ.get("THUMBNAIL_SIZE", 400))
        self.full_size: int = int(os.environ.get("FULL_PREVIEW_SIZE", 2500))

        # Upper bound on the on-disk preview cache. Set to 0 to disable eviction.
        self.cache_max_mb: int = int(os.environ.get("CACHE_MAX_MB", 2048))
        # How often the background thread checks and trims the cache (seconds).
        self.cache_sweep_interval: int = int(os.environ.get("CACHE_SWEEP_INTERVAL", 300))

        for directory in (self.cache_root, self.state_root):
            directory.mkdir(parents=True, exist_ok=True)


settings = Settings()
