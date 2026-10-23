from __future__ import annotations

from app import create_app
from app.config import settings


app = create_app(settings)
