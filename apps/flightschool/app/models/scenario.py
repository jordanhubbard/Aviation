"""Training Scenario models for pre-recorded flight training scenarios."""
from datetime import datetime, timezone
from app import db


class TrainingScenario(db.Model):
    """Pre-recorded training scenario for flight training."""
    __tablename__ = 'training_scenarios'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    # pattern_work, gps_approach, cross_country, emergency
    scenario_type = db.Column(db.String(50), nullable=False)
    # beginner, intermediate, advanced
    skill_level = db.Column(db.String(20), default='beginner')
    # Duration in minutes
    duration_minutes = db.Column(db.Integer, default=30)
    # YAML content for scenario data
    scenario_data = db.Column(db.Text, nullable=False)
    # active, draft, archived
    status = db.Column(db.String(20), default='draft')
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )
    
    # Relationships
    created_by = db.relationship('User', backref='created_scenarios')
    completions = db.relationship('ScenarioCompletion', backref='scenario', lazy='dynamic')
    
    # Scenario type constants
    TYPE_PATTERN_WORK = 'pattern_work'
    TYPE_GPS_APPROACH = 'gps_approach'
    TYPE_CROSS_COUNTRY = 'cross_country'
    TYPE_EMERGENCY = 'emergency'
    
    SCENARIO_TYPES = [
        (TYPE_PATTERN_WORK, 'Pattern Work'),
        (TYPE_GPS_APPROACH, 'GPS Approach'),
        (TYPE_CROSS_COUNTRY, 'Cross-Country'),
        (TYPE_EMERGENCY, 'Emergency'),
    ]
    
    SKILL_LEVELS = [
        ('beginner', 'Beginner'),
        ('intermediate', 'Intermediate'),
        ('advanced', 'Advanced'),
    ]
    
    def __repr__(self):
        return f'<TrainingScenario {self.name}>'
    
    @property
    def is_active(self):
        return self.status == 'active'
    
    @property
    def type_display(self):
        """Return human-readable scenario type."""
        type_map = dict(self.SCENARIO_TYPES)
        return type_map.get(self.scenario_type, self.scenario_type)
    
    @property
    def level_display(self):
        """Return human-readable skill level."""
        level_map = dict(self.SKILL_LEVELS)
        return level_map.get(self.skill_level, self.skill_level)


class ScenarioCompletion(db.Model):
    """Record of a student completing a training scenario."""
    __tablename__ = 'scenario_completions'
    
    id = db.Column(db.Integer, primary_key=True)
    scenario_id = db.Column(db.Integer, db.ForeignKey('training_scenarios.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    instructor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    # Time taken in seconds
    completion_time = db.Column(db.Integer)
    # Score out of 100
    score = db.Column(db.Float)
    # passed, failed, incomplete
    status = db.Column(db.String(20), default='incomplete')
    # JSON data for detailed scoring metrics
    scoring_data = db.Column(db.JSON)
    notes = db.Column(db.Text)
    completed_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    student = db.relationship('User', foreign_keys=[student_id], backref='scenario_completions')
    instructor = db.relationship('User', foreign_keys=[instructor_id], backref='graded_completions')
    
    def __repr__(self):
        return f'<ScenarioCompletion {self.id} - {self.status}>'
    
    @property
    def passed(self):
        return self.status == 'passed'
    
    @property
    def duration_display(self):
        """Return human-readable duration."""
        if not self.completion_time:
            return 'N/A'
        minutes = self.completion_time // 60
        seconds = self.completion_time % 60
        return f'{minutes}m {seconds}s'
