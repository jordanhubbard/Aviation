from setuptools import setup, find_packages

setup(
    name='aviation-flight-dynamics',
    version='0.1.0',
    description='Flight physics simulation engine for aviation applications',
    author='Aviation Team',
    packages=find_packages(),
    python_requires='>=3.11',
    install_requires=[
        'fastapi>=0.70.0',
        'uvicorn>=0.15.0',
        'pydantic>=1.8.2',
        'numpy>=1.24.0',
    ],
    extras_require={
        'dev': [
            'pytest>=7.0',
            'pytest-cov>=4.0',
        ],
    },
)
