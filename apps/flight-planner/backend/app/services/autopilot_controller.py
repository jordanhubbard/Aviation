# Autopilot Controller Module

class PIDController:
    def __init__(self, kp, ki, kd):
        self.kp = kp
        self.ki = ki
        self.kd = kd
        self.prev_error = 0
        self.integral = 0

    def compute(self, setpoint, measured_value):
        error = setpoint - measured_value
        self.integral += error
        derivative = error - self.prev_error
        output = self.kp * error + self.ki * self.integral + self.kd * derivative
        self.prev_error = error
        return output

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

# Example usage
pitch_controller = PitchController()
roll_controller = RollController()
altitude_controller = AltitudeHoldController()
heading_controller = HeadingHoldController()

# Simulate control
pitch_output = pitch_controller.compute(setpoint=5, measured_value=3)
roll_output = roll_controller.compute(setpoint=0, measured_value=2)
altitude_output = altitude_controller.compute(setpoint=10000, measured_value=9500)
heading_output = heading_controller.compute(setpoint=90, measured_value=85)

print(f"Pitch Output: {pitch_output}")
print(f"Roll Output: {roll_output}")
print(f"Altitude Output: {altitude_output}")
print(f"Heading Output: {heading_output}")
