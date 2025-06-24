# Makefile for grabber-mongodb docker-compose

DC=docker compose

.PHONY: mongo_start


mongo_start:
	$(DC) down
	$(DC) up --pull always --build -d

