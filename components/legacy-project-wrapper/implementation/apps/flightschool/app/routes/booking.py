from flask import Blueprint, render_template, flash, redirect, url_for, request, jsonify
from flask_login import login_required, current_user
from app.models import Booking, Aircraft, User, RecurringBooking, WaitlistEntry, WeatherMinima
from datetime import datetime, timedelta
from app import db
from functools import wraps
from flask import current_app
from app.forms import BookingForm
from app.utils.datetime_utils import utcnow, to_utc, from_utc, format_datetime

booking_bp = Blueprint('booking', __name__)


def instructor_or_admin_required(f):
    """Decorator to require instructor or admin access."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_instructor and not current_user.is_admin:
            flash('Permission denied. Instructor or admin privileges required.', 'error')
            return redirect(url_for('booking.list_bookings'))
        return f(*args, **kwargs)
    return decorated_function


def booking_access_required(f):
    """Decorator to check if user has access to the booking."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        booking = Booking.query.get_or_404(kwargs.get('booking_id'))
        if (booking.student_id != current_user.id and 
            booking.instructor_id != current_user.id and 
            not current_user.is_admin):
            flash('Permission denied.', 'error')
            return redirect(url_for('booking.list_bookings'))
        return f(*args, **kwargs)
    return decorated_function


@booking_bp.route('/list')
@login_required
def list_bookings():
    """List all bookings."""
    if current_user.is_admin:
        bookings = Booking.query.order_by(Booking.start_time.desc()).all()
    else:
        bookings = Booking.query.filter_by(student_id=current_user.id).order_by(Booking.start_time.desc()).all()
    
    return render_template('booking/list.html', bookings=bookings)


@booking_bp.route('/dashboard')
@login_required
def dashboard():
    """Display the booking dashboard."""
    # Get current date and time
    now = utcnow()
    
    # Calculate the end date (14 days from now)
    end_date = now + timedelta(days=14)
    
    # Get upcoming bookings for the next 14 days only
    upcoming_bookings = Booking.query.filter(
        Booking.student_id == current_user.id,
        Booking.status.in_(['confirmed', 'pending']),  # Only show confirmed and pending bookings
    ).order_by(Booking.start_time).all()
    
    # Filter bookings in Python to handle timezone issues
    # Make sure both datetimes have timezone info before comparing
    upcoming_bookings = [b for b in upcoming_bookings if to_utc(b.end_time) > now]
    
    available_aircraft = Aircraft.query.filter_by(status='available').all()
    
    return render_template('booking/dashboard.html',
                         upcoming_bookings=upcoming_bookings,
                         available_aircraft=available_aircraft,
                         date_range=f"{format_datetime(now, '%b %d')} - {format_datetime(end_date, '%b %d, %Y')}")


@booking_bp.route('/weather-minima')
@login_required
def weather_minima():
    """Display weather minima requirements."""
    return render_template('booking/weather_minima.html', minima=WeatherMinima.query.order_by(WeatherMinima.category).all())


@booking_bp.route('/recurring')
@login_required
def recurring_bookings():
    """Display and manage recurring bookings."""
    recurring = RecurringBooking.query.filter_by(student_id=current_user.id).order_by(RecurringBooking.start_date).all()
    return render_template('booking/recurring_bookings.html', bookings=recurring,
                           aircraft_list=Aircraft.query.filter_by(status='available').order_by(Aircraft.registration).all(),
                           instructors=User.query.filter_by(is_instructor=True, status='active').all())


@booking_bp.route('/recurring/create', methods=['POST'])
@login_required
def create_recurring_booking():
    try:
        aircraft_id = int(request.form['aircraft_id'])
        instructor_id = int(request.form['instructor_id']) if request.form.get('instructor_id') else None
        weekday = int(request.form['day_of_week'])
        start_time = datetime.strptime(request.form['start_time'], '%H:%M').time()
        duration = float(request.form['duration_hours'])
        start_date = datetime.fromisoformat(request.form['start_date'])
        end_date = datetime.fromisoformat(request.form['end_date']) if request.form.get('end_date') else None
    except (KeyError, TypeError, ValueError):
        flash('Enter a valid recurring booking schedule.', 'error')
        return redirect(url_for('booking.recurring_bookings'))
    if (not Aircraft.query.filter_by(id=aircraft_id, status='available').first()
            or (instructor_id and not User.query.filter_by(id=instructor_id, is_instructor=True, status='active').first())
            or not 0 <= weekday <= 6 or not 0.5 <= duration <= 8
            or start_date.date() < datetime.now().date()
            or (end_date and end_date < start_date)):
        flash('The recurring booking schedule is invalid.', 'error')
        return redirect(url_for('booking.recurring_bookings'))
    db.session.add(RecurringBooking(student_id=current_user.id, instructor_id=instructor_id,
                                    aircraft_id=aircraft_id, day_of_week=weekday, start_time=start_time,
                                    duration_hours=duration, start_date=start_date, end_date=end_date))
    db.session.commit()
    flash('Recurring booking request created.', 'success')
    return redirect(url_for('booking.recurring_bookings'))


