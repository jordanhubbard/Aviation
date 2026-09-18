# Autopilot Controller Module

class PIDController:
    def __init__(self, kp, ki, kd):
        self.kp = kp
        self.ki = ki
        self.kd = kd
        self.prev_error = 0
        self.integral = 0
        self._has_prev_error = False

    def compute(self, setpoint, measured_value):
        error = setpoint - measured_value
        self.integral += error

        # On the first sample there is no previous error to difference against.
        # Treating prev_error as 0 produces a derivative kick proportional to the
        # full error, i.e. a control-surface spike the moment a mode engages.
        derivative = (error - self.prev_error) if self._has_prev_error else 0
        output = self.kp * error + self.ki * self.integral + self.kd * derivative
        self.prev_error = error
        self._has_prev_error = True
        return output

    def reset(self):
        """Clear accumulated state so the controller re-engages cleanly."""
        self.prev_error = 0
        self.integral = 0
        self._has_prev_error = False

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
