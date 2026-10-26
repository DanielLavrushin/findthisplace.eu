# Makefile for grabber-mongodb docker-compose

DC=docker compose
VERSION ?= 3.0.0
VERSION_COMMIT := $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
VERSION_DATE := $(shell date -u +%Y-%m-%dT%H:%M:%SZ)


# Build flags
CGO_ENABLED ?= 0
LDFLAGS := -s -w -X main.Version=$(VERSION) -X main.Commit=$(VERSION_COMMIT) -X main.Date=$(VERSION_DATE)
BUILDFLAGS := -trimpath

# ssh host of the production Pi
PI ?= raspberry


.PHONY: mongo_start build_rpi5 build deploy_units


build:
	cd site && go build $(BUILDFLAGS) -ldflags "$(LDFLAGS)" -o ../build/findthisplace .

build_rpi5:
	cd site && GOOS=linux GOARCH=arm64 go build $(BUILDFLAGS) -ldflags "$(LDFLAGS)" -o ../build/findthisplace .

mongo_start:
	$(DC) down
	$(DC) up --pull always --build -d

# Install the self-update script and its systemd units from deploy/ on the Pi
deploy_units:
	scp deploy/update.sh deploy/findthisplace-update.path deploy/findthisplace-update.service $(PI):
	ssh $(PI) 'sudo install -m 755 update.sh /usr/local/sbin/findthisplace-update \
		&& sudo install -m 644 findthisplace-update.path findthisplace-update.service /etc/systemd/system/ \
		&& rm update.sh findthisplace-update.path findthisplace-update.service \
		&& sudo systemctl daemon-reload \
		&& sudo systemctl enable findthisplace-update.path \
		&& sudo systemctl restart findthisplace-update.path'
