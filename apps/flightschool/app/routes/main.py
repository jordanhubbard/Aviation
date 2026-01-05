from flask import Blueprint, render_template, flash, redirect, url_for
from flask_login import login_required, current_user
from app.models import User, Aircraft
from app.forms import ContactForm

main_bp = Blueprint('main', __name__)


@main_bp.route('/')
def index():
    """Display the home page."""
    return render_template('main/index.html')


@main_bp.route('/profile')
@login_required
def profile():
    """Display user profile."""
    return render_template('main/profile.html', user=current_user)


@main_bp.route('/about')
def about():
    """Display about page."""
    return render_template('main/about.html')


@main_bp.route('/contact', methods=['GET', 'POST'])
def contact():
    """Handle contact form submission."""
    form = ContactForm()
    if form.validate_on_submit():
        # Here you would typically send an email or save to database
        flash('Thank you for your message! We will get back to you soon.', 'success')
        return redirect(url_for('main.contact'))
    return render_template('main/contact.html', form=form)


@main_bp.route('/aircraft')
def aircraft():
    """Display aircraft fleet."""
    aircraft_list = Aircraft.query.filter_by(status='available').all()
    return render_template('main/aircraft.html', aircraft=aircraft_list)


@main_bp.route('/instructors')
def instructors():
    """Display instructor list."""
    instructors = User.query.filter_by(is_instructor=True, status='active').all()
    return render_template('main/instructors.html', instructors=instructors)


@main_bp.route('/faq')
def faq():
    """Display FAQ page."""
    return render_template('main/faq.html')


@main_bp.route('/debug')
@login_required
def debug():
    """Debug information page."""
    if not current_user.is_admin:
        flash('Access denied. Admin privileges required.', 'error')
        return redirect(url_for('main.index'))
    return render_template('main/debug.html')


@main_bp.route('/training')
def training():
    """Display training programs."""
    return render_template('main/training.html')


@main_bp.route('/programs')
def programs():
    """Display detailed training programs information."""
    return render_template('main/programs.html')
