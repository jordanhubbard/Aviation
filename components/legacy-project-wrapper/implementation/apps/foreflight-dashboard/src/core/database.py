"""
SQLAlchemy database models and configuration for ForeFlight Dashboard.
"""

from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.sql import func
import os

# Database configuration
DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///./data/app.db')

# Create engine
engine = create_engine(
    DATABASE_URL, 
    echo=False,
    # SQLite-specific settings
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create declarative base
Base = declarative_base()


class User(Base):
    """User model for authentication and profile management."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    pilot_certificate_number = Column(String(50), nullable=True)
    student_pilot = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    preferences = Column(Text, default='{}')  # JSON string for user preferences

    # Relationships
    logbooks = relationship("UserLogbook", back_populates="user", cascade="all, delete-orphan")
    endorsements = relationship("InstructorEndorsement", back_populates="user", cascade="all, delete-orphan")
    password_reset_tokens = relationship("PasswordResetToken", back_populates="user", cascade="all, delete-orphan")

    @property
    def full_name(self) -> str:
        """Get user's full name."""
        return f"{self.first_name} {self.last_name}"
    
    @property
    def display_name(self) -> str:
        """Get user's display name (first name + last initial)."""
        return f"{self.first_name} {self.last_name[0]}." if self.last_name else self.first_name

    def to_dict(self):
        """Convert user to dictionary for JSON serialization."""
        return {
            'id': self.id,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'pilot_certificate_number': self.pilot_certificate_number,
            'student_pilot': self.student_pilot,
            'is_active': self.is_active,
            'is_verified': self.is_verified,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'full_name': self.full_name,
            'display_name': self.display_name
        }


class UserLogbook(Base):
    """User logbook files tracking."""
    __tablename__ = "user_logbooks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    file_size = Column(Integer, nullable=False)
    is_active = Column(Boolean, default=True)

    # Relationships
    user = relationship("User", back_populates="logbooks")


class InstructorEndorsement(Base):
    """Instructor endorsements for student pilots."""
    __tablename__ = "instructor_endorsements"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    start_date = Column(DateTime(timezone=True), nullable=False)
    expiration_date = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="endorsements")

    def is_valid_for_date(self, check_date: datetime) -> bool:
        """Check if endorsement is valid for a given date."""
        return self.start_date.date() <= check_date.date() <= self.expiration_date.date()

    def is_currently_valid(self) -> bool:
        """Check if endorsement is currently valid."""
        return self.is_valid_for_date(datetime.now(timezone.utc))


class PasswordResetToken(Base):
    """Password reset tokens."""
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token = Column(String(255), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="password_reset_tokens")

    def is_valid(self) -> bool:
        """Check if the token is valid and not expired."""
        return not self.used and datetime.now(timezone.utc) < self.expires_at


# Database dependency for FastAPI
def get_db():
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Initialize database tables
def init_database():
    """Initialize database tables."""
    # Ensure data directory exists
    os.makedirs('data', exist_ok=True)
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
