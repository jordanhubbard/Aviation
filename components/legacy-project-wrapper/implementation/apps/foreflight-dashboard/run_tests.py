#!/usr/bin/env python3
"""
Test runner script for ForeFlight Dashboard.

This script provides convenient ways to run different types of tests
with appropriate configurations and reporting.
"""

import sys
import subprocess
import argparse
from pathlib import Path


def run_command(cmd, description):
    """Run a command and handle errors."""
    print(f"\n🔄 {description}")
    print(f"Running: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        print(f"✅ {description} completed successfully")
        if result.stdout:
            print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed")
        print(f"Exit code: {e.returncode}")
        if e.stdout:
            print("STDOUT:", e.stdout)
        if e.stderr:
            print("STDERR:", e.stderr)
        return False


def run_unit_tests():
    """Run unit tests only."""
    cmd = [
        "pytest", 
        "tests/test_core/", 
        "tests/test_services/",
        "-v",
        "--cov=src",
        "--cov-report=term-missing",
        "--cov-report=html:htmlcov/unit",
        "-m", "not integration and not slow"
    ]
    return run_command(cmd, "Unit tests")


def run_api_tests():
    """Run API tests only."""
    cmd = [
        "pytest", 
        "tests/test_api/",
        "-v",
        "--cov=src",
        "--cov-report=term-missing",
        "--cov-report=html:htmlcov/api",
        "-m", "not integration and not slow"
    ]
    return run_command(cmd, "API tests")


def run_integration_tests():
    """Run integration tests only."""
    cmd = [
        "pytest", 
        "tests/test_integration/",
        "-v",
        "--cov=src",
        "--cov-report=term-missing",
        "--cov-report=html:htmlcov/integration",
        "-m", "integration"
    ]
    return run_command(cmd, "Integration tests")


def run_all_tests():
    """Run all tests with comprehensive coverage."""
    cmd = [
        "pytest", 
        "tests/",
        "-v",
        "--cov=src",
        "--cov-report=html:htmlcov/all",
        "--cov-report=term-missing",
        "--cov-report=xml:coverage.xml",
        "--cov-fail-under=80",
        "--durations=10"
    ]
    return run_command(cmd, "All tests")


def run_fast_tests():
    """Run only fast tests (exclude slow and integration tests)."""
    cmd = [
        "pytest", 
        "tests/",
        "-v",
        "--cov=src",
        "--cov-report=term-missing",
        "-m", "not slow and not integration",
        "--durations=5"
    ]
    return run_command(cmd, "Fast tests")


def run_specific_test(test_path):
    """Run a specific test file or test function."""
    cmd = [
        "pytest", 
        test_path,
        "-v",
        "--cov=src",
        "--cov-report=term-missing"
    ]
    return run_command(cmd, f"Specific test: {test_path}")


def check_test_coverage():
    """Check test coverage and generate reports."""
    print("\n📊 Generating coverage reports...")
    
    # Generate HTML coverage report
    cmd = ["coverage", "html", "--directory=htmlcov/coverage"]
    run_command(cmd, "HTML coverage report")
    
    # Generate XML coverage report
    cmd = ["coverage", "xml", "-o", "coverage.xml"]
    run_command(cmd, "XML coverage report")
    
    # Show coverage summary
    cmd = ["coverage", "report", "--show-missing"]
    run_command(cmd, "Coverage summary")


def lint_code():
    """Run code linting."""
    print("\n🔍 Running code linting...")
    
    # Run flake8 if available
    try:
        cmd = ["flake8", "src/", "tests/", "--max-line-length=100"]
        run_command(cmd, "Flake8 linting")
    except FileNotFoundError:
        print("Flake8 not found, skipping...")
    
    # Run black check if available
    try:
        cmd = ["black", "--check", "--diff", "src/", "tests/"]
        run_command(cmd, "Black formatting check")
    except FileNotFoundError:
        print("Black not found, skipping...")


def main():
    """Main test runner function."""
    parser = argparse.ArgumentParser(description="ForeFlight Dashboard Test Runner")
    
    parser.add_argument(
        "test_type",
        choices=["unit", "api", "integration", "all", "fast", "coverage", "lint"],
        nargs="?",
        default="fast",
        help="Type of tests to run (default: fast)"
    )
    
    parser.add_argument(
        "--specific",
        help="Run a specific test file or test function"
    )
    
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Verbose output"
    )
    
    args = parser.parse_args()
    
    print("🧪 ForeFlight Dashboard Test Runner")
    print("=" * 50)
    
    success = True
    
    if args.specific:
        success = run_specific_test(args.specific)
    elif args.test_type == "unit":
        success = run_unit_tests()
    elif args.test_type == "api":
        success = run_api_tests()
    elif args.test_type == "integration":
        success = run_integration_tests()
    elif args.test_type == "all":
        success = run_all_tests()
        if success:
            check_test_coverage()
    elif args.test_type == "fast":
        success = run_fast_tests()
    elif args.test_type == "coverage":
        success = run_all_tests()
        if success:
            check_test_coverage()
    elif args.test_type == "lint":
        lint_code()
        return
    
    if success:
        print("\n✅ All tests passed!")
        print("\n📋 Test Summary:")
        print("- Coverage reports: htmlcov/")
        print("- XML coverage: coverage.xml")
        print("- Run 'make test' for Docker-based testing")
        sys.exit(0)
    else:
        print("\n❌ Some tests failed!")
        sys.exit(1)


if __name__ == "__main__":
    main()
