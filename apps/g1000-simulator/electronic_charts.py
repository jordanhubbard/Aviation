# Electronic Charts Implementation
# Approach plates, airport diagrams, and navigation charts

class ElectronicCharts:
    def __init__(self, chart_database):
        self.chart_database = chart_database
        self.current_chart = None
        self.zoom_level = 1.0
        self.pan_offset = (0, 0)

    def load_approach_plate(self, airport_icao, procedure_name):
        """Load an approach plate for a specific airport and procedure."""
        # Query chart database for approach plate
        self.current_chart = self.chart_database.get_approach_plate(
            airport_icao, procedure_name
        )
        return self.current_chart

    def load_airport_diagram(self, airport_icao):
        """Load airport diagram showing runways, taxiways, and facilities."""
        self.current_chart = self.chart_database.get_airport_diagram(airport_icao)
        return self.current_chart

    def load_enroute_chart(self, chart_name):
        """Load en-route navigation chart."""
        self.current_chart = self.chart_database.get_enroute_chart(chart_name)
        return self.current_chart

    def zoom_in(self):
        """Increase zoom level for chart detail."""
        self.zoom_level *= 1.2
        return self.zoom_level

    def zoom_out(self):
        """Decrease zoom level for broader view."""
        self.zoom_level /= 1.2
        return self.zoom_level

    def pan(self, dx, dy):
        """Pan the chart display."""
        self.pan_offset = (
            self.pan_offset[0] + dx,
            self.pan_offset[1] + dy
        )
        return self.pan_offset

    def search_chart(self, query):
        """Search for charts by name or identifier."""
        return self.chart_database.search(query)

    def get_chart_metadata(self):
        """Get metadata about the current chart."""
        if self.current_chart:
            return {
                'name': self.current_chart.name,
                'effective_date': self.current_chart.effective_date,
                'revision': self.current_chart.revision,
                'scale': self.current_chart.scale
            }
        return None

    def render_chart(self):
        """Render the current chart with current zoom and pan settings."""
        if self.current_chart:
            # Apply zoom and pan transformations
            return self.current_chart.render(
                zoom=self.zoom_level,
                pan=self.pan_offset
            )
        return None
