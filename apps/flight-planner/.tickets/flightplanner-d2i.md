---
id: flightplanner-d2i
status: closed
deps: []
links: []
created: 2025-12-17T21:39:46.069053-05:00
type: feature
priority: 1
mac-task-id: task_3c2fa48db5f248f08607a1a23318e6da
---
# Show map + weather overlays for local planning results

Local planning mode currently renders only a chip list; add a Leaflet map view for the local radius + nearby airports and allow the existing OpenWeather overlay toggles to render on that map as well.

## Close Reason

Added LocalMap to render local planning radius + nearby airports on Leaflet and re-used WeatherOverlayControls to enable OpenWeather tile overlays in local mode
