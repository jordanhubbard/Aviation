# Integration tests for flight-planner

import unittest
from unittest.mock import patch
import requests
import websocket


class TestFlightPlannerIntegration(unittest.TestCase):

    def setUp(self):
        # Setup code, if needed
        pass

    def tearDown(self):
        # Teardown code, if needed
        pass

    def test_telemetry_streaming(self):
        # Mock WebSocket connection and test telemetry streaming
        ws = websocket.WebSocket()
        ws.connect("ws://localhost:8000/telemetry")
        message = ws.recv()
        self.assertIsNotNone(message)
        ws.close()

    def test_flight_plan_api(self):
        # Test flight plan API endpoint
        response = requests.get("http://localhost:8000/api/flight-plan")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('flight_plan', data)

    def test_nav_data_query(self):
        # Test navigation data query API endpoint
        response = requests.get("http://localhost:8000/api/nav-data")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('nav_data', data)

if __name__ == '__main__':
    unittest.main()
