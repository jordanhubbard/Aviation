# Main entry point for G1000 Backend

from fastapi import FastAPI
from weather_integration import WeatherIntegration

app = FastAPI()

weather_integration = WeatherIntegration()

@app.get("/api/weather/metar/{icao}")
async def get_metar(icao: str):
    metar_data = weather_integration.get_metar_data(icao)
    if metar_data:
        return {
            "station": icao,
            "temperature": metar_data['temperature_f'],
            "visibility": metar_data['visibility_sm'],
            "ceiling": metar_data['ceiling_ft'],
            "flight_category": weather_integration.get_flight_category(metar_data['visibility_sm'], metar_data['ceiling_ft'])
        }
    return {"error": "METAR data not available"}
