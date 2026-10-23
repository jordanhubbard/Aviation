from dataclasses import dataclass

@dataclass
class Alert:
    message: str
    severity: str

class AlertService:
    def __init__(self, fuel_threshold: float, oil_threshold: float, electrical_threshold: float):
        self.fuel_threshold = fuel_threshold
        self.oil_threshold = oil_threshold
        self.electrical_threshold = electrical_threshold

    def check_fuel_level(self, fuel_level: float) -> Alert | None:
        if fuel_level < self.fuel_threshold:
            return Alert(message="Fuel level is below threshold!", severity="high")
        return None

    def check_oil_pressure(self, oil_pressure: float) -> Alert | None:
        if oil_pressure < self.oil_threshold:
            return Alert(message="Oil pressure is below threshold!", severity="medium")
        return None

    def check_electrical_system(self, electrical_status: float) -> Alert | None:
        if electrical_status < self.electrical_threshold:
            return Alert(message="Electrical system is below threshold!", severity="low")
        return None
