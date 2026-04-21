from .base import PreviewHandler


_handlers: dict[str, PreviewHandler] = {}


def register(handler: PreviewHandler) -> None:
    for ext in handler.extensions:
        _handlers[ext.lower().lstrip(".")] = handler


def get_handler(extension: str) -> PreviewHandler | None:
    return _handlers.get(extension.lower().lstrip("."))


def is_previewable(extension: str) -> bool:
    return get_handler(extension) is not None


def supported_extensions() -> list[str]:
    return sorted(_handlers.keys())
