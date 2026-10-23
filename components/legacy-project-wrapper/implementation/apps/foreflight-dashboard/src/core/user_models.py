"""User models for authentication and user management."""

from datetime import datetime, timezone
from typing import Optional, Dict, Any
from dataclasses import dataclass
from pydantic import BaseModel, EmailStr, Field, validator
# Removed Flask-Login dependency - using pure FastAPI authentication
import secrets
import hashlib


class UserPreferences(BaseModel):
    """User preferences and settings."""
    student_pilot: bool = False
    default_aircraft_type: Optional[str] = None
    timezone: str = "UTC"
    date_format: str = "%Y-%m-%d"
    time_format: str = "%H:%M"
    theme: str = "light"  # light, dark
    notifications_enabled: bool = True
    auto_save_logbooks: bool = True
    currency_reminders: bool = True
    
    class Config:
        title = "UserPreferences"
        description = "User preferences and settings"


class UserRegistration(BaseModel):
    """User registration data."""
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    pilot_certificate_number: Optional[str] = Field(None, max_length=20)
    student_pilot: bool = False
    agree_to_terms: bool = Field(..., description="Must agree to terms and conditions")
    
    @validator('confirm_password')
    def passwords_match(cls, v, values, **kwargs):
        if 'password' in values and v != values['password']:
            raise ValueError('Passwords do not match')
        return v
    
    @validator('agree_to_terms')
    def must_agree_to_terms(cls, v):
        if not v:
            raise ValueError('You must agree to the terms and conditions')
        return v
    
    class Config:
        title = "UserRegistration"
        description = "User registration data"


class UserLogin(BaseModel):
    """User login data."""
    email: EmailStr
    password: str
    remember_me: bool = False
    
    class Config:
        title = "UserLogin"
        description = "User login data"


class PasswordResetRequest(BaseModel):
    """Password reset request data."""
    email: EmailStr
    
    class Config:
        title = "PasswordResetRequest"
        description = "Password reset request data"


class PasswordReset(BaseModel):
    """Password reset data."""
    token: str
    new_password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str
    
    @validator('confirm_password')
    def passwords_match(cls, v, values, **kwargs):
        if 'new_password' in values and v != values['new_password']:
            raise ValueError('Passwords do not match')
        return v
    
    class Config:
        title = "PasswordReset"
        description = "Password reset data"


@dataclass
class User:
    """User model for FastAPI authentication."""
    id: int
    email: str
    first_name: str
    last_name: str
    password_hash: str
    is_active: bool = True
    is_verified: bool = False
    student_pilot: bool = False
    pilot_certificate_number: Optional[str] = None
    created_at: datetime = None
    last_login: Optional[datetime] = None
    preferences: UserPreferences = None
    
    def get_id(self):
        """Get user ID as string."""
        return str(self.id)
    
    @property
    def full_name(self) -> str:
        """Get user's full name."""
        return f"{self.first_name} {self.last_name}"
    
    @property
    def display_name(self) -> str:
        """Get user's display name (first name + last initial)."""
        return f"{self.first_name} {self.last_name[0]}." if self.last_name else self.first_name
    
    def to_dict(self) -> Dict[str, Any]:
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
            'preferences': self.preferences.dict() if self.preferences else {},
            'full_name': self.full_name,
            'display_name': self.display_name
        }


@dataclass
class PasswordResetToken:
    """Password reset token model."""
    id: int
    user_id: int
    token: str
    expires_at: datetime
    used: bool
    created_at: datetime
    
    def is_valid(self) -> bool:
        """Check if the token is valid and not expired."""
        return not self.used and datetime.now(timezone.utc) < self.expires_at
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert token to dictionary for JSON serialization."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'token': self.token,
            'expires_at': self.expires_at.isoformat(),
            'used': self.used,
            'created_at': self.created_at.isoformat(),
            'is_valid': self.is_valid()
        }


def generate_password_reset_token() -> str:
    """Generate a secure password reset token."""
    return secrets.token_urlsafe(32)


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    import bcrypt
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its hash."""
    import bcrypt
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))


def generate_user_directory_name(user_id: int, email: str) -> str:
    """Generate a unique directory name for user files."""
    # Use user ID and a hash of email for uniqueness
    email_hash = hashlib.md5(email.encode()).hexdigest()[:8]
    return f"user_{user_id}_{email_hash}"
