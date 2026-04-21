from io import BytesIO
from pathlib import Path

from PIL import Image, ImageOps

from ..base import PreviewHandler


class StandardImageHandler(PreviewHandler):
    extensions = (
        "jpg", "jpeg", "png", "gif", "bmp", "tiff", "tif", "webp", "heic", "heif",
    )
    output_mime = "image/webp"

    def render(self, source: Path, max_size: int) -> bytes:
        with Image.open(source) as img:
            img = ImageOps.exif_transpose(img)
            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGB")
            img.thumbnail((max_size, max_size), Image.LANCZOS)
            buffer = BytesIO()
            img.save(buffer, format="WEBP", quality=88, method=4)
            return buffer.getvalue()
