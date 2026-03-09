# flight_plan.py

from typing import Optional, List, Dict, Any
from datetime import datetime


class FlightPlan:
    """Data model for a flight plan."""
    def __init__(self, plan_id: str, origin: str, destination: str, 
                 waypoints: List[str] = None, altitude: int = None,
                 speed: int = None, created_at: datetime = None):
        self.id = plan_id
        self.origin = origin
        self.destination = destination
        self.waypoints = waypoints or []
        self.altitude = altitude
        self.speed = speed
        self.created_at = created_at or datetime.now()
        self.updated_at = datetime.now()

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'origin': self.origin,
            'destination': self.destination,
            'waypoints': self.waypoints,
            'altitude': self.altitude,
            'speed': self.speed,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }


class FlightPlanService:
    """Service for managing flight plans."""
    
    def __init__(self):
        self.flight_plans: Dict[str, FlightPlan] = {}
        self._next_id = 1

    def create_flight_plan(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new flight plan.
        
        Args:
            data: Dictionary containing origin, destination, waypoints, altitude, speed
            
        Returns:
            Dictionary representation of the created flight plan
        """
        plan_id = str(self._next_id)
        self._next_id += 1
        
        flight_plan = FlightPlan(
            plan_id=plan_id,
            origin=data.get('origin'),
            destination=data.get('destination'),
            waypoints=data.get('waypoints', []),
            altitude=data.get('altitude'),
            speed=data.get('speed')
        )
        
        self.flight_plans[plan_id] = flight_plan
        return flight_plan.to_dict()

    def get_flight_plan(self, plan_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a flight plan by ID.
        
        Args:
            plan_id: The ID of the flight plan to retrieve
            
        Returns:
            Dictionary representation of the flight plan, or None if not found
        """
        flight_plan = self.flight_plans.get(plan_id)
        return flight_plan.to_dict() if flight_plan else None

    def update_flight_plan(self, plan_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update an existing flight plan.
        
        Args:
            plan_id: The ID of the flight plan to update
            data: Dictionary containing fields to update
            
        Returns:
            Dictionary representation of the updated flight plan, or None if not found
        """
        flight_plan = self.flight_plans.get(plan_id)
        if not flight_plan:
            return None
        
        if 'origin' in data:
            flight_plan.origin = data['origin']
        if 'destination' in data:
            flight_plan.destination = data['destination']
        if 'waypoints' in data:
            flight_plan.waypoints = data['waypoints']
        if 'altitude' in data:
            flight_plan.altitude = data['altitude']
        if 'speed' in data:
            flight_plan.speed = data['speed']
        
        flight_plan.updated_at = datetime.now()
        return flight_plan.to_dict()

    def delete_flight_plan(self, plan_id: str) -> bool:
        """Delete a flight plan.
        
        Args:
            plan_id: The ID of the flight plan to delete
            
        Returns:
            True if the flight plan was deleted, False if not found
        """
        if plan_id in self.flight_plans:
            del self.flight_plans[plan_id]
            return True
        return False

    def list_flight_plans(self) -> List[Dict[str, Any]]:
        """List all flight plans.
        
        Returns:
            List of flight plan dictionaries
        """
        return [fp.to_dict() for fp in self.flight_plans.values()]
