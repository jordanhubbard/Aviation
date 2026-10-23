# Keep the original Aviation Make targets rooted in their retained workspace.
LEGACY_DIR := components/legacy-project-wrapper/implementation
.DEFAULT_GOAL := help

.PHONY: help
help:
	$(MAKE) --no-print-directory -C $(LEGACY_DIR) help

%:
	$(MAKE) --no-print-directory -C $(LEGACY_DIR) $@
