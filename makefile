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
# what deploy_units installs there
PI_SCRIPTS := update.sh backup.sh
PI_UNITS := findthisplace-update.path findthisplace-update.service findthisplace-backup.service findthisplace-backup.timer


.PHONY: mongo_start build_rpi5 build deploy_units


build:
	cd site && go build $(BUILDFLAGS) -ldflags "$(LDFLAGS)" -o ../build/findthisplace .

build_rpi5:
	cd site && GOOS=linux GOARCH=arm64 go build $(BUILDFLAGS) -ldflags "$(LDFLAGS)" -o ../build/findthisplace .

mongo_start:
	$(DC) down
	$(DC) up --pull always --build -d

# Install the Pi-side scripts from deploy/, the self-update and the nightly
# database backup, with their systemd units
deploy_units:
	scp $(addprefix deploy/,$(PI_SCRIPTS) $(PI_UNITS)) $(PI):
	ssh $(PI) 'sudo install -m 755 update.sh /usr/local/sbin/findthisplace-update \
		&& sudo install -m 755 backup.sh /usr/local/bin/findthisplace-backup \
		&& sudo install -m 644 $(PI_UNITS) /etc/systemd/system/ \
		&& rm $(PI_SCRIPTS) $(PI_UNITS) \
		&& sudo systemctl daemon-reload \
		&& sudo systemctl enable findthisplace-update.path findthisplace-backup.timer \
		&& sudo systemctl restart findthisplace-update.path findthisplace-backup.timer'
