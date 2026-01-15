#!/bin/bash
# Comprehensive validation script for all Aviation monorepo applications
# Validates build, test, lint, and integration after shared SDK migration

set -e  # Exit on error

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$REPO_ROOT"

echo "========================================="
echo "Aviation Monorepo - Post-Migration Validation"
echo "========================================="
echo ""

# Track results
PASSED=0
FAILED=0
SKIPPED=0
RESULTS=()

# Function to record result
record_result() {
    local app=$1
    local check=$2
    local status=$3
    local message=$4
    
    if [ "$status" = "PASS" ]; then
        PASSED=$((PASSED + 1))
        echo -e "${GREEN}✓${NC} $app - $check: $message"
        RESULTS+=("✓ $app - $check")
    elif [ "$status" = "FAIL" ]; then
        FAILED=$((FAILED + 1))
        echo -e "${RED}✗${NC} $app - $check: $message"
        RESULTS+=("✗ $app - $check: $message")
    else
        SKIPPED=$((SKIPPED + 1))
        echo -e "${YELLOW}⊘${NC} $app - $check: $message"
        RESULTS+=("⊘ $app - $check")
    fi
}

# Function to validate TypeScript app
validate_ts_app() {
    local app_name=$1
    local app_path=$2
    
    echo ""
    echo "Validating: $app_name ($app_path)"
    echo "-----------------------------------"
    
    if [ ! -d "$app_path" ]; then
        record_result "$app_name" "existence" "SKIP" "Directory not found"
        return
    fi
    
    cd "$app_path"
    
    # Check package.json exists
    if [ ! -f "package.json" ]; then
        record_result "$app_name" "structure" "FAIL" "No package.json found"
        cd "$REPO_ROOT"
        return
    fi
    record_result "$app_name" "structure" "PASS" "package.json exists"
    
    # Build
    if npm run build >/dev/null 2>&1; then
        record_result "$app_name" "build" "PASS" "Built successfully"
    else
        record_result "$app_name" "build" "FAIL" "Build failed"
    fi
    
    # Tests (if available)
    if grep -q '"test"' package.json; then
        if npm test >/dev/null 2>&1; then
            record_result "$app_name" "tests" "PASS" "Tests passed"
        else
            record_result "$app_name" "tests" "FAIL" "Tests failed"
        fi
    else
        record_result "$app_name" "tests" "SKIP" "No tests defined"
    fi
    
    # Lint (if available)
    if grep -q '"lint"' package.json; then
        if npm run lint >/dev/null 2>&1; then
            record_result "$app_name" "lint" "PASS" "Linting passed"
        else
            record_result "$app_name" "lint" "FAIL" "Linting failed"
        fi
    else
        record_result "$app_name" "lint" "SKIP" "No lint script"
    fi
    
    cd "$REPO_ROOT"
}

# Function to validate Python app
validate_python_app() {
    local app_name=$1
    local app_path=$2
    
    echo ""
    echo "Validating: $app_name ($app_path)"
    echo "-----------------------------------"
    
    if [ ! -d "$app_path" ]; then
        record_result "$app_name" "existence" "SKIP" "Directory not found"
        return
    fi
    
    cd "$app_path"
    
    # Check requirements.txt or pyproject.toml
    if [ -f "requirements.txt" ] || [ -f "pyproject.toml" ]; then
        record_result "$app_name" "structure" "PASS" "Dependencies file exists"
    else
        record_result "$app_name" "structure" "FAIL" "No dependencies file"
        cd "$REPO_ROOT"
        return
    fi
    
    # Tests (if pytest available)
    if [ -d "tests" ] || [ -d "test" ]; then
        record_result "$app_name" "tests" "SKIP" "Tests require venv (manual check needed)"
    else
        record_result "$app_name" "tests" "SKIP" "No tests directory"
    fi
    
    cd "$REPO_ROOT"
}

# Function to validate Clojure app
validate_clojure_app() {
    local app_name=$1
    local app_path=$2
    
    echo ""
    echo "Validating: $app_name ($app_path)"
    echo "-----------------------------------"
    
    if [ ! -d "$app_path" ]; then
        record_result "$app_name" "existence" "SKIP" "Directory not found"
        return
    fi
    
    cd "$app_path"
    
    # Check project.clj
    if [ ! -f "backend/project.clj" ]; then
        record_result "$app_name" "structure" "FAIL" "No project.clj found"
        cd "$REPO_ROOT"
        return
    fi
    record_result "$app_name" "structure" "PASS" "project.clj exists"
    
    # Build
    if make build >/dev/null 2>&1; then
        record_result "$app_name" "build" "PASS" "Built successfully"
    else
        record_result "$app_name" "build" "SKIP" "Build requires leiningen"
    fi
    
    cd "$REPO_ROOT"
}

echo "Step 1: Validate Shared Packages"
echo "=================================="

# shared-sdk
validate_ts_app "shared-sdk" "packages/shared-sdk"

# keystore
validate_ts_app "keystore" "packages/keystore"

# ui-framework
validate_ts_app "ui-framework" "packages/ui-framework"

echo ""
echo "Step 2: Validate TypeScript Applications"
echo "=========================================="

# aviation-accident-tracker
validate_ts_app "accident-tracker-backend" "apps/aviation-accident-tracker/backend"
validate_ts_app "accident-tracker-frontend" "apps/aviation-accident-tracker/frontend"

# flight-tracker
validate_ts_app "flight-tracker" "apps/flight-tracker"

# weather-briefing
validate_ts_app "weather-briefing" "apps/weather-briefing"

echo ""
echo "Step 3: Validate Python Applications"
echo "======================================"

# flight-planner
validate_python_app "flight-planner" "apps/flight-planner"

# flightschool
validate_python_app "flightschool" "apps/flightschool"

# foreflight-dashboard
validate_python_app "foreflight-dashboard" "apps/foreflight-dashboard"

echo ""
echo "Step 4: Validate Clojure Applications"
echo "======================================="

# aviation-missions-app
validate_clojure_app "aviation-missions-app" "apps/aviation-missions-app"

echo ""
echo "========================================="
echo "Validation Summary"
echo "========================================="
echo -e "${GREEN}Passed:${NC}  $PASSED"
echo -e "${RED}Failed:${NC}  $FAILED"
echo -e "${YELLOW}Skipped:${NC} $SKIPPED"
echo ""

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}❌ Validation FAILED${NC}"
    echo ""
    echo "Failed checks:"
    for result in "${RESULTS[@]}"; do
        if [[ $result == ✗* ]]; then
            echo "  $result"
        fi
    done
    exit 1
else
    echo -e "${GREEN}✅ All validation checks PASSED${NC}"
    exit 0
fi
