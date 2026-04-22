FROM python:3.11-slim AS builder

# Build-time deps: headers + toolchain so pip can compile wheels from source
# if no prebuilt wheel is available (mainly rawpy on ARM).
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      libraw-dev \
      libjpeg-dev \
      libtiff-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


FROM python:3.11-slim

# Runtime-only shared libraries used by rawpy / Pillow.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libraw23 \
      libjpeg62-turbo \
      libtiff6 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local

WORKDIR /app
COPY app ./app

ENV DATA_ROOT=/data \
    CACHE_ROOT=/cache \
    STATE_ROOT=/state \
    PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
