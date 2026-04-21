from io import BytesIO
from pathlib import Path

import rawpy
from PIL import Image, ImageOps

from ..base import PreviewHandler


class RawImageHandler(PreviewHandler):
    """Handler for camera RAW files.

    Uses the embedded JPEG thumbnail when available (fast, high quality).
    Falls back to a full libraw decode if no embedded preview exists.
    """

    extensions = (
        "nef", "dng", "cr2", "cr3", "arw", "raf", "rw2", "orf", "pef", "srw", "nrw",
    )
    output_mime = "image/webp"

    def render(self, source: Path, max_size: int) -> bytes:
        image = self._load_image(source)
        try:
            image = ImageOps.exif_transpose(image)
            if image.mode not in ("RGB", "RGBA"):
                image = image.convert("RGB")
            image.thumbnail((max_size, max_size), Image.LANCZOS)
            buffer = BytesIO()
            image.save(buffer, format="WEBP", quality=88, method=4)
            return buffer.getvalue()
        finally:
            image.close()

    @staticmethod
    def _load_image(source: Path) -> Image.Image:
        with rawpy.imread(str(source)) as raw:
            try:
                thumb = raw.extract_thumb()
            except (rawpy.LibRawNoThumbnailError, rawpy.LibRawUnsupportedThumbnailError):
                thumb = None

            if thumb is not None and thumb.format == rawpy.ThumbFormat.JPEG:
                return Image.open(BytesIO(thumb.data))
            if thumb is not None and thumb.format == rawpy.ThumbFormat.BITMAP:
                return Image.fromarray(thumb.data)

            rgb = raw.postprocess(use_camera_wb=True, no_auto_bright=False, output_bps=8)
            return Image.fromarray(rgb)
