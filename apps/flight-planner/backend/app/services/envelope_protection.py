# Envelope Protection Module

class EnvelopeProtection:
    def __init__(self):
        # Define default limits
        self.pitch_limit = 20  # degrees
        self.bank_limit = 60  # degrees
        self.overspeed_limit = 250  # knots
        self.stall_speed = 60  # knots

    def check_pitch(self, pitch):
        if abs(pitch) > self.pitch_limit:
            return "Pitch limit exceeded"
        return "Pitch within limits"

    def check_bank(self, bank):
        if abs(bank) > self.bank_limit:
            return "Bank limit exceeded"
        return "Bank within limits"

    def check_overspeed(self, speed):
        if speed > self.overspeed_limit:
            return "Overspeed limit exceeded"
        return "Speed within limits"

    def check_stall(self, speed):
        if speed < self.stall_speed:
            return "Stall speed limit exceeded"
        return "Speed above stall limit"

# Example usage
protection = EnvelopeProtection()
print(protection.check_pitch(35))  # Output: Pitch limit exceeded
print(protection.check_bank(45))   # Output: Bank within limits
print(protection.check_overspeed(260))  # Output: Overspeed limit exceeded
print(protection.check_stall(55))  # Output: Stall speed limit exceeded
