# Real-Time Weather Integration

class RealTimeWeather:
    def __init__(self, weather_service):
        self.weather_service = weather_service
        self.current_weather = None

    def fetch_current_weather(self, location):
        """Fetch current weather data for a given location."""
        self.current_weather = self.weather_service.get_weather(location)
        return self.current_weather

    def display_weather_overlay(self):
        """Display weather overlay on the navigation display."""
        if self.current_weather:
            # Render weather data on the display
            return self.current_weather.render_overlay()
        return None

    def update_weather_data(self):
        """Update weather data in real-time."""
        # Implement logic to periodically fetch and update weather data
        pass

    def alert_severe_weather(self):
        """Alert the pilot of severe weather conditions."""
        if self.current_weather and self.current_weather.is_severe():
            return "Severe weather alert!"
        return "Weather conditions normal."
