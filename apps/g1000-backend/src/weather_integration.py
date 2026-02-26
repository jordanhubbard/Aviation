# Weather Integration Layer for G1000 Backend

from aviation.weather import fetchMetarRaw, parseMetar, flightCategory

class WeatherIntegration:
    def __init__(self):
        pass

    def get_metar_data(self, icao_code):
        raw_metar = fetchMetarRaw(icao_code)
        if raw_metar:
            parsed_metar = parseMetar(raw_metar)
            return parsed_metar
        return None

    def get_flight_category(self, visibility_sm, ceiling_ft):
        return flightCategory(visibility_sm, ceiling_ft)

# Example usage
weather_integration = WeatherIntegration()
metar_data = weather_integration.get_metar_data('KSFO')
if metar_data:
    print(f"METAR Data for KSFO: {metar_data}")
    category = weather_integration.get_flight_category(metar_data['visibility_sm'], metar_data['ceiling_ft'])
    print(f"Flight Category: {category}")
