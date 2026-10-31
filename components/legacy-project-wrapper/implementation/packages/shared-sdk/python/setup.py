"""
Aviation Shared SDK - Python Package

Shared aviation utilities for Python applications.
"""

from setuptools import setup, find_packages

setup(
    name="aviation-shared-sdk",
    version="0.8.0",
    description="Shared aviation utilities for Python applications",
    author="Aviation Team",
    packages=find_packages(),
    python_requires=">=3.11",
    install_requires=[
        "httpx>=0.25.0",  # For weather API requests
        "pytz>=2024.1",  # For shared aviation date/time utilities
    ],
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3.11",
    ],
)
