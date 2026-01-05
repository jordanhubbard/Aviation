#!/usr/bin/env python3
import json
import os
import sys
from datetime import datetime, time, timezone

# Add the project root directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app, db
from app.models import (
    Aircraft, User, Booking, MaintenanceType, MaintenanceRecord, Squawk,
    WeatherMinima, FlightLog, Endorsement, Document, AuditLog, WaitlistEntry,
    RecurringBooking, EquipmentStatus
)

def load_test_data():
    app = create_app()
    
    with app.app_context():
        # Clear existing data
        RecurringBooking.query.delete()
        WaitlistEntry.query.delete()
        AuditLog.query.delete()
        Document.query.delete()
        Endorsement.query.delete()
        FlightLog.query.delete()
        WeatherMinima.query.delete()
        MaintenanceRecord.query.delete()
        EquipmentStatus.query.delete()
        Squawk.query.delete()
        MaintenanceType.query.delete()
        Booking.query.delete()
        Aircraft.query.delete()
        User.query.delete()
        
        # Load test data
        test_data_path = os.path.join(os.path.dirname(__file__), '..', 'tests', 'test_data.json')
        with open(test_data_path, 'r') as f:
            data = json.load(f)
        
        # Create users first (needed for foreign keys)
        user_map = {}  # To store email -> User object mapping
        for user_data in data['users']:
            user = User(
                email=user_data['email'],
                first_name=user_data['first_name'],
                last_name=user_data['last_name'],
                role=user_data['role'],
                is_admin=user_data.get('is_admin', False),
                is_instructor=user_data.get('is_instructor', False),
                status=user_data.get('status', 'active'),
                phone=user_data.get('phone'),
                student_id=user_data.get('student_id'),
                certificates=user_data.get('certificates'),
                instructor_rate_per_hour=user_data.get('instructor_rate_per_hour')
            )
            user.set_password(user_data['password'])
            db.session.add(user)
            db.session.flush()
            user_map[user.email] = user
        
        # Create aircraft
        aircraft_map = {}  # To store registration -> Aircraft object mapping
        for aircraft_data in data['aircraft']:
            # Convert dates from ISO format
            date_fields = [
                'last_maintenance', 'last_annual', 'last_100hr', 'last_pitot_static',
                'last_vor_check', 'last_altimeter', 'last_transponder', 'last_elt_check',
                'next_maintenance_date', 'insurance_expiry', 'registration_expiry',
                'airworthiness_date', 'date_of_next_annual'
            ]
            for field in date_fields:
                if field in aircraft_data and aircraft_data[field]:
                    dt = datetime.fromisoformat(aircraft_data[field].replace('Z', '+00:00'))
                    if field == 'date_of_next_annual':
                        aircraft_data[field] = dt.date()
                    else:
                        aircraft_data[field] = dt
            
            # Dynamically filter aircraft_data to only valid Aircraft fields
            valid_aircraft_fields = set(c.name for c in Aircraft.__table__.columns)
            filtered_aircraft_data = {k: v for k, v in aircraft_data.items() if k in valid_aircraft_fields}
            aircraft = Aircraft(**filtered_aircraft_data)
            db.session.add(aircraft)
            db.session.flush()
            aircraft_map[aircraft.registration] = aircraft
        
        # Create weather minima
        for minima_data in data['weather_minima']:
            minima = WeatherMinima(
                category=minima_data['category'],
                ceiling_min=minima_data['ceiling_min'],
                visibility_min=minima_data['visibility_min'],
                wind_max=minima_data['wind_max'],
                crosswind_max=minima_data['crosswind_max']
            )
            db.session.add(minima)
        
        # Create maintenance types
        maint_type_map = {}  # To store name -> MaintenanceType object mapping
        for mtype_data in data['maintenance_types']:
            created_by = user_map[mtype_data.pop('created_by_email')]
            mtype = MaintenanceType(
                name=mtype_data['name'],
                description=mtype_data['description'],
                interval_days=mtype_data.get('interval_days'),
                interval_hours=mtype_data.get('interval_hours'),
                created_by=created_by
            )
            db.session.add(mtype)
            db.session.flush()
            maint_type_map[mtype.name] = mtype
        
        # Create maintenance records
        for record_data in data['maintenance_records']:
            aircraft = aircraft_map[record_data['aircraft_registration']]
            mtype = maint_type_map[record_data['maintenance_type']]
            performed_by = user_map[record_data['performed_by_email']]
            
            # Convert dates from ISO format
            performed_at = datetime.fromisoformat(record_data['performed_at'].replace('Z', '+00:00'))
            next_due_date = None
            if record_data.get('next_due_date'):
                next_due_date = datetime.fromisoformat(record_data['next_due_date'].replace('Z', '+00:00'))
            
            record = MaintenanceRecord(
                aircraft=aircraft,
                maintenance_type=mtype,
                performed_at=performed_at,
                performed_by=performed_by,
                notes=record_data['notes'],
                hobbs_hours=record_data['hobbs_hours'],
                tach_hours=record_data['tach_hours'],
                parts_replaced=record_data.get('parts_replaced'),
                labor_hours=record_data.get('labor_hours'),
                cost=record_data.get('cost'),
                next_due_date=next_due_date,
                next_due_hours=record_data.get('next_due_hours')
            )
            db.session.add(record)
        
        # Create squawks
        for squawk_data in data['squawks']:
            aircraft = aircraft_map[squawk_data['aircraft_registration']]
            reported_by = user_map[squawk_data['reported_by_email']]
            created_at = datetime.fromisoformat(squawk_data['created_at'].replace('Z', '+00:00'))
            
            squawk = Squawk(
                aircraft=aircraft,
                description=squawk_data['description'],
                reported_by=reported_by,
                status=squawk_data['status'],
                created_at=created_at
            )
            db.session.add(squawk)
        
        # Create bookings
        booking_map = {}  # To store index -> Booking object mapping
        for idx, booking_data in enumerate(data['bookings'], 1):
            student = user_map[booking_data['student_email']]
            instructor = user_map[booking_data['instructor_email']] if booking_data.get('instructor_email') else None
            aircraft = aircraft_map[booking_data['aircraft_registration']]
            
            # Convert dates from ISO format
            start_time = datetime.fromisoformat(booking_data['start_time'].replace('Z', '+00:00'))
            end_time = datetime.fromisoformat(booking_data['end_time'].replace('Z', '+00:00'))
            
            booking = Booking(
                student=student,
                instructor=instructor,
                aircraft=aircraft,
                start_time=start_time,
                end_time=end_time,
                status=booking_data['status'],
                booking_type=booking_data['booking_type'],
                lesson_type=booking_data['lesson_type'],
                cancellation_reason=booking_data.get('cancellation_reason'),
                cancellation_notes=booking_data.get('cancellation_notes'),
                weather_briefing=booking_data.get('weather_briefing'),
                weather_conditions=booking_data.get('weather_conditions'),
                notification_sent=booking_data.get('notification_sent', False),
                notes=booking_data.get('notes')
            )
            db.session.add(booking)
            db.session.flush()
            booking_map[idx] = booking
        
        # Create flight logs
        for log_data in data['flight_logs']:
            booking = booking_map[log_data['booking_id']]
            aircraft = aircraft_map[booking.aircraft.registration]
            pic = user_map[log_data['pic_email']]
            sic = user_map[log_data['sic_email']] if log_data.get('sic_email') else None
            
            # Convert date from ISO format
            flight_date = datetime.fromisoformat(log_data['flight_date'].replace('Z', '+00:00'))
            
            log = FlightLog(
                booking=booking,
                aircraft=aircraft,
                user_id=pic.id,
                flight_date=flight_date,
                route=log_data['route'],
                departure_airport=log_data['departure_airport'],
                arrival_airport=log_data['arrival_airport'],
                alternate_airport=log_data.get('alternate_airport'),
                remarks=log_data['remarks'],
                weather_conditions=log_data['weather_conditions'],
                flight_conditions=log_data['flight_conditions'],
                ground_instruction=log_data['ground_instruction'],
                dual_received=log_data['dual_received'],
                pic_time=log_data['pic_time'],
                sic_time=log_data['sic_time'],
                cross_country=log_data['cross_country'],
                night=log_data['night'],
                actual_instrument=log_data['actual_instrument'],
                simulated_instrument=log_data['simulated_instrument'],
                hood_time=log_data['hood_time'],
                landings_day=log_data['landings_day'],
                landings_night=log_data['landings_night'],
                approaches=log_data['approaches'],
                approach_types=log_data['approach_types'],
                holds=log_data['holds']
            )
            db.session.add(log)
        
        # Create endorsements
        for endorsement_data in data['endorsements']:
            student = user_map[endorsement_data['student_email']]
            instructor = user_map[endorsement_data['instructor_email']]
            
            # Convert date from ISO format
            expiration = None
            if endorsement_data.get('expiration'):
                expiration = datetime.fromisoformat(endorsement_data['expiration'].replace('Z', '+00:00'))
            
            endorsement = Endorsement(
                student=student,
                instructor=instructor,
                type=endorsement_data['type'],
                description=endorsement_data['description'],
                expiration=expiration,
                document_url=endorsement_data.get('document_url')
            )
            db.session.add(endorsement)
        
        # Create documents
        for document_data in data['documents']:
            user = user_map[document_data['user_email']]
            
            # Convert date from ISO format
            expiration = None
            if document_data.get('expiration'):
                expiration = datetime.fromisoformat(document_data['expiration'].replace('Z', '+00:00'))
            
            document = Document(
                user=user,
                type=document_data['type'],
                filename=document_data['filename'],
                url=document_data['url'],
                expiration=expiration
            )
            db.session.add(document)
        
        # Create waitlist entries
        for entry_data in data['waitlist_entries']:
            student = user_map[entry_data['student_email']]
            instructor = user_map[entry_data['instructor_email']] if entry_data.get('instructor_email') else None
            aircraft = aircraft_map[entry_data['aircraft_registration']]
            
            # Convert date from ISO format
            requested_date = datetime.fromisoformat(entry_data['requested_date'].replace('Z', '+00:00'))
            
            entry = WaitlistEntry(
                student_id=student.id,
                instructor_id=instructor.id if instructor else None,
                aircraft_id=aircraft.id,
                requested_date=requested_date,
                time_preference=entry_data['time_preference'],
                duration_hours=entry_data['duration_hours'],
                status=entry_data['status']
            )
            db.session.add(entry)
        
        # Create recurring bookings
        for recurring_data in data['recurring_bookings']:
            student = user_map[recurring_data['student_email']]
            instructor = user_map[recurring_data['instructor_email']] if recurring_data.get('instructor_email') else None
            aircraft = aircraft_map[recurring_data['aircraft_registration']]
            
            # Convert dates from ISO format
            start_date = datetime.fromisoformat(recurring_data['start_date'].replace('Z', '+00:00'))
            end_date = None
            if recurring_data.get('end_date'):
                end_date = datetime.fromisoformat(recurring_data['end_date'].replace('Z', '+00:00'))
            
            # Convert time string to time object
            start_time = datetime.strptime(recurring_data['start_time'], '%H:%M:%S').time()
            
            recurring = RecurringBooking(
                student_id=student.id,
                instructor_id=instructor.id if instructor else None,
                aircraft_id=aircraft.id,
                day_of_week=recurring_data['day_of_week'],
                start_time=start_time,
                duration_hours=recurring_data['duration_hours'],
                start_date=start_date,
                end_date=end_date,
                status=recurring_data['status']
            )
            db.session.add(recurring)
        
        # Create audit logs
        for log_data in data['audit_logs']:
            user = user_map[log_data['user_email']]
            
            log = AuditLog(
                user=user,
                action=log_data['action'],
                table_name=log_data['table_name'],
                record_id=log_data['record_id'],
                changes=log_data['changes']
            )
            db.session.add(log)
        
        # Commit all changes
        db.session.commit()

if __name__ == '__main__':
    load_test_data()