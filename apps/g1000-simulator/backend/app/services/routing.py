# routing.py

from typing import List, Dict, Any, Tuple
import math


class Waypoint:
    """Represents a waypoint in a route."""
    def __init__(self, identifier: str, latitude: float, longitude: float):
        self.identifier = identifier
        self.latitude = latitude
        self.longitude = longitude

    def to_dict(self) -> Dict[str, Any]:
        return {
            'identifier': self.identifier,
            'latitude': self.latitude,
            'longitude': self.longitude
        }


class Route:
    """Represents a complete route with waypoints."""
    def __init__(self, start: Waypoint, end: Waypoint, waypoints: List[Waypoint] = None):
        self.start = start
        self.end = end
        self.waypoints = waypoints or []
        self.total_distance = self._calculate_total_distance()

    def _calculate_total_distance(self) -> float:
        """Calculate total distance of the route."""
        distance = 0.0
        points = [self.start] + self.waypoints + [self.end]
        
        for i in range(len(points) - 1):
            distance += self._great_circle_distance(
                points[i].latitude, points[i].longitude,
                points[i+1].latitude, points[i+1].longitude
            )
        
        return distance

    @staticmethod
    def _great_circle_distance(lat1: float, lon1: float, 
                               lat2: float, lon2: float) -> float:
        """Calculate great circle distance between two points in nautical miles."""
        R = 3440.065  # Earth radius in nautical miles
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        return R * c

    def to_dict(self) -> Dict[str, Any]:
        return {
            'start': self.start.to_dict(),
            'end': self.end.to_dict(),
            'waypoints': [wp.to_dict() for wp in self.waypoints],
            'total_distance_nm': round(self.total_distance, 2)
        }


class RoutingService:
    """Service for calculating and optimizing routes."""
    
    def __init__(self):
        pass

    def calculate_route(self, start: Dict[str, Any], end: Dict[str, Any], 
                       waypoints: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Calculate a route from start to end with optional waypoints.
        
        Args:
            start: Dictionary with 'identifier', 'latitude', 'longitude'
            end: Dictionary with 'identifier', 'latitude', 'longitude'
            waypoints: List of waypoint dictionaries
            
        Returns:
            Dictionary representation of the calculated route
        """
        start_wp = Waypoint(
            identifier=start.get('identifier', 'START'),
            latitude=start.get('latitude'),
            longitude=start.get('longitude')
        )
        
        end_wp = Waypoint(
            identifier=end.get('identifier', 'END'),
            latitude=end.get('latitude'),
            longitude=end.get('longitude')
        )
        
        waypoint_list = []
        if waypoints:
            for wp in waypoints:
                waypoint_list.append(Waypoint(
                    identifier=wp.get('identifier'),
                    latitude=wp.get('latitude'),
                    longitude=wp.get('longitude')
                ))
        
        route = Route(start_wp, end_wp, waypoint_list)
        return route.to_dict()

    def optimize_route(self, waypoints: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Optimize waypoint order using nearest neighbor algorithm.
        
        Args:
            waypoints: List of waypoint dictionaries
            
        Returns:
            Optimized list of waypoint dictionaries
        """
        if not waypoints or len(waypoints) <= 2:
            return waypoints
        
        # Simple nearest neighbor optimization
        unvisited = [Waypoint(**wp) for wp in waypoints]
        optimized = [unvisited.pop(0)]
        
        while unvisited:
            current = optimized[-1]
            nearest = min(unvisited, key=lambda wp: Route._great_circle_distance(
                current.latitude, current.longitude,
                wp.latitude, wp.longitude
            ))
            optimized.append(nearest)
            unvisited.remove(nearest)
        
        return [wp.to_dict() for wp in optimized]
