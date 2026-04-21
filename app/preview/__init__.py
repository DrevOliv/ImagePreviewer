from . import registry
from .handlers import standard_image, raw_image


def install_default_handlers() -> None:
    registry.register(standard_image.StandardImageHandler())
    registry.register(raw_image.RawImageHandler())
