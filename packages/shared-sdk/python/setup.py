"""
Setup script for Aviation SDK Python package
"""

from setuptools import setup, find_packages

with open('README.md', 'r', encoding='utf-8') as f:
    long_description = f.read()

setup(
    name='aviation-sdk',
    version='0.2.0',
    description='Shared SDK for aviation applications',
    long_description=long_description,
    long_description_content_type='text/markdown',
    author='Jordan Hubbard',
    license='MIT',
    packages=find_packages(),
    python_requires='>=3.11',
    install_requires=[
        'google-auth>=2.41.0',
        'google-auth-oauthlib>=1.2.3',
        'google-auth-httplib2>=0.3.0',
        'google-api-python-client>=2.187.0',
    ],
    classifiers=[
        'Development Status :: 4 - Beta',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: MIT License',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.11',
        'Programming Language :: Python :: 3.12',
    ],
    keywords='aviation google-calendar weather sdk',
)