@booking_bp.route('/waitlist')
@login_required
def waitlist():
    """Display and manage waitlist entries."""
    waitlist_entries = WaitlistEntry.query.filter_by(student_id=current_user.id).order_by(WaitlistEntry.created_at).all()
    return render_template('booking/waitlist.html', entries=waitlist_entries,
                           aircraft_list=Aircraft.query.filter_by(status='available').order_by(Aircraft.registration).all(),
                           instructors=User.query.filter_by(is_instructor=True, status='active').all())


@booking_bp.route('/waitlist/join', methods=['POST'])
@login_required
def join_waitlist():
    """Record a pilot's availability request against a real aircraft."""
    try:
        aircraft_id = int(request.form['aircraft_id'])
        instructor_id = int(request.form['instructor_id']) if request.form.get('instructor_id') else None
        requested_date = datetime.fromisoformat(request.form['requested_date'])
        duration = float(request.form['duration_hours'])
        preference = request.form['time_preference']
    except (KeyError, TypeError, ValueError):
        flash('Enter a valid aircraft, date, time preference, and duration.', 'error')
        return redirect(url_for('booking.waitlist'))
    if (not Aircraft.query.filter_by(id=aircraft_id, status='available').first()
            or (instructor_id and not User.query.filter_by(id=instructor_id, is_instructor=True, status='active').first())
            or preference not in {'morning', 'afternoon', 'evening'}
            or not 0.5 <= duration <= 8 or requested_date.date() < datetime.now().date()):
        flash('The requested waitlist slot is invalid.', 'error')
        return redirect(url_for('booking.waitlist'))
    db.session.add(WaitlistEntry(student_id=current_user.id, instructor_id=instructor_id,
                                 aircraft_id=aircraft_id, requested_date=requested_date,
                                 duration_hours=duration, time_preference=preference))
    db.session.commit()
    flash('Added to the waitlist.', 'success')
    return redirect(url_for('booking.waitlist'))


@booking_bp.route('/create', methods=['GET', 'POST'])
@login_required
def create_booking():
    """Create a new booking."""
    form = BookingForm()
    
    # Populate aircraft choices
    form.aircraft_id.choices = [
        (a.id, f"{a.registration} - {a.make} {a.model}")
        for a in Aircraft.query.filter_by(status='available').all()
    ]
    
    # Populate instructor choices
    form.instructor_id.choices = [
        (0, 'No Instructor (Solo Flight)')
    ] + [
        (i.id, f"{i.first_name} {i.last_name}")
        for i in User.query.filter_by(role='instructor', status='active').all()
    ]

    if form.validate_on_submit():
        try:
            end_time = to_utc(form.start_time.data) + timedelta(minutes=form.duration.data)
            
            booking = Booking(
                student_id=current_user.id,
                aircraft_id=form.aircraft_id.data,
                instructor_id=form.instructor_id.data if form.instructor_id.data != 0 else None,
                start_time=to_utc(form.start_time.data),
                end_time=end_time,
                status='pending',
                notes=form.notes.data
            )
            db.session.add(booking)
            db.session.commit()
            flash('Booking created successfully.', 'success')
            return redirect(url_for('booking.dashboard'))
        except Exception as e:
            db.session.rollback()
            flash('Error creating booking.', 'error')
            current_app.logger.error(f'Booking creation error: {str(e)}')
    
    # Get existing bookings for the calendar UI
    now = utcnow()
    start_of_week = now - timedelta(days=now.weekday())
    end_of_week = start_of_week + timedelta(days=14)  # Show 2 weeks
    
    # Get aircraft bookings
    aircraft_bookings = Booking.query.filter(
        Booking.start_time >= start_of_week,
        Booking.start_time <= end_of_week,
        Booking.status != 'cancelled'
    ).all()
    
    # Get instructor bookings
    instructor_bookings = Booking.query.filter(
        Booking.instructor_id.isnot(None),
        Booking.start_time >= start_of_week,
        Booking.start_time <= end_of_week,
        Booking.status != 'cancelled'
    ).all()
    
    # Format booking blocks for the calendar
    booking_blocks = []
    
    # Add aircraft bookings
    for booking in aircraft_bookings:
        booking_blocks.append({
            'type': 'aircraft',
            'id': booking.aircraft_id,
            'start': format_datetime(booking.start_time),
            'end': format_datetime(booking.end_time),
            'title': f"{booking.aircraft.registration} - Booked"
        })
    
    # Add instructor bookings
    for booking in instructor_bookings:
        booking_blocks.append({
            'type': 'instructor',
            'id': booking.instructor_id,
            'start': format_datetime(booking.start_time),
            'end': format_datetime(booking.end_time),
            'title': f"{booking.instructor.full_name} - Booked"
        })
    
    import json
    return render_template(
        'booking/book.html', 
        form=form, 
        current_time=format_datetime(now),
        booking_blocks=json.dumps(booking_blocks)
    )


@booking_bp.route('/<int:booking_id>/cancel', methods=['POST'])
@login_required
@booking_access_required
def cancel_booking(booking_id):
    """Cancel a booking."""
    booking = Booking.query.get_or_404(booking_id)
    booking.status = 'cancelled'
    db.session.commit()
    flash('Booking cancelled successfully.', 'success')
    return redirect(url_for('booking.dashboard'))


@booking_bp.route('/<int:booking_id>')
@login_required
@booking_access_required
def view_booking(booking_id):
    """View a specific booking."""
    booking = Booking.query.get_or_404(booking_id)
    return render_template('booking/view.html', booking=booking)
