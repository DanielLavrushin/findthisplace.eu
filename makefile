# Makefile for grabber-mongodb docker-compose

DC=docker compose

.PHONY: mongo_start build_rpi5


build_rpi5:
	cd site && GOOS=linux GOARCH=arm64 go build -o ../build/findthisplace .

mongo_start:
	$(DC) down
	$(DC) up --pull always --build -d

