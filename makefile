# Makefile for grabber-mongodb docker-compose

DC=docker compose
VERSION ?= 3.0.0
VERSION_COMMIT := $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
VERSION_DATE := $(shell date -u +%Y-%m-%dT%H:%M:%SZ)


# Build flags
CGO_ENABLED ?= 0
LDFLAGS := -s -w -X main.Version=$(VERSION) -X main.Commit=$(VERSION_COMMIT) -X main.Date=$(VERSION_DATE)
BUILDFLAGS := -trimpath


.PHONY: mongo_start build_rpi5 build


build:
	cd site && go build $(BUILDFLAGS) -ldflags "$(LDFLAGS)" -o ../build/findthisplace .

build_rpi5:
	cd site && GOOS=linux GOARCH=arm64 go build $(BUILDFLAGS) -ldflags "$(LDFLAGS)" -o ../build/findthisplace .

mongo_start:
	$(DC) down
	$(DC) up --pull always --build -d

