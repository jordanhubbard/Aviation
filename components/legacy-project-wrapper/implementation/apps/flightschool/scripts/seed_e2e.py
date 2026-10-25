"""Seed only an isolated Flight School E2E database, then serve it with create_app('e2e')."""
import os
from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from app import create_app, db
from app.models import Aircraft, Booking, CheckIn, CheckOut, MaintenanceRecord, MaintenanceType, Squawk, User

run = os.environ['AVIATION_E2E_RUN_ID']
app = create_app('e2e')
with app.app_context():
    db.create_all()
    with db.engine.begin() as connection:
        connection.execute(text('CREATE TABLE IF NOT EXISTS e2e_runs '
                                '(test_run_id TEXT PRIMARY KEY, is_test_data INTEGER NOT NULL CHECK(is_test_data=1))'))
        connection.execute(text('INSERT OR IGNORE INTO e2e_runs VALUES (:run, 1)'), {'run': run})
        for table in db.metadata.tables:
            columns = {row[1] for row in connection.exec_driver_sql(f'PRAGMA table_info("{table}")')}
            if 'is_test_data' not in columns:
                connection.exec_driver_sql(f'ALTER TABLE "{table}" ADD COLUMN is_test_data INTEGER NOT NULL '
                                           'DEFAULT 1 CHECK(is_test_data=1)')
            if 'test_run_id' not in columns:
                connection.exec_driver_sql(f'ALTER TABLE "{table}" ADD COLUMN test_run_id TEXT NOT NULL '
                                           f"DEFAULT '{run}' CHECK(test_run_id='{run}')")

    users = {}
    for role in ('admin', 'instructor', 'student'):
        user = User(email=f'{role}-{run}@example.com', first_name='E2E',
                    last_name=role.title(), role=role, is_admin=(role == 'admin'),
                    is_instructor=(role == 'instructor'), status='active')
        user.set_password(run)
        db.session.add(user)
        db.session.flush()
        users[role] = user
    aircraft = Aircraft(registration='N123ET', make='Cessna', model='172S', year=2020,
                        status='available', category='single_engine_land', engine_type='piston',
                        num_engines=1, ifr_equipped=True, gps=True, autopilot=True,
                        rate_per_hour=150.0, hobbs_time=100.0, tach_time=99.0,
                        description=f'Synthetic aircraft {run}',
                        last_maintenance=datetime.now(timezone.utc))
    db.session.add(aircraft)
    db.session.flush()
    now = datetime.now(timezone.utc)
    for offset, status in ((1, 'confirmed'), (2, 'in_progress'), (3, 'completed')):
        booking = Booking(student_id=users['student'].id, instructor_id=users['instructor'].id,
                          aircraft_id=aircraft.id, start_time=now + timedelta(days=offset),
                          end_time=now + timedelta(days=offset, hours=1),
                          status=status, booking_type='training', notes=f'Synthetic booking {run}')
        db.session.add(booking)
        db.session.flush()
        if offset >= 2:
            db.session.add(CheckIn(booking_id=booking.id, aircraft_id=aircraft.id,
                                   instructor_id=users['instructor'].id, check_in_time=now - timedelta(hours=1),
                                   hobbs_start=100.0, tach_start=99.0, weather_conditions_acceptable=True))
        if offset == 3:
            db.session.add(CheckOut(booking_id=booking.id, aircraft_id=aircraft.id,
                                    instructor_id=users['instructor'].id, check_out_time=now,
                                    hobbs_end=101.0, tach_end=100.0, notes=f'Synthetic checkout {run}'))
    maintenance_type = MaintenanceType(name=f'E2E inspection {run}', description='Synthetic maintenance',
                                       created_by_id=users['admin'].id, interval_days=30)
    db.session.add(maintenance_type)
    db.session.flush()
    db.session.add(MaintenanceRecord(aircraft_id=aircraft.id, maintenance_type_id=maintenance_type.id,
                                     performed_at=datetime.now(timezone.utc), performed_by_id=users['admin'].id,
                                     notes=f'Synthetic maintenance {run}', status='completed', hobbs_hours=100.0))
    db.session.add(Squawk(aircraft_id=aircraft.id, reported_by_id=users['student'].id,
                          description=f'Synthetic squawk {run}', status='open'))
    db.session.commit()
    print(f'Seeded isolated Flight School E2E run {run}', flush=True)
