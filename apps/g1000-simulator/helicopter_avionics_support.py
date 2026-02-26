# Helicopter Avionics Support

class HelicopterAvionics:
    def __init__(self, helicopter_model):
        self.helicopter_model = helicopter_model
        self.avionics_data = self.load_avionics_data(helicopter_model)

    def load_avionics_data(self, helicopter_model):
        """Load avionics data specific to the helicopter model."""
        # Implement logic to load helicopter avionics data
        return {
            'Bell 206': {'max_speed': 120, 'range': 374},
            'Robinson R44': {'max_speed': 130, 'range': 300},
            'Eurocopter AS350': {'max_speed': 155, 'range': 361}
        }.get(helicopter_model, {})

    def get_avionics_metrics(self):
        """Get avionics metrics for the helicopter."""
        return self.avionics_data

    def simulate_helicopter_flight(self):
        """Simulate flight dynamics for the helicopter."""
        # Implement helicopter flight simulation logic
        pass

# Example usage
# helicopter_avionics = HelicopterAvionics('Bell 206')
# avionics_metrics = helicopter_avionics.get_avionics_metrics()
