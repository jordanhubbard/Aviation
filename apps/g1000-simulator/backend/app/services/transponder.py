from __future__ import annotations

from dataclasses import dataclass
from typing import Dict


IDENT_DURATION_SEC = 18.0
TRANSPONDER_MODES = ("OFF", "STBY", "A", "C", "S")


def normalize_squawk(value: str | int | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, int):
        if value < 0:
            return None
        code = f"{value:04d}"
    elif isinstance(value, str):
        code = value.strip()
        if not code.isdigit():
            return None
        code = code.zfill(4)
    else:
        return None
    if len(code) != 4:
        return None
    if any(char not in "01234567" for char in code):
        return None
    return code


@dataclass
class TransponderState:
    mode: str
    squawk_code: str
    ident_active: bool
    ident_remaining_sec: float

    def to_dict(self) -> Dict[str, float | str | bool]:
        return {
            "mode": self.mode,
            "squawk_code": self.squawk_code,
            "ident_active": self.ident_active,
            "ident_remaining_sec": self.ident_remaining_sec,
        }

    def trigger_ident(self) -> None:
        self.ident_active = True
        self.ident_remaining_sec = IDENT_DURATION_SEC

    def clear_ident(self) -> None:
        self.ident_active = False
        self.ident_remaining_sec = 0.0

    def update(self, delta: float) -> None:
        if not self.ident_active:
            return
        self.ident_remaining_sec = max(0.0, self.ident_remaining_sec - delta)
        if self.ident_remaining_sec == 0.0:
            self.ident_active = False
