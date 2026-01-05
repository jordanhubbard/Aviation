from flask import Blueprint, render_template, flash, redirect, url_for, request
from flask_login import login_required, current_user
from app.models import User, Aircraft, Booking, MaintenanceRecord, MaintenanceType
from datetime import datetime, timedelta
from app import db
from functools import wraps

admin_bp = Blueprint('admin', __name__)


def admin_required(f):
    """Decorator to require admin access."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_admin:
            flash('Access denied. Admin privileges required.', 'error')
            return redirect(url_for('main.index'))
        return f(*args, **kwargs)
    return decorated_function


@admin_bp.route('/dashboard')
@login_required
@admin_required
def dashboard():
    """Display admin dashboard."""
    # Get statistics
    stats = {
        'total_users': User.query.count(),
        'active_users': User.query.filter_by(status='active').count(),
        'total_aircraft': Aircraft.query.count(),
        'available_aircraft': Aircraft.query.filter_by(status='available').count(),
        'pending_bookings': Booking.query.filter_by(status='pending').count(),
        'maintenance_due': MaintenanceRecord.query.filter_by(status='due').count()
    }
    
    # Get lists of instructors, students, and aircraft for the dashboard tabs
    instructors = User.query.filter_by(is_instructor=True).all()
    students = User.query.filter_by(is_instructor=False, is_admin=False).all()
    aircraft_list = Aircraft.query.all()
    
    return render_template('admin/dashboard.html', 
                          stats=stats, 
                          instructors=instructors, 
                          students=students, 
                          aircraft_list=aircraft_list)


@admin_bp.route('/users')
@login_required
@admin_required
def users():
    """Display user management page."""
    users = User.query.order_by(User.last_name).all()
    return render_template('admin/users.html', users=users)


@admin_bp.route('/aircraft')
@login_required
@admin_required
def aircraft():
    """Display aircraft management page."""
    aircraft = Aircraft.query.order_by(Aircraft.registration).all()
    return render_template('admin/aircraft.html', aircraft=aircraft)


@admin_bp.route('/reports')
@login_required
@admin_required
def reports():
    """Display reports page."""
    return render_template('admin/reports.html')


@admin_bp.route('/settings')
@login_required
@admin_required
def settings():
    """Display admin settings page."""
    return render_template('admin/settings.html')


@admin_bp.route('/schedule')
@login_required
@admin_required
def schedule():
    """Display master schedule."""
    start_date = datetime.now()
    end_date = start_date + timedelta(days=30)
    bookings = Booking.query.filter(
        Booking.start_time >= start_date,
        Booking.start_time <= end_date
    ).order_by(Booking.start_time).all()
    return render_template('admin/schedule.html', bookings=bookings)


@admin_bp.route('/maintenance/records')
@login_required
@admin_required
def maintenance_records():
    """Display maintenance records."""
    records = MaintenanceRecord.query.order_by(MaintenanceRecord.performed_at.desc()).all()
    return render_template('admin/maintenance_list.html', maintenance_records=records)


@admin_bp.route('/squawks')
@login_required
@admin_required
def squawks():
    """Display aircraft squawks."""
    return render_template('admin/squawks.html')


@admin_bp.route('/audit-logs')
@login_required
@admin_required
def audit_logs():
    """Display audit logs."""
    return render_template('admin/audit_logs.html')


@admin_bp.route('/weather-minima')
@login_required
@admin_required
def weather_minima():
    """Display weather minima settings."""
    return render_template('admin/weather_minima.html')


@admin_bp.route('/aircraft/create', methods=['GET', 'POST'])
@login_required
@admin_required
def create_aircraft():
    """Create a new aircraft."""
    error_message = None
    
    if request.method == 'POST':
        try:
            # Create new aircraft from form data
            aircraft = Aircraft(
                registration=request.form['registration'],
                make=request.form['make'],
                model=request.form['model'],
                year=int(request.form['year']) if request.form.get('year') else None,
                description=request.form.get('description', ''),
                status=request.form.get('status', 'available'),
                category=request.form.get('category', 'single_engine'),
                engine_type=request.form.get('engine_type', 'piston'),
                num_engines=int(request.form.get('num_engines', 1)),
                ifr_equipped='ifr_equipped' in request.form,
                gps='gps' in request.form,
                autopilot='autopilot' in request.form,
                rate_per_hour=float(request.form['rate_per_hour']) if request.form.get('rate_per_hour') else 0.0
            )
            
            # Set maintenance details if provided
            if request.form.get('hobbs_time'):
                aircraft.hobbs_time = float(request.form['hobbs_time'])
            if request.form.get('tach_time'):
                aircraft.tach_time = float(request.form['tach_time'])
            if request.form.get('time_to_next_oil_change'):
                aircraft.time_to_next_oil_change = float(request.form['time_to_next_oil_change'])
            if request.form.get('time_to_next_100hr'):
                aircraft.time_to_next_100hr = float(request.form['time_to_next_100hr'])
            if request.form.get('date_of_next_annual'):
                from datetime import datetime
                aircraft.date_of_next_annual = datetime.strptime(request.form['date_of_next_annual'], '%Y-%m-%d').date()
            
            # Handle image upload if provided
            if 'image' in request.files and request.files['image'].filename:
                from werkzeug.utils import secure_filename
                import os
                from app.models import STATIC_IMAGE_DIR
                
                # Get the uploaded file
                file = request.files['image']
                filename = secure_filename(aircraft.registration.lower() + os.path.splitext(file.filename)[1])
                
                # Save the file
                file_path = os.path.join(STATIC_IMAGE_DIR, filename)
                file.save(file_path)
                
                # Update the aircraft record
                aircraft.image_filename = filename
            
            # Add the aircraft to the database
            db.session.add(aircraft)
            db.session.commit()
            
            flash(f'Aircraft {aircraft.registration} created successfully.', 'success')
            return redirect(url_for('admin.aircraft'))
        except Exception as e:
            db.session.rollback()
            error_message = f"Error creating aircraft: {str(e)}"
    
    return render_template('admin/aircraft_form.html', aircraft=None, edit_mode=False, error_message=error_message)


@admin_bp.route('/aircraft/<int:id>/delete', methods=['POST'])
@login_required
@admin_required
def delete_aircraft(id):
    """Delete an aircraft."""
    aircraft = Aircraft.query.get_or_404(id)
    
    # Check if aircraft has any bookings
    if aircraft.bookings.count() > 0:
        flash('Cannot delete aircraft with existing bookings.', 'error')
        return redirect(url_for('admin.aircraft'))
    
    # Delete the aircraft
    db.session.delete(aircraft)
    db.session.commit()
    
    flash(f'Aircraft {aircraft.registration} deleted successfully.', 'success')
    return redirect(url_for('admin.aircraft'))


@admin_bp.route('/aircraft/<int:id>/edit', methods=['GET', 'POST'])
@login_required
@admin_required
def edit_aircraft(id):
    """Edit an existing aircraft."""
    aircraft = Aircraft.query.get_or_404(id)
    error_message = None
    
    if request.method == 'POST':
        try:
            # Update aircraft details
            aircraft.registration = request.form['registration']
            aircraft.make = request.form['make']
            aircraft.model = request.form['model']
            aircraft.year = int(request.form['year']) if request.form['year'] else None
            aircraft.description = request.form['description']
            aircraft.status = request.form['status']
            aircraft.category = request.form['category']
            aircraft.engine_type = request.form['engine_type']
            aircraft.num_engines = int(request.form['num_engines']) if request.form['num_engines'] else 1
            aircraft.ifr_equipped = 'ifr_equipped' in request.form
            aircraft.gps = 'gps' in request.form
            aircraft.autopilot = 'autopilot' in request.form
            aircraft.rate_per_hour = float(request.form['rate_per_hour']) if request.form['rate_per_hour'] else 0.0
            
            # Update maintenance details if provided
            if request.form.get('hobbs_time'):
                aircraft.hobbs_time = float(request.form['hobbs_time'])
            if request.form.get('tach_time'):
                aircraft.tach_time = float(request.form['tach_time'])
            if request.form.get('time_to_next_oil_change'):
                aircraft.time_to_next_oil_change = float(request.form['time_to_next_oil_change'])
            if request.form.get('time_to_next_100hr'):
                aircraft.time_to_next_100hr = float(request.form['time_to_next_100hr'])
            if request.form.get('date_of_next_annual'):
                from datetime import datetime
                aircraft.date_of_next_annual = datetime.strptime(request.form['date_of_next_annual'], '%Y-%m-%d').date()
            
            # Handle image upload if provided
            if 'image' in request.files and request.files['image'].filename:
                from werkzeug.utils import secure_filename
                import os
                from app.models import STATIC_IMAGE_DIR
                
                # Get the uploaded file
                file = request.files['image']
                filename = secure_filename(aircraft.registration.lower() + os.path.splitext(file.filename)[1])
                
                # Save the file
                file_path = os.path.join(STATIC_IMAGE_DIR, filename)
                file.save(file_path)
                
                # Update the aircraft record
                aircraft.image_filename = filename
            
            # Handle image deletion if requested
            if 'delete_image' in request.form and request.form['delete_image'] == 'on':
                import os
                from app.models import STATIC_IMAGE_DIR
                
                # Delete the file if it exists
                if aircraft.image_filename:
                    file_path = os.path.join(STATIC_IMAGE_DIR, aircraft.image_filename)
                    if os.path.exists(file_path):
                        os.remove(file_path)
                
                # Clear the filename in the database
                aircraft.image_filename = None
            
            # Save the changes
            db.session.commit()
            
            flash(f'Aircraft {aircraft.registration} updated successfully.', 'success')
            return redirect(url_for('admin.aircraft'))
        except Exception as e:
            db.session.rollback()
            error_message = f"Error updating aircraft: {str(e)}"
    
    return render_template('admin/aircraft_form.html', aircraft=aircraft, edit_mode=True, error_message=error_message)


@admin_bp.route('/calendar/oauth')
@login_required
@admin_required
def calendar_oauth():
    """Start Google Calendar OAuth2 flow for admin settings."""
    return redirect(url_for('settings.calendar_authorize'))


@admin_bp.route('/calendar/callback')
@login_required
@admin_required
def calendar_callback():
    """Handle Google Calendar OAuth2 callback for admin settings."""
    return redirect(url_for('settings.calendar_callback'))


@admin_bp.route('/maintenance/types')
@login_required
@admin_required
def maintenance_types():
    """Display maintenance types."""
    types = MaintenanceType.query.order_by(MaintenanceType.name).all()
    return render_template('admin/maintenance_types.html', types=types)


@admin_bp.route('/instructors')
@login_required
@admin_required
def instructors():
    """Display instructor management page."""
    instructors = User.query.filter_by(is_instructor=True).order_by(User.last_name).all()
    return render_template('admin/instructors.html', instructors=instructors)


@admin_bp.route('/instructor/create', methods=['GET', 'POST'])
@login_required
@admin_required
def create_instructor():
    """Create a new instructor."""
    return redirect(url_for('admin.create_user', type='instructor'))


@admin_bp.route('/endorsements')
@login_required
@admin_required
def endorsements():
    """Display endorsement management page."""
    return render_template('admin/endorsements.html')


@admin_bp.route('/documents')
@login_required
@admin_required
def documents():
    """Display document management page."""
    return render_template('admin/documents.html')


@admin_bp.route('/user/create', methods=['GET', 'POST'])
@login_required
@admin_required
def create_user():
    """Create a new user (instructor or student)."""
    user_type = request.args.get('type', 'student')
    error_message = None
    
    if request.method == 'POST':
        try:
            # Create new user from form data
            user = User(
                email=request.form['email'],
                first_name=request.form['first_name'],
                last_name=request.form['last_name'],
                phone=request.form.get('phone', ''),
                role=user_type,
                is_instructor=(user_type == 'instructor'),
                is_admin=False,
                status='active'
            )
            
            # Set password
            if 'password' in request.form and request.form['password']:
                user.set_password(request.form['password'])
            else:
                user.set_password('changeme')  # Default password
            
            # Add instructor-specific fields
            if user_type == 'instructor':
                user.certificates = request.form.get('certificates', '')
                if request.form.get('instructor_rate_per_hour'):
                    user.instructor_rate_per_hour = float(request.form['instructor_rate_per_hour'])
            
            # Add the user to the database
            db.session.add(user)
            db.session.commit()
            
            flash(f'{user_type.capitalize()} {user.full_name} created successfully.', 'success')
            return redirect(url_for('admin.dashboard'))
        except Exception as e:
            db.session.rollback()
            error_message = f"Error creating {user_type}: {str(e)}"
    
    return render_template('admin/user_form.html', user=None, user_type=user_type, edit_mode=False, error_message=error_message)


@admin_bp.route('/user/<int:id>/edit', methods=['GET', 'POST'])
@login_required
@admin_required
def edit_user(id):
    """Edit an existing user."""
    user = User.query.get_or_404(id)
    user_type = 'instructor' if user.is_instructor else 'student'
    error_message = None
    
    if request.method == 'POST':
        try:
            # Update user details
            user.email = request.form['email']
            user.first_name = request.form['first_name']
            user.last_name = request.form['last_name']
            user.phone = request.form.get('phone', '')
            user.status = request.form.get('status', 'active')
            
            # Update password if provided
            if 'password' in request.form and request.form['password']:
                user.set_password(request.form['password'])
            
            # Update instructor-specific fields
            if user.is_instructor:
                user.certificates = request.form.get('certificates', '')
                if request.form.get('instructor_rate_per_hour'):
                    user.instructor_rate_per_hour = float(request.form['instructor_rate_per_hour'])
            
            # Save the changes
            db.session.commit()
            
            flash(f'{user_type.capitalize()} {user.full_name} updated successfully.', 'success')
            return redirect(url_for('admin.dashboard'))
        except Exception as e:
            db.session.rollback()
            error_message = f"Error updating {user_type}: {str(e)}"
    
    return render_template('admin/user_form.html', user=user, user_type=user_type, edit_mode=True, error_message=error_message)


@admin_bp.route('/user/<int:id>', methods=['DELETE'])
@login_required
@admin_required
def delete_user(id):
    """Delete a user."""
    user = User.query.get_or_404(id)
    
    try:
        # Check if user has any bookings
        if hasattr(user, 'bookings') and user.bookings.count() > 0:
            return jsonify({'error': 'Cannot delete user with existing bookings'}), 400
        
        # Delete the user
        db.session.delete(user)
        db.session.commit()
        
        return jsonify({'success': True}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/waitlist')
@login_required
@admin_required
def waitlist():
    """Display waitlist management page."""
    waitlist_entries = Booking.query.filter_by(status='waitlist').order_by(Booking.created_at).all()
    return render_template('admin/waitlist.html', entries=waitlist_entries)


@admin_bp.route('/recurring-bookings')
@login_required
@admin_required
def recurring_bookings():
    """Display recurring bookings management page."""
    recurring = Booking.query.filter_by(is_recurring=True).order_by(Booking.start_time).all()
    return render_template('admin/recurring_bookings.html', bookings=recurring)


@admin_bp.route('/flight-logs')
@login_required
@admin_required
def flight_logs():
    """Display flight logs management page."""
    return render_template('admin/flight_logs.html')


@admin_bp.route('/bookings')
@login_required
@admin_required
def bookings():
    """Display booking management page."""
    bookings = Booking.query.order_by(Booking.start_time.desc()).all()
    students = User.query.filter_by(is_instructor=False, is_admin=False).all()
    instructors = User.query.filter_by(is_instructor=True).all()
    aircraft_list = Aircraft.query.all()
    
    return render_template('admin/bookings.html', 
                          bookings=bookings,
                          students=students,
                          instructors=instructors,
                          aircraft_list=aircraft_list)


@admin_bp.route('/booking/create', methods=['GET', 'POST'])
@login_required
@admin_required
def create_booking():
    """Create a new booking as admin."""
    if request.method == 'POST':
        student_id = request.form.get('student_id')
        instructor_id = request.form.get('instructor_id')
        aircraft_id = request.form.get('aircraft_id')
        start_time_str = request.form.get('start_time')
        duration = int(request.form.get('duration', 60))
        notes = request.form.get('notes', '')
        
        try:
            # Parse start time
            start_time = datetime.strptime(start_time_str, '%Y-%m-%dT%H:%M')
            # Calculate end time
            end_time = start_time + timedelta(minutes=duration)
            
            # Check if aircraft is available
            conflicting_bookings = Booking.query.filter(
                Booking.aircraft_id == aircraft_id,
                Booking.status.in_(['confirmed', 'in_progress']),
                Booking.start_time < end_time,
                Booking.end_time > start_time
            ).all()
            
            if conflicting_bookings:
                flash('This aircraft is already booked during the selected time.', 'error')
                return redirect(url_for('admin.bookings'))
            
            # Create booking
            booking = Booking(
                student_id=student_id,
                instructor_id=instructor_id if instructor_id else None,
                aircraft_id=aircraft_id,
                start_time=start_time,
                end_time=end_time,
                status='confirmed',
                notes=notes
            )
            
            db.session.add(booking)
            db.session.commit()
            
            # Add a timestamp parameter to force a refresh of the page
            flash('Booking created successfully.', 'success')
            return redirect(url_for('admin.bookings', _fresh=True, t=datetime.now().timestamp()))
            
        except Exception as e:
            flash(f'Error creating booking: {str(e)}', 'error')
            return redirect(url_for('admin.bookings', _fresh=True, t=datetime.now().timestamp()))
    
    # GET request - render form
    students = User.query.filter_by(is_instructor=False, is_admin=False).all()
    instructors = User.query.filter_by(is_instructor=True).all()
    aircraft_list = Aircraft.query.all()  # Show all aircraft, including unavailable ones
    
    return render_template('admin/booking_form.html',
                          students=students,
                          instructors=instructors,
                          aircraft_list=aircraft_list,
                          booking=None)


@admin_bp.route('/booking/<int:id>/edit', methods=['GET', 'POST'])
@login_required
@admin_required
def edit_booking(id):
    """Edit an existing booking."""
    booking = Booking.query.get_or_404(id)
    
    if request.method == 'POST':
        student_id = request.form.get('student_id')
        instructor_id = request.form.get('instructor_id')
        aircraft_id = request.form.get('aircraft_id')
        start_time_str = request.form.get('start_time')
        duration = int(request.form.get('duration', 60))
        status = request.form.get('status')
        notes = request.form.get('notes', '')
        
        try:
            # Parse start time
            start_time = datetime.strptime(start_time_str, '%Y-%m-%dT%H:%M')
            # Calculate end time
            end_time = start_time + timedelta(minutes=duration)
            
            # Check if aircraft is available (excluding this booking)
            conflicting_bookings = Booking.query.filter(
                Booking.id != id,
                Booking.aircraft_id == aircraft_id,
                Booking.status.in_(['confirmed', 'in_progress']),
                Booking.start_time < end_time,
                Booking.end_time > start_time
            ).all()
            
            if conflicting_bookings:
                flash('This aircraft is already booked during the selected time.', 'error')
                return redirect(url_for('admin.edit_booking', id=id, _fresh=True, t=datetime.now().timestamp()))
            
            # Update booking
            booking.student_id = student_id
            booking.instructor_id = instructor_id if instructor_id else None
            booking.aircraft_id = aircraft_id
            booking.start_time = start_time
            booking.end_time = end_time
            booking.status = status
            booking.notes = notes
            
            db.session.commit()
            
            # Add a timestamp parameter to force a refresh of the page
            flash('Booking updated successfully.', 'success')
            return redirect(url_for('admin.bookings', _fresh=True, t=datetime.now().timestamp()))
            
        except Exception as e:
            flash(f'Error updating booking: {str(e)}', 'error')
            return redirect(url_for('admin.edit_booking', id=id, _fresh=True, t=datetime.now().timestamp()))
    
    # GET request - render form
    students = User.query.filter_by(is_instructor=False, is_admin=False).all()
    instructors = User.query.filter_by(is_instructor=True).all()
    aircraft_list = Aircraft.query.all()  # Show all aircraft, including unavailable ones
    
    # Calculate duration in minutes
    duration = int((booking.end_time - booking.start_time).total_seconds() / 60)
    
    return render_template('admin/booking_form.html',
                          students=students,
                          instructors=instructors,
                          aircraft_list=aircraft_list,
                          booking=booking,
                          duration=duration)


@admin_bp.route('/booking/<int:id>/delete', methods=['POST'])
@login_required
@admin_required
def delete_booking(id):
    """Delete a booking."""
    booking = Booking.query.get_or_404(id)
    
    try:
        db.session.delete(booking)
        db.session.commit()
        flash('Booking deleted successfully.', 'success')
        # Add a timestamp parameter to force a refresh of the page
        return redirect(url_for('admin.bookings', _fresh=True, t=datetime.now().timestamp()))
    except Exception as e:
        flash(f'Error deleting booking: {str(e)}', 'error')
        return redirect(url_for('admin.bookings'))


@admin_bp.route('/maintenance/add', methods=['GET', 'POST'])
@login_required
@admin_required
def maintenance_add():
    """Add a new maintenance record."""
    aircraft_list = Aircraft.query.all()
    maintenance_types = MaintenanceType.query.all()
    
    if request.method == 'POST':
        aircraft_id = request.form.get('aircraft_id')
        maintenance_type_id = request.form.get('maintenance_type_id')
        performed_at_str = request.form.get('performed_at')
        hobbs_hours = request.form.get('hobbs_hours')
        notes = request.form.get('notes', '')
        
        try:
            # Parse performed_at date
            performed_at = datetime.strptime(performed_at_str, '%Y-%m-%d')
            
            # Create maintenance record
            record = MaintenanceRecord(
                aircraft_id=aircraft_id,
                maintenance_type_id=maintenance_type_id,
                performed_at=performed_at,
                performed_by_id=current_user.id,
                hobbs_hours=hobbs_hours,
                notes=notes,
                status='completed'
            )
            
            db.session.add(record)
            db.session.commit()
            
            flash('Maintenance record added successfully.', 'success')
            return redirect(url_for('admin.maintenance_records'))
            
        except Exception as e:
            flash(f'Error adding maintenance record: {str(e)}', 'error')
    
    return render_template('admin/maintenance_form.html', 
                          aircraft_list=aircraft_list,
                          maintenance_types=maintenance_types,
                          record=None)


@admin_bp.route('/maintenance/edit/<int:id>', methods=['GET', 'POST'])
@login_required
@admin_required
def maintenance_edit(id):
    """Edit an existing maintenance record."""
    record = MaintenanceRecord.query.get_or_404(id)
    aircraft_list = Aircraft.query.all()
    maintenance_types = MaintenanceType.query.all()
    
    if request.method == 'POST':
        aircraft_id = request.form.get('aircraft_id')
        maintenance_type_id = request.form.get('maintenance_type_id')
        performed_at_str = request.form.get('performed_at')
        hobbs_hours = request.form.get('hobbs_hours')
        notes = request.form.get('notes', '')
        status = request.form.get('status')
        
        try:
            # Parse performed_at date
            performed_at = datetime.strptime(performed_at_str, '%Y-%m-%d')
            
            # Update maintenance record
            record.aircraft_id = aircraft_id
            record.maintenance_type_id = maintenance_type_id
            record.performed_at = performed_at
            record.hobbs_hours = hobbs_hours
            record.notes = notes
            record.status = status
            
            db.session.commit()
            
            flash('Maintenance record updated successfully.', 'success')
            return redirect(url_for('admin.maintenance_records'))
            
        except Exception as e:
            flash(f'Error updating maintenance record: {str(e)}', 'error')
    
    return render_template('admin/maintenance_form.html', 
                          aircraft_list=aircraft_list,
                          maintenance_types=maintenance_types,
                          record=record)


@admin_bp.route('/maintenance/delete/<int:id>', methods=['POST'])
@login_required
@admin_required
def maintenance_delete(id):
    """Delete a maintenance record."""
    record = MaintenanceRecord.query.get_or_404(id)
    
    try:
        db.session.delete(record)
        db.session.commit()
        flash('Maintenance record deleted successfully.', 'success')
    except Exception as e:
        flash(f'Error deleting maintenance record: {str(e)}', 'error')
    
    return redirect(url_for('admin.maintenance_records'))
