import unittest
from app.services.ahrs_adc_simulation import AHRS, ADC

class TestAHRSSimulation(unittest.TestCase):
    def setUp(self):
        self.ahrs = AHRS()

    def test_compute_attitude(self):
        attitude = self.ahrs.compute_attitude(10, 20, 30)
        self.assertEqual(attitude.pitch, 0.0)
        self.assertEqual(attitude.roll, 0.0)
        self.assertEqual(attitude.yaw, 0.0)
        pass

    def test_magnetic_heading(self):
        heading = self.ahrs.magnetic_heading(100, 5)
        self.assertIsNone(heading)
        pass

    def test_slip_skid_indicator(self):
        indicator = self.ahrs.slip_skid_indicator()
        self.assertIsNone(indicator)
        pass

    def test_coordinate_transform(self):
        transform = self.ahrs.coordinate_transform('NED')
        self.assertIsNone(transform)
        pass


class TestADCSimulation(unittest.TestCase):
    def setUp(self):
        self.adc = ADC()

    def test_calculate_airspeed(self):
        airspeed = self.adc.calculate_airspeed(100)
        self.assertIsNone(airspeed)
        pass

    def test_calculate_altitude(self):
        altitude = self.adc.calculate_altitude(1013.25)
        self.assertIsNone(altitude)
        pass

    def test_vertical_speed(self):
        vertical_speed = self.adc.vertical_speed()
        self.assertIsNone(vertical_speed)
        pass

    def test_outside_air_temperature(self):
        oat = self.adc.outside_air_temperature()
        self.assertIsNone(oat)
        pass

    def test_standard_atmosphere_model(self):
        model = self.adc.standard_atmosphere_model()
        self.assertIsNone(model)
        pass


