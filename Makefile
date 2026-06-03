# Build & publish the Docker image, auto-incrementing the version.
#
#   make push          build + push, bumping the patch version (v0.1.0 -> v0.1.1)
#   make push-minor    bump the minor version (v0.1.4 -> v0.2.0)
#   make push-major    bump the major version (v0.3.2 -> v1.0.0)
#   make build         build locally for the current arch, no version bump
#   make version       print the current version
#
# The version lives in the VERSION file; it is only bumped after a successful
# push, so a failed build never advances it. Override the image name or target
# platforms on the command line, e.g.  make push IMAGE=me/app PLATFORMS=linux/amd64

IMAGE     ?= drevoliv/filvisare
PLATFORMS ?= linux/amd64,linux/arm64
VERSION   := $(shell cat VERSION 2>/dev/null || echo 0.0.0)

# Split "X.Y.Z" into parts so we can bump one of them.
MAJOR := $(word 1,$(subst ., ,$(VERSION)))
MINOR := $(word 2,$(subst ., ,$(VERSION)))
PATCH := $(word 3,$(subst ., ,$(VERSION)))

.PHONY: help push push-minor push-major _release build version setup-builder

# Show this list when run with no target.
.DEFAULT_GOAL := help

help:
	@echo "Filvisare image — current version: $(VERSION)  ($(IMAGE))"
	@echo
	@echo "Targets:"
	@echo "  make push           build + push, bump patch version (v0.1.0 -> v0.1.1)"
	@echo "  make push-minor     build + push, bump minor version (v0.1.4 -> v0.2.0)"
	@echo "  make push-major     build + push, bump major version (v0.3.2 -> v1.0.0)"
	@echo "  make build          build locally for this arch, no bump or push"
	@echo "  make version        print the current version"
	@echo "  make setup-builder  create a buildx builder for multi-arch pushes"
	@echo
	@echo "Overrides:  make push IMAGE=me/app PLATFORMS=linux/amd64"

# Default release: bump the patch version.
push:       NEW_VERSION := $(MAJOR).$(MINOR).$(shell expr $(PATCH) + 1)
push-minor: NEW_VERSION := $(MAJOR).$(shell expr $(MINOR) + 1).0
push-major: NEW_VERSION := $(shell expr $(MAJOR) + 1).0.0

push push-minor push-major: _release

# Multi-arch build pushed straight to the registry, tagged with both the new
# version and :latest. VERSION is updated only once the push succeeds.
_release:
	@echo ">> Releasing $(IMAGE):v$(NEW_VERSION)  (current: v$(VERSION))"
	docker buildx build \
	  --platform $(PLATFORMS) \
	  -t $(IMAGE):v$(NEW_VERSION) \
	  -t $(IMAGE):latest \
	  --push .
	@printf '%s\n' "$(NEW_VERSION)" > VERSION
	@echo ">> Pushed $(IMAGE):v$(NEW_VERSION) and :latest. VERSION is now $(NEW_VERSION)."

# Local build for the current architecture (handy for testing); no bump, no push.
build:
	docker build -t $(IMAGE):v$(VERSION) -t $(IMAGE):latest .

version:
	@echo $(VERSION)

# First-time setup: create a buildx builder for multi-arch pushes (see README).
setup-builder:
	docker buildx create --name iv-builder --use
	docker buildx inspect --bootstrap
