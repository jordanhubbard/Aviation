from flask import Blueprint, render_template
from flask_login import login_required
from app.models import MaintenanceType, MaintenanceRecord, Squawk, Aircraft

maintenance_bp = Blueprint('maintenance', __name__)


@maintenance_bp.route('/maintenance/types')
@login_required
def maintenance_types():
    """List all maintenance types."""
    types = MaintenanceType.query.all()
    return render_template('maintenance/types.html', types=types)


@maintenance_bp.route('/aircraft/<int:aircraft_id>/maintenance')
@login_required
def aircraft_maintenance(aircraft_id):
    """Display maintenance records for a specific aircraft."""
    aircraft = Aircraft.query.get_or_404(aircraft_id)
    records = MaintenanceRecord.query.filter_by(
        aircraft_id=aircraft_id).order_by(
        MaintenanceRecord.performed_at.desc()).all()
    return render_template('maintenance/aircraft_maintenance.html',
                         aircraft=aircraft,
                         records=records)


@maintenance_bp.route('/squawks')
@login_required
def squawks():
    """List all squawks."""
    squawks = Squawk.query.order_by(Squawk.created_at.desc()).all()
    return render_template('maintenance/squawks.html', squawks=squawks)
