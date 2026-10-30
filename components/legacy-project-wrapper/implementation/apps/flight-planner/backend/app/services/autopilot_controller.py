# Autopilot compatibility controllers backed by the common flight-dynamics SDK.

from aviation_flight_dynamics.autopilot import (
    PIDController as SharedPIDController,
    PIDGains,
)


class PIDController:
    def __init__(self, kp, ki, kd):
        self.kp = kp
        self.ki = ki
        self.kd = kd
        self._controller = SharedPIDController(PIDGains(kp=kp, ki=ki, kd=kd))

    def compute(self, setpoint, measured_value):
        error = setpoint - measured_value
        return self._controller.update(error, 1.0)

    def reset(self):
        """Clear accumulated state so the controller re-engages cleanly."""
        self._controller.reset()

    @property
    def prev_error(self):
        return self._controller.prev_error

    @property
    def integral(self):
        return self._controller.integral

class PitchController(PIDController):
    def __init__(self):
        super().__init__(kp=1.2, ki=0.15, kd=0.07)

class RollController(PIDController):
    def __init__(self):
        super().__init__(kp=1.0, ki=0.1, kd=0.05)

class AltitudeHoldController(PIDController):
    def __init__(self):
        super().__init__(kp=1.0, ki=0.1, kd=0.05)

class HeadingHoldController(PIDController):
    def __init__(self):
        super().__init__(kp=1.0, ki=0.1, kd=0.05)

if __name__ == "__main__":
    # Demo only. Previously this ran on import, instantiating controllers and
    # printing to stdout in every process that imported the module.
    pitch_controller = PitchController()
    roll_controller = RollController()
    altitude_controller = AltitudeHoldController()
    heading_controller = HeadingHoldController()

    print(f"Pitch Output: {pitch_controller.compute(setpoint=5, measured_value=3)}")
    print(f"Roll Output: {roll_controller.compute(setpoint=0, measured_value=2)}")
    print(f"Altitude Output: {altitude_controller.compute(setpoint=10000, measured_value=9500)}")
    print(f"Heading Output: {heading_controller.compute(setpoint=90, measured_value=85)}")
