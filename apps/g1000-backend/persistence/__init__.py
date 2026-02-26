"""G1000 Backend Persistence Layer

Provides abstraction for data storage with support for SQLite and PostgreSQL.
"""

from .base import StorageAdapter, StorageConfig
from .sqlite_adapter import SQLiteAdapter
from .postgresql_adapter import PostgreSQLAdapter
from .factory import create_storage_adapter

__all__ = [
    'StorageAdapter',
    'StorageConfig',
    'SQLiteAdapter',
    'PostgreSQLAdapter',
    'create_storage_adapter',
]
