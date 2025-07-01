# Self-documenting Makefile
# Run 'make help' to see available commands

.PHONY: help
help: ## Show this help message
	@echo "Source Map Visualizer VSCode Extension"
	@echo "======================================"
	@echo ""
	@echo "Available commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.PHONY: init
init: ## Initialize the project (install dependencies)
	npm install
	@echo "Project initialized successfully!"

.PHONY: dev
dev: ## Start development mode with file watching
	npm run watch

.PHONY: build
build: ## Build the extension
	npm run compile

.PHONY: test
test: ## Run tests
	npm test

.PHONY: lint
lint: ## Run linter
	npm run lint

.PHONY: format
format: ## Format code
	npm run format

.PHONY: package
package: build ## Package extension for distribution
	npx @vscode/vsce package

.PHONY: publish
publish: ## Publish extension to marketplace (requires authentication)
	npx @vscode/vsce publish

.PHONY: clean
clean: ## Clean build artifacts
	rm -rf out/
	rm -rf *.vsix
	rm -rf node_modules/

.PHONY: install-local
install-local: package ## Install extension locally in VSCode
	code --install-extension *.vsix

.PHONY: scaffold
scaffold: ## Scaffold new VSCode extension (run only once)
	yo code

.PHONY: watch-test
watch-test: ## Run tests in watch mode
	npm run test-watch

.PHONY: check
check: lint test ## Run all checks (lint + test)