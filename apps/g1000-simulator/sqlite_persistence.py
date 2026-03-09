# SQLite persistence layer for G1000 data
import sqlite3
from contextlib import contextmanager

DATABASE_FILE = 'g1000_data.db'

@contextmanager
def get_db_connection():
    conn = sqlite3.connect(DATABASE_FILE)
    try:
        yield conn
    finally:
        conn.close()

def initialize_db():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS flight_plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                data TEXT NOT NULL
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT NOT NULL,
                value TEXT NOT NULL
            )
        ''')
        conn.commit()

def create_flight_plan(name, data):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('INSERT INTO flight_plans (name, data) VALUES (?, ?)', (name, data))
        conn.commit()

def get_flight_plan(plan_id):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM flight_plans WHERE id = ?', (plan_id,))
        return cursor.fetchone()

def update_flight_plan(plan_id, name, data):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('UPDATE flight_plans SET name = ?, data = ? WHERE id = ?', (name, data, plan_id))
        conn.commit()

def delete_flight_plan(plan_id):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM flight_plans WHERE id = ?', (plan_id,))
        conn.commit()

def create_setting(key, value):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('INSERT INTO settings (key, value) VALUES (?, ?)', (key, value))
        conn.commit()

def get_setting(key):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT value FROM settings WHERE key = ?', (key,))
        return cursor.fetchone()

def update_setting(key, value):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('UPDATE settings SET value = ? WHERE key = ?', (value, key))
        conn.commit()

def delete_setting(key):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM settings WHERE key = ?', (key,))
        conn.commit()

initialize_db()
