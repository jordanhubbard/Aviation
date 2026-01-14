"""Aviation SDK - Python wrapper for shared aviation utilities."""

__version__ = "0.2.0"

# Import sub-packages for convenient access
from . import weather
from . import integrations

__all__ = ['weather', 'integrations']
