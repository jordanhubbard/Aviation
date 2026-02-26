# routing.py

from typing import List, Dict, Any, Tuple
import math


class Route:
    """Represents a flight route."""
    def __init__(self, origin: str, destination: str, waypoints: List[str] = None):
        self.origin = origin
        self.destination = destination
        self.waypoints = waypoints or []
        self.segments = []
        self.total_distance = 0.0
        self.total_time = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            'origin': self.origin,
            'destination': self.destination,
            'waypoints': self.waypoints,
            'segments': self.segments,
            'total_distance': self.total_distance,
            'total_time': self.total_time
        }


class RoutingService:
    """Service for calculating flight routes."""
    
    def __init__(self):
        # Sample airport coordinates (latitude, longitude)
        self.airport_coords = {
            'KJFK': (40.6413, -73.7781),
            'KLAX': (33.9425, -118.4081),
            'KORD': (41.9742, -87.9073),
            'KDFW': (32.8975, -97.0382),
            'KATL': (33.6407, -84.4277)
        }

    def calculate_route(self, start: str, end: str, waypoints: List[str] = None) -> Dict[str, Any]:
        """Calculate a route from start to end with optional waypoints.
        
        Args:
            start: Origin airport code
            end: Destination airport code
            waypoints: List of intermediate waypoint airport codes
            
        Returns:
            Dictionary with route information
        """
        waypoints = waypoints or []
        
        # Validate airports
        if start not in self.airport_coords:
            return {'error': f'Origin airport {start} not found'}
        if end not in self.airport_coords:
            return {'error': f'Destination airport {end} not found'}
        
        route = Route(start, end, waypoints)
        
        # Build route segments
        current = start
        all_waypoints = waypoints + [end]
        
        for waypoint in all_waypoints:
            if waypoint not in self.airport_coords:
                return {'error': f'Waypoint {waypoint} not found'}
            
            distance = self._calculate_distance(
                self.airport_coords[current],
                self.airport_coords[waypoint]
            )
            
            segment = {
                'from': current,
                'to': waypoint,
                'distance_nm': round(distance, 2),
                'heading': self._calculate_heading(
                    self.airport_coords[current],
                    self.airport_coords[waypoint]
                )
            }
            
            route.segments.append(segment)
            route.total_distance += distance
            current = waypoint
        
        # Estimate time at 450 knots
        route.total_time = round(route.total_distance / 450, 2)
        
        return route.to_dict()

    def _calculate_distance(self, point1: Tuple[float, float], 
                           point2: Tuple[float, float]) -> float:
        """Calculate great circle distance between two points in nautical miles."""
        lat1, lon1 = point1
        lat2, lon2 = point2
        
        # Convert to radians
        lat1_rad = math.radians(lat1)
        lon1_rad = math.radians(lon1)
        lat2_rad = math.radians(lat2)
        lon2_rad = math.radians(lon2)
        
        # Haversine formula
        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad
        
        a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        # Earth radius in nautical miles
        earth_radius_nm = 3440.065
        
        return earth_radius_nm * c

    def _calculate_heading(self, point1: Tuple[float, float], 
                          point2: Tuple[float, float]) -> float:
        """Calculate magnetic heading from point1 to point2."""
        lat1, lon1 = point1
        lat2, lon2 = point2
        
        lat1_rad = math.radians(lat1)
        lon1_rad = math.radians(lon1)
        lat2_rad = math.radians(lat2)
        lon2_rad = math.radians(lon2)
        
        dlon = lon2_rad - lon1_rad
        
        y = math.sin(dlon) * math.cos(lat2_rad)
        x = math.cos(lat1_rad) * math.sin(lat2_rad) - math.sin(lat1_rad) * math.cos(lat2_rad) * math.cos(dlon)
        
        heading = math.degrees(math.atan2(y, x))
        heading = (heading + 360) % 360
        
        return round(heading, 1)
