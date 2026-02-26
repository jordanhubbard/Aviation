# Additional Aircraft Support

class AdditionalAircraft:
    def __init__(self, aircraft_type):
        self.aircraft_type = aircraft_type
        self.aircraft_data = self.load_aircraft_data(aircraft_type)

    def load_aircraft_data(self, aircraft_type):
        """Load data specific to the aircraft type."""
        # Implement logic to load aircraft data (e.g., SR22, C182, DA40)
        return {
            'SR22': {'max_speed': 211, 'range': 1240},
            'C182': {'max_speed': 145, 'range': 930},
            'DA40': {'max_speed': 178, 'range': 940}
        }.get(aircraft_type, {})

    def get_performance_metrics(self):
        """Get performance metrics for the aircraft."""
        return self.aircraft_data

    def simulate_flight(self):
        """Simulate flight dynamics for the aircraft."""
        # Implement flight simulation logic
        pass

# Example usage
# aircraft = AdditionalAircraft('SR22')
# performance = aircraft.get_performance_metrics()
