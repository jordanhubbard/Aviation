from flask import Flask, render_template, current_app, session
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_migrate import Migrate
from flask_mail import Mail
from flask_wtf.csrf import CSRFProtect
from config import config
from datetime import datetime
import os

# Initialize extensions
db = SQLAlchemy()
login_manager = LoginManager()
login_manager.login_view = 'auth.login'
login_manager.login_message_category = 'info'
migrate = Migrate()
mail = Mail()
csrf = CSRFProtect()

def create_app(config_name='default'):
    """Application factory."""
    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # Initialize extensions
    db.init_app(app)
    login_manager.init_app(app)
    migrate.init_app(app, db)
    mail.init_app(app)
    csrf.init_app(app)

    @app.context_processor
    def inject_datetime():
        return dict(datetime=datetime)

    @app.template_filter('datetime')
    def format_datetime(value, format='%Y-%m-%d %H:%M'):
        """Format a datetime object."""
        if value is None:
            return ''
        return value.strftime(format)

    @app.before_request
    def before_request():
        if '_id' not in session:
            session['_id'] = os.urandom(16).hex()
            session.modified = True

    @app.after_request
    def after_request(response):
        # Ensure session is saved
        session.modified = True
        return response

    # Register blueprints
    from app.routes import main as main_blueprint
    from app.routes import auth as auth_blueprint
    from app.routes import booking as booking_blueprint
    from app.routes import instructor as instructor_blueprint
    from app.routes import admin as admin_blueprint
    from app.routes import settings as settings_blueprint
    from app.routes import flight as flight_blueprint

    app.register_blueprint(main_blueprint.main_bp)
    app.register_blueprint(auth_blueprint.auth_bp, url_prefix='/auth')
    app.register_blueprint(booking_blueprint.booking_bp)
    app.register_blueprint(instructor_blueprint.instructor_bp)
    app.register_blueprint(admin_blueprint.admin_bp, url_prefix='/admin')
    app.register_blueprint(settings_blueprint.settings_bp, url_prefix='/settings')
    app.register_blueprint(flight_blueprint.flight_bp)

    @app.errorhandler(404)
    def not_found_error(error):
        return render_template('errors/404.html'), 404

    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        return render_template('errors/500.html'), 500

    return app

# Import models after db is defined to avoid circular imports
from app.models import User

@login_manager.user_loader
def load_user(id):
    """Load user from database."""
    current_app.logger.debug(f"Loading user with ID: {id}")
    user = db.session.get(User, int(id))
    if user:
        msg = (
            f"Loaded user: {user}, "
            f"Role: {user.role}, "
            f"Is Admin: {user.is_admin}"
        )
        current_app.logger.debug(msg)
    else:
        current_app.logger.debug("User not found")
    return user
