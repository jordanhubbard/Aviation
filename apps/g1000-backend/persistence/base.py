"""Base storage adapter interface for G1000 backend.

Defines the abstract interface that all storage implementations must follow.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, List, Optional
from datetime import datetime


@dataclass
class StorageConfig:
    """Configuration for storage adapter."""
    storage_type: str  # 'sqlite' or 'postgresql'
    connection_string: str
    pool_size: int = 5
    timeout: int = 30
    echo_sql: bool = False


class StorageAdapter(ABC):
    """Abstract base class for storage adapters.
    
    All storage implementations (SQLite, PostgreSQL, etc.) must inherit
    from this class and implement all abstract methods.
    """

    def __init__(self, config: StorageConfig):
        """Initialize storage adapter.
        
        Args:
            config: Storage configuration
        """
        self.config = config

    @abstractmethod
    async def initialize(self) -> None:
        """Initialize storage backend and create schema if needed."""
        pass

    @abstractmethod
    async def close(self) -> None:
        """Close storage connections."""
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """Check if storage backend is healthy.
        
        Returns:
            True if healthy, False otherwise
        """
        pass

    # Flight Plan Operations
    @abstractmethod
    async def create_flight_plan(self, plan_data: Dict[str, Any]) -> str:
        """Create a new flight plan.
        
        Args:
            plan_data: Flight plan data
            
        Returns:
            Flight plan ID
        """
        pass

    @abstractmethod
    async def get_flight_plan(self, plan_id: str) -> Optional[Dict[str, Any]]:
        """Get a flight plan by ID.
        
        Args:
            plan_id: Flight plan ID
            
        Returns:
            Flight plan data or None if not found
        """
        pass

    @abstractmethod
    async def update_flight_plan(self, plan_id: str, plan_data: Dict[str, Any]) -> bool:
        """Update an existing flight plan.
        
        Args:
            plan_id: Flight plan ID
            plan_data: Updated flight plan data
            
        Returns:
            True if successful, False if not found
        """
        pass

    @abstractmethod
    async def delete_flight_plan(self, plan_id: str) -> bool:
        """Delete a flight plan.
        
        Args:
            plan_id: Flight plan ID
            
        Returns:
            True if successful, False if not found
        """
        pass

    @abstractmethod
    async def list_flight_plans(self, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """List all flight plans.
        
        Args:
            limit: Maximum number of results
            offset: Number of results to skip
            
        Returns:
            List of flight plans
        """
        pass

    # Settings Operations
    @abstractmethod
    async def save_settings(self, settings_key: str, settings_data: Dict[str, Any]) -> None:
        """Save application settings.
        
        Args:
            settings_key: Settings identifier
            settings_data: Settings data
        """
        pass

    @abstractmethod
    async def get_settings(self, settings_key: str) -> Optional[Dict[str, Any]]:
        """Get application settings.
        
        Args:
            settings_key: Settings identifier
            
        Returns:
            Settings data or None if not found
        """
        pass

    # Flight Recording Operations
    @abstractmethod
    async def create_flight_recording(self, recording_data: Dict[str, Any]) -> str:
        """Create a new flight recording.
        
        Args:
            recording_data: Recording metadata and initial data
            
        Returns:
            Recording ID
        """
        pass

    @abstractmethod
    async def get_flight_recording(self, recording_id: str) -> Optional[Dict[str, Any]]:
        """Get a flight recording by ID.
        
        Args:
            recording_id: Recording ID
            
        Returns:
            Recording data or None if not found
        """
        pass

    @abstractmethod
    async def append_recording_frame(self, recording_id: str, frame_data: Dict[str, Any]) -> bool:
        """Append a frame to a flight recording.
        
        Args:
            recording_id: Recording ID
            frame_data: Frame data to append
            
        Returns:
            True if successful
        """
        pass

    @abstractmethod
    async def list_flight_recordings(self, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """List all flight recordings.
        
        Args:
            limit: Maximum number of results
            offset: Number of results to skip
            
        Returns:
            List of recordings
        """
        pass

    @abstractmethod
    async def delete_flight_recording(self, recording_id: str) -> bool:
        """Delete a flight recording.
        
        Args:
            recording_id: Recording ID
            
        Returns:
            True if successful, False if not found
        """
        pass

    # Demo Scenario Operations
    @abstractmethod
    async def create_demo_scenario(self, scenario_data: Dict[str, Any]) -> str:
        """Create a new demo scenario.
        
        Args:
            scenario_data: Scenario data
            
        Returns:
            Scenario ID
        """
        pass

    @abstractmethod
    async def get_demo_scenario(self, scenario_id: str) -> Optional[Dict[str, Any]]:
        """Get a demo scenario by ID.
        
        Args:
            scenario_id: Scenario ID
            
        Returns:
            Scenario data or None if not found
        """
        pass

    @abstractmethod
    async def list_demo_scenarios(self, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """List all demo scenarios.
        
        Args:
            limit: Maximum number of results
            offset: Number of results to skip
            
        Returns:
            List of scenarios
        """
        pass

    # Transaction Support
    @abstractmethod
    async def begin_transaction(self) -> None:
        """Begin a database transaction."""
        pass

    @abstractmethod
    async def commit_transaction(self) -> None:
        """Commit the current transaction."""
        pass

    @abstractmethod
    async def rollback_transaction(self) -> None:
        """Rollback the current transaction."""
        pass
