"""Stores uploaded media under a timestamped name that keeps the original name."""

import shutil
from datetime import datetime
from pathlib import Path

from fastapi import UploadFile


def upload_name(original: str | None, fallback: str, extension: str) -> str:
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    return f"upload_{stamp}_{Path(original or fallback).name}{extension}"


def save_upload(file: UploadFile, destination: Path) -> None:
    with destination.open("wb") as out:
        shutil.copyfileobj(file.file, out)
