.PHONY: help build start clean

help:
	@echo "Aviation Chat proxy:"
	@echo "  make build  - Build the proxy"
	@echo "  make start  - Start the proxy (default port 31416)"
	@echo "  make clean  - Remove dist/"

build:
	npm install
	npm run build

start: build
	npm start

clean:
	rm -rf dist
