# Database schema migrations for G1000 simulator
import sqlite3
from contextlib import closing
from datetime import datetime

DATABASE = 'g1000_data.db'


class Migration:
    """Base migration class for managing schema changes."""
    
    def __init__(self, version, description):
        self.version = version
        self.description = description
    
    def up(self, conn):
        """Apply the migration."""
        raise NotImplementedError
    
    def down(self, conn):
        """Rollback the migration."""
        raise NotImplementedError


class Migration001_InitialSchema(Migration):
    """Initial schema creation for flight plans and settings."""
    
    def __init__(self):
        super().__init__('001', 'Initial schema creation')
    
    def up(self, conn):
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS flight_plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                origin TEXT,
                destination TEXT,
                data TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT NOT NULL UNIQUE,
                value TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                version TEXT NOT NULL UNIQUE,
                description TEXT,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()
    
    def down(self, conn):
        cursor = conn.cursor()
        cursor.execute('DROP TABLE IF EXISTS flight_plans')
        cursor.execute('DROP TABLE IF EXISTS settings')
        cursor.execute('DROP TABLE IF EXISTS migrations')
        conn.commit()


class Migration002_AddFlightRecordings(Migration):
    """Add flight recordings table for storing flight data."""
    
    def __init__(self):
        super().__init__('002', 'Add flight recordings table')
    
    def up(self, conn):
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS flight_recordings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                flight_plan_id INTEGER,
                duration_seconds INTEGER,
                data TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (flight_plan_id) REFERENCES flight_plans(id)
            )
        ''')
        conn.commit()
    
    def down(self, conn):
        cursor = conn.cursor()
        cursor.execute('DROP TABLE IF EXISTS flight_recordings')
        conn.commit()


class Migration003_AddAutopilotPresets(Migration):
    """Add autopilot presets table for saving autopilot configurations."""
    
    def __init__(self):
        super().__init__('003', 'Add autopilot presets table')
    
    def up(self, conn):
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS autopilot_presets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                lateral_mode TEXT,
                vertical_mode TEXT,
                heading_select INTEGER,
                altitude_select INTEGER,
                vertical_speed_select INTEGER,
                data TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()
    
    def down(self, conn):
        cursor = conn.cursor()
        cursor.execute('DROP TABLE IF EXISTS autopilot_presets')
        conn.commit()


class MigrationManager:
    """Manages database migrations."""
    
    def __init__(self, database_path=DATABASE):
        self.database_path = database_path
        self.migrations = [
            Migration001_InitialSchema(),
            Migration002_AddFlightRecordings(),
            Migration003_AddAutopilotPresets(),
        ]
    
    def get_applied_migrations(self, conn):
        """Get list of applied migrations."""
        cursor = conn.cursor()
        try:
            cursor.execute('SELECT version FROM migrations ORDER BY applied_at')
            return [row[0] for row in cursor.fetchall()]
        except sqlite3.OperationalError:
            # migrations table doesn't exist yet
            return []
    
    def record_migration(self, conn, version, description):
        """Record a migration as applied."""
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO migrations (version, description) VALUES (?, ?)',
            (version, description)
        )
        conn.commit()
    
    def migrate_up(self):
        """Apply all pending migrations."""
        with closing(sqlite3.connect(self.database_path)) as conn:
            applied = self.get_applied_migrations(conn)
            
            for migration in self.migrations:
                if migration.version not in applied:
                    print(f'Applying migration {migration.version}: {migration.description}')
                    migration.up(conn)
                    self.record_migration(conn, migration.version, migration.description)
                    print(f'Migration {migration.version} applied successfully')
    
    def migrate_down(self, steps=1):
        """Rollback the last N migrations."""
        with closing(sqlite3.connect(self.database_path)) as conn:
            applied = self.get_applied_migrations(conn)
            
            for _ in range(steps):
                if not applied:
                    print('No migrations to rollback')
                    break
                
                version_to_rollback = applied[-1]
                migration = next(
                    (m for m in self.migrations if m.version == version_to_rollback),
                    None
                )
                
                if migration:
                    print(f'Rolling back migration {migration.version}: {migration.description}')
                    migration.down(conn)
                    cursor = conn.cursor()
                    cursor.execute('DELETE FROM migrations WHERE version = ?', (version_to_rollback,))
                    conn.commit()
                    print(f'Migration {migration.version} rolled back successfully')
                    applied.pop()


if __name__ == '__main__':
    manager = MigrationManager()
    manager.migrate_up()
