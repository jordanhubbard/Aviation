"""Alert Priority System for Aviation Applications.

Implements a three-level alert system:
- Level 1: Master Warning (Red) - Immediate action required
- Level 2: Master Caution (Yellow) - Attention required
- Level 3: Advisory (White/Cyan) - Informational

"""

class AlertLevel:
    MASTER_WARNING = 1
    MASTER_CAUTION = 2
    ADVISORY = 3

class Alert:
    def __init__(self, level, message):
        self.level = level
        self.message = message

    def __str__(self):
        return f"Alert Level {self.level}: {self.message}"

    def get_aural_alert(self):
        if self.level == AlertLevel.MASTER_WARNING:
            return "Continuous aural tone"
        elif self.level == AlertLevel.MASTER_CAUTION:
            return "Single chime"
        return "No aural alert"

    def get_visual_alert(self):
        if self.level == AlertLevel.MASTER_WARNING:
            return "Flashing red annunciator"
        elif self.level == AlertLevel.MASTER_CAUTION:
            return "Solid yellow annunciator"
        return "No visual alert"

# Example usage
if __name__ == "__main__":
    fire_alert = Alert(AlertLevel.MASTER_WARNING, "Fire detected!")
    print(fire_alert)
    print(fire_alert.get_aural_alert())
    print(fire_alert.get_visual_alert())

    fuel_alert = Alert(AlertLevel.MASTER_CAUTION, "Low fuel level!")
    print(fuel_alert)
    print(fuel_alert.get_aural_alert())
    print(fuel_alert.get_visual_alert())

    altitude_alert = Alert(AlertLevel.ADVISORY, "Altitude alert!")
    print(altitude_alert)
    print(altitude_alert.get_aural_alert())
    print(altitude_alert.get_visual_alert())
