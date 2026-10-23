from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify
from flask_login import login_required, current_user
from app import db
from app.models import Booking, Aircraft, CheckIn, CheckOut, MaintenanceRecord, Squawk
from app.utils.datetime_utils import utcnow, to_utc, from_utc, format_datetime
from functools import wraps

flight_bp = Blueprint('flight', __name__, url_prefix='/flight')

def student_or_instructor_required(f):
    """Decorator to require student or instructor access."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not (current_user.role == 'student' or current_user.role == 'instructor' or current_user.is_admin):
            flash('Access denied. Student or instructor privileges required.', 'error')
            return redirect(url_for('main.index'))
        return f(*args, **kwargs)
    return decorated_function

@flight_bp.route('/check-in/<int:booking_id>', methods=['GET', 'POST'])
@login_required
@student_or_instructor_required
def check_in(booking_id):
    """Check in for a flight."""
    booking = Booking.query.get_or_404(booking_id)
    
    # Verify user is associated with this booking
    if not (current_user.id == booking.student_id or 
            current_user.id == booking.instructor_id or 
            current_user.is_admin):
        flash('You are not authorized to check in for this flight.', 'error')
        return redirect(url_for('booking.dashboard'))
    
    # Check if already checked in
    if booking.check_in:
        flash('This flight has already been checked in.', 'warning')
        return redirect(url_for('flight.flight_status', booking_id=booking_id))
    
    # Get maintenance records and squawks for the aircraft
    maintenance_records = MaintenanceRecord.query.filter_by(aircraft_id=booking.aircraft_id).order_by(MaintenanceRecord.performed_at.desc()).limit(5).all()
    open_squawks = Squawk.query.filter_by(aircraft_id=booking.aircraft_id, status='open').all()
    
    if request.method == 'POST':
        try:
            # Create check-in record
            check_in = CheckIn(
                booking_id=booking_id,
                aircraft_id=booking.aircraft_id,
                instructor_id=current_user.id if current_user.is_instructor else None,
                check_in_time=utcnow(),
                hobbs_start=float(request.form['hobbs_start']),
                tach_start=float(request.form['tach_start']),
                weather_conditions_acceptable=request.form.get('weather_conditions_acceptable') == 'on',
                notes=request.form.get('notes', '')
            )
            
            # Update booking status
            booking.status = 'in_progress'
            
            db.session.add(check_in)
            db.session.commit()
            
            flash('Flight check-in completed successfully.', 'success')
            return redirect(url_for('flight.flight_status', booking_id=booking_id))
        except Exception as e:
            db.session.rollback()
            flash(f'Error during check-in: {str(e)}', 'error')
    
    return render_template('flight/check_in.html', 
                           booking=booking, 
                           maintenance_records=maintenance_records,
                           open_squawks=open_squawks)

@flight_bp.route('/check-out/<int:booking_id>', methods=['GET', 'POST'])
@login_required
@student_or_instructor_required
def check_out(booking_id):
    """Check out from a flight."""
    booking = Booking.query.get_or_404(booking_id)
    
    # Verify user is associated with this booking
    if not (current_user.id == booking.student_id or 
            current_user.id == booking.instructor_id or 
            current_user.is_admin):
        flash('You are not authorized to check out for this flight.', 'error')
        return redirect(url_for('booking.dashboard'))
    
    # Check if already checked out
    if booking.check_out:
        flash('This flight has already been checked out.', 'warning')
        return redirect(url_for('flight.flight_summary', booking_id=booking_id))
    
    # Check if not checked in yet
    if not booking.check_in:
        flash('You must check in before checking out.', 'warning')
        return redirect(url_for('flight.check_in', booking_id=booking_id))
    
    if request.method == 'POST':
        try:
            # Create check-out record
            check_out = CheckOut(
                booking_id=booking_id,
                aircraft_id=booking.aircraft_id,
                instructor_id=current_user.id if current_user.is_instructor else None,
                check_out_time=utcnow(),
                hobbs_end=float(request.form['hobbs_end']),
                tach_end=float(request.form['tach_end']),
                notes=request.form.get('notes', '')
            )
            
            # Update booking status
            booking.status = 'completed'
            
            # Update aircraft hobbs and tach times
            aircraft = booking.aircraft
            aircraft.hobbs_time = check_out.hobbs_end
            aircraft.tach_time = check_out.tach_end
            
            # Create squawk if reported
            if request.form.get('has_squawk') == 'on' and request.form.get('squawk_description'):
                squawk = Squawk(
                    aircraft_id=booking.aircraft_id,
                    description=request.form.get('squawk_description'),
                    reported_by_id=current_user.id,
                    status='open'
                )
                db.session.add(squawk)
            
            db.session.add(check_out)
            db.session.commit()
            
            flash('Flight check-out completed successfully.', 'success')
            return redirect(url_for('flight.flight_summary', booking_id=booking_id))
        except Exception as e:
            db.session.rollback()
            flash(f'Error during check-out: {str(e)}', 'error')
    
    return render_template('flight/check_out.html', 
                           booking=booking, 
                           check_in=booking.check_in)

@flight_bp.route('/status/<int:booking_id>')
@login_required
@student_or_instructor_required
def flight_status(booking_id):
    """View the status of an in-progress flight."""
    booking = Booking.query.get_or_404(booking_id)
    
    # Verify user is associated with this booking
    if not (current_user.id == booking.student_id or 
            current_user.id == booking.instructor_id or 
            current_user.is_admin):
        flash('You are not authorized to view this flight.', 'error')
        return redirect(url_for('booking.dashboard'))
    
    # Get maintenance records and squawks for the aircraft
    maintenance_records = MaintenanceRecord.query.filter_by(aircraft_id=booking.aircraft_id).order_by(MaintenanceRecord.performed_at.desc()).limit(5).all()
    open_squawks = Squawk.query.filter_by(aircraft_id=booking.aircraft_id, status='open').all()
    
    return render_template('flight/status.html', 
                           booking=booking,
                           maintenance_records=maintenance_records,
                           open_squawks=open_squawks)

@flight_bp.route('/summary/<int:booking_id>')
@login_required
@student_or_instructor_required
def flight_summary(booking_id):
    """View the summary of a completed flight."""
    booking = Booking.query.get_or_404(booking_id)
    
    # Verify user is associated with this booking
    if not (current_user.id == booking.student_id or 
            current_user.id == booking.instructor_id or 
            current_user.is_admin):
        flash('You are not authorized to view this flight.', 'error')
        return redirect(url_for('booking.dashboard'))
    
    return render_template('flight/summary.html', booking=booking)

@flight_bp.route('/squawk/add/<int:aircraft_id>', methods=['POST'])
@login_required
@student_or_instructor_required
def add_squawk(aircraft_id):
    """Add a new squawk for an aircraft."""
    aircraft = Aircraft.query.get_or_404(aircraft_id)
    
    if request.method == 'POST':
        try:
            ground_airplane = request.form.get('ground_airplane') == 'on'
            
            squawk = Squawk(
                aircraft_id=aircraft_id,
                description=request.form.get('description'),
                reported_by_id=current_user.id,
                status='open',
                ground_airplane=ground_airplane
            )
            db.session.add(squawk)
            db.session.commit()
            
            flash('Squawk reported successfully.', 'success')
            
            # If this squawk grounds the aircraft, update the aircraft status
            if ground_airplane:
                flash('Aircraft has been marked as grounded due to this squawk.', 'warning')
        except Exception as e:
            db.session.rollback()
            flash(f'Error reporting squawk: {str(e)}', 'error')
    
    return redirect(request.referrer or url_for('booking.dashboard'))

@flight_bp.route('/maintenance/<int:aircraft_id>')
@login_required
@student_or_instructor_required
def maintenance_records(aircraft_id):
    """View all maintenance records for an aircraft."""
    aircraft = Aircraft.query.get_or_404(aircraft_id)
    
    maintenance_records = MaintenanceRecord.query.filter_by(aircraft_id=aircraft_id).order_by(MaintenanceRecord.performed_at.desc()).all()
    squawks = Squawk.query.filter_by(aircraft_id=aircraft_id).order_by(Squawk.created_at.desc()).all()
    
    return render_template('flight/maintenance.html', 
                           aircraft=aircraft,
                           maintenance_records=maintenance_records,
                           squawks=squawks)
