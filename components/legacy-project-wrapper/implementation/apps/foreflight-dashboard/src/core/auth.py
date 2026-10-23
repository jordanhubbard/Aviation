"""
FastAPI Authentication System
Replaces Flask-Security-Too with a modern FastAPI-based authentication system.
"""

import os
import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from src.core.database import User

# Configuration
SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# HTTP Bearer token scheme
security = HTTPBearer(auto_error=False)

class AuthenticationError(HTTPException):
    """Custom authentication error."""
    def __init__(self, detail: str = "Could not validate credentials"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    # First try direct bcrypt verification
    if pwd_context.verify(plain_password, hashed_password):
        return True
    
    # If that fails, try Flask-Security-Too's HMAC + bcrypt method
    # We need to manually implement the HMAC since we're outside Flask context
    try:
        import hashlib
        import hmac
        # Use the same salt as in the Flask app config (from init_db.py)
        salt = 'dev-secret-key'
        hmac_password = hmac.new(salt.encode('utf-8'), plain_password.encode('utf-8'), hashlib.sha512).hexdigest()
        return pwd_context.verify(hmac_password, hashed_password)
    except Exception:
        # If HMAC verification fails, fall back to direct verification
        return False

def get_password_hash(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify and decode a JWT token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None

def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    """Authenticate a user with email and password."""
    user = db.query(User).filter(User.email == email).first()
    
    # Always verify password to prevent timing attacks, even for non-existent users
    if user:
        password_valid = verify_password(password, user.password_hash)
        if password_valid and user.is_active:
            return user
    else:
        # Perform dummy password verification to maintain consistent timing
        verify_password(password, "$2b$12$dummy.hash.to.prevent.timing.attacks.abcdefghijklmnopqrstuvwx")
    
    return None

def get_current_user_from_token(
    credentials: Optional[HTTPAuthorizationCredentials],
    db: Session
) -> Optional[User]:
    """Get current user from JWT token."""
    if not credentials:
        return None
    
    token = credentials.credentials
    payload = verify_token(token)
    
    if not payload:
        return None
    
    user_id = payload.get("sub")
    if not user_id:
        return None
    
    try:
        user_id = int(user_id)
    except (ValueError, TypeError):
        return None
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        return None
    
    return user

def create_user(
    db: Session,
    email: str,
    password: str,
    first_name: str,
    last_name: str,
    student_pilot: bool = False,
    pilot_certificate_number: Optional[str] = None
) -> User:
    """Create a new user."""
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Hash password
    hashed_password = get_password_hash(password)
    
    # Create user
    user = User(
        email=email,
        password_hash=hashed_password,
        first_name=first_name,
        last_name=last_name,
        student_pilot=student_pilot,
        pilot_certificate_number=pilot_certificate_number,
        is_active=True
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return user

def require_auth(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = None
) -> User:
    """Dependency to require authentication."""
    if not credentials:
        raise AuthenticationError("Authentication required")
    
    user = get_current_user_from_token(credentials, db)
    if not user:
        raise AuthenticationError("Invalid authentication credentials")
    
    return user

def optional_auth(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = None
) -> Optional[User]:
    """Dependency for optional authentication."""
    if not credentials:
        return None
    
    return get_current_user_from_token(credentials, db)

class SessionManager:
    """Simple session management for FastAPI."""
    
    def __init__(self):
        self._sessions: Dict[str, Dict[str, Any]] = {}
    
    def create_session(self, user_id: int) -> str:
        """Create a new session."""
        session_id = f"session_{user_id}_{datetime.now().timestamp()}"
        self._sessions[session_id] = {
            "user_id": user_id,
            "created_at": datetime.now(timezone.utc),
            "last_accessed": datetime.now(timezone.utc)
        }
        return session_id
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session data."""
        session = self._sessions.get(session_id)
        if session:
            session["last_accessed"] = datetime.now(timezone.utc)
        return session
    
    def delete_session(self, session_id: str) -> bool:
        """Delete a session."""
        return self._sessions.pop(session_id, None) is not None
    
    def cleanup_expired_sessions(self, max_age_hours: int = 24):
        """Clean up expired sessions."""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
        expired_sessions = [
            session_id for session_id, session_data in self._sessions.items()
            if session_data["last_accessed"] < cutoff
        ]
        
        for session_id in expired_sessions:
            del self._sessions[session_id]

# Global session manager instance
session_manager = SessionManager()

def get_user_from_session(request: Request, db: Session) -> Optional[User]:
    """Get user from session cookie (fallback for web interface)."""
    session_id = request.cookies.get("session_id")
    if not session_id:
        return None
    
    session_data = session_manager.get_session(session_id)
    if not session_data:
        return None
    
    user = db.query(User).filter(User.id == session_data["user_id"]).first()
    if not user or not user.active:
        return None
    
    return user

def create_default_admin_user(db: Session) -> User:
    """Create a default admin user if none exists."""
    admin_user = db.query(User).filter(User.email == "admin@foreflight-dashboard.com").first()
    
    if not admin_user:
        admin_user = create_user(
            db=db,
            email="admin@foreflight-dashboard.com",
            password="admin123",
            first_name="Admin",
            last_name="User",
            student_pilot=False
        )
        print(f"Created admin user: {admin_user.email}")
    else:
        print(f"Admin user already exists: {admin_user.email}")
    
    return admin_user
