from flask import Blueprint, render_template, flash, redirect, url_for
from flask_login import login_required, current_user
from app.models import Booking, User
from datetime import datetime, timedelta
from functools import wraps

instructor_bp = Blueprint('instructor', __name__)


def instructor_required(f):
    """Decorator to require instructor access."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_instructor:
            flash('Access denied. Instructor privileges required.', 'error')
            return redirect(url_for('main.index'))
        return f(*args, **kwargs)
    return decorated_function


@instructor_bp.route('/instructor/dashboard')
@login_required
@instructor_required
def dashboard():
    """Display the instructor dashboard."""
    # Get upcoming lessons
    upcoming_lessons = Booking.query.filter(
        Booking.instructor_id == current_user.id,
        Booking.start_time > datetime.now()
    ).order_by(Booking.start_time).all()

    # Get pending student requests
    pending_requests = Booking.query.filter(
        Booking.instructor_id == current_user.id,
        Booking.status == 'pending'
    ).order_by(Booking.created_at).all()

    return render_template('instructor/dashboard.html',
                         upcoming_lessons=upcoming_lessons,
                         pending_requests=pending_requests)


@instructor_bp.route('/instructor/schedule')
@login_required
@instructor_required
def schedule():
    """Display instructor schedule."""
    # Get all bookings for the next 30 days
    start_date = datetime.now()
    end_date = start_date + timedelta(days=30)
    
    schedule = Booking.query.filter(
        Booking.instructor_id == current_user.id,
        Booking.start_time >= start_date,
        Booking.start_time <= end_date
    ).order_by(Booking.start_time).all()

    return render_template('instructor/schedule.html', schedule=schedule)


@instructor_bp.route('/instructor/students')
@login_required
@instructor_required
def students():
    """Display instructor's students."""
    # Get all students assigned to this instructor
    students = User.query.filter_by(
        instructor_id=current_user.id,
        status='active'
    ).order_by(User.last_name).all()

    return render_template('instructor/students.html', students=students) 