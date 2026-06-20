---
id: Aviation-dhw.14.3
status: closed
deps: []
links: []
created: 2026-01-24T11:49:27.499247-08:00
type: task
priority: 2
parent: Aviation-dhw.14
mac-task-id: task_9f2730fd9e654ef08a299149eed675b1
---
# Story: Autopilot PID controllers

## Controllers
- Pitch controller (PID)
- Roll controller (PID)
- Altitude hold logic
- Heading hold logic

## Example Logic (from plan)
```python
class PitchController:
    def __init__(self, Kp=0.5, Ki=0.01, Kd=0.1):
        self.Kp = Kp
        self.Ki = Ki
        self.Kd = Kd
        self.integral = 0
        self.prev_error = 0

    def update(self, target_pitch, current_pitch, dt):
        error = target_pitch - current_pitch
        self.integral += error * dt
        derivative = (error - self.prev_error) / dt
        self.prev_error = error
        output = self.Kp * error + self.Ki * self.integral + self.Kd * derivative
        return np.clip(output, -1.0, 1.0)
```

```python
class HeadingHoldController:
    def update(self, target_hdg, current_hdg, dt):
        hdg_error = normalize_angle(target_hdg - current_hdg)
        target_roll = np.clip(hdg_error * 2.0, -25, 25)
        return self.roll_controller.update(target_roll, get_current_roll(), dt)
```

## Close Reason

Closed
