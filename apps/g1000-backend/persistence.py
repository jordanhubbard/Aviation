# SQLite persistence layer for G1000 data
import sqlite3
from contextlib import closing

DATABASE = 'g1000_data.db'

# Initialize the database and create tables

def init_db():
    with closing(sqlite3.connect(DATABASE)) as conn:
        with conn as cursor:
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

# CRUD operations

def add_flight_plan(name, data):
    with closing(sqlite3.connect(DATABASE)) as conn:
        with conn as cursor:
            cursor.execute('INSERT INTO flight_plans (name, data) VALUES (?, ?)', (name, data))


def get_flight_plan(plan_id):
    with closing(sqlite3.connect(DATABASE)) as conn:
        with conn as cursor:
            cursor.execute('SELECT * FROM flight_plans WHERE id = ?', (plan_id,))
            return cursor.fetchone()


def update_flight_plan(plan_id, name, data):
    with closing(sqlite3.connect(DATABASE)) as conn:
        with conn as cursor:
            cursor.execute('UPDATE flight_plans SET name = ?, data = ? WHERE id = ?', (name, data, plan_id))


def delete_flight_plan(plan_id):
    with closing(sqlite3.connect(DATABASE)) as conn:
        with conn as cursor:
            cursor.execute('DELETE FROM flight_plans WHERE id = ?', (plan_id,))

# Ensure transaction safety by using context managers

if __name__ == '__main__':
    init_db()
