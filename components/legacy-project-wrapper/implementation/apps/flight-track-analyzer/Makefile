# Flight track analyzer: install, build, run (GNU Make 3.81 compatible).
PYTHON ?= python3
VENV   ?= $(abspath ../../_build/venv/flight-track-analyzer)
PY     := $(VENV)/bin/python
PORT   ?= 8000
DEPLOY_HOST ?= do-host1
HOST   ?= 127.0.0.1

.PHONY: help install build test run deploy clean

help:
	@echo "make install   create venv and install app/requirements.txt"
	@echo "make build     byte-compile Python, syntax-check JS, run tests"
	@echo "make run       serve on http://$(HOST):$(PORT)  (override HOST=, PORT=)"
	@echo "make deploy     ship the committed tree to $(DEPLOY_HOST) (override DEPLOY_HOST=)"
	@echo "make clean     remove the venv and caches"

$(PY): app/requirements.txt ../../packages/shared-sdk/python/setup.py ../../packages/flight-dynamics/setup.py
	$(PYTHON) -m venv $(VENV)
	$(PY) -m pip install -q --upgrade pip
	$(PY) -m pip install -q -r app/requirements.txt
	$(PY) -m pip install -q -e ../../packages/shared-sdk/python
	$(PY) -m pip install -q -e ../../packages/flight-dynamics
	@touch $(PY)

install: $(PY)

build: install
	$(PY) -m compileall -q app/flightlab app/run.py
	@if command -v node >/dev/null 2>&1; then \
	  for f in app/static/*.js; do node --input-type=module --check < $$f || exit 1; done; \
	else echo "node not found: skipping JS syntax check"; fi
	cd app && PYTHONPATH=$(abspath ../../packages/shared-sdk/python) $(PY) -m pytest -q

test: build

run: install
	cd app && $(PY) run.py --host $(HOST) --port $(PORT)

# Deploys exactly what is committed (git archive HEAD); refuses if app/ or deploy/ has uncommitted changes.
deploy: build
	deploy/deploy.sh $(DEPLOY_HOST)
	@echo "waiting for service..."; \
	for i in 1 2 3 4 5 6 7 8 9 10 11 12; do \
	  if curl -fsS -m 10 https://kmlab.jordanhubbard.net/api/health >/dev/null 2>&1; then echo "deployed: https://kmlab.jordanhubbard.net"; exit 0; fi; sleep 3; \
	done; echo "service did not become healthy" >&2; exit 1

clean:
	rm -rf $(VENV)
	find app -name __pycache__ -type d -prune -exec rm -rf {} +
