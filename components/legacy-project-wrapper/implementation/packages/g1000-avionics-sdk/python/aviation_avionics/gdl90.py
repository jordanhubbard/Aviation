"""Bounded, transport-free GDL90 input (Public ICD Rev A)."""

from __future__ import annotations


def _crc(data: bytes) -> int:
    value = 0
    for byte in data:
        entry = (value >> 8) << 8
        for _ in range(8):
            entry = ((entry << 1) ^ (0x1021 if entry & 0x8000 else 0)) & 0xFFFF
        value = (entry ^ (value << 8) ^ byte) & 0xFFFF
    return value


def _report(data: bytes) -> dict:
    identifier = data[0]
    if identifier > 127:
        raise ValueError("invalid-message-id")
    result = {"message_id": identifier, "payload_hex": data.hex()}
    sizes = {0: 7, 7: 436, 10: 28, 20: 28, 11: 5}
    if identifier in sizes and len(data) != sizes[identifier]:
        raise ValueError("invalid-message-length")
    if identifier == 7:
        from .gdl90_fisb import decode_uplink

        result.update(decode_uplink(data))
    elif identifier == 0:
        seconds = ((data[2] & 0x80) << 9) | int.from_bytes(data[3:5], "little")
        result.update(
            kind="heartbeat",
            gps_position_valid=bool(data[1] & 0x80),
            utc_valid=bool(data[2] & 1) and seconds < 86400,
            seconds_since_midnight=seconds if seconds < 86400 else None,
            status_byte_1=data[1],
            status_byte_2=data[2],
            message_counts_raw=int.from_bytes(data[5:7], "little"),
        )
    elif identifier in {10, 20}:
        latitude = int.from_bytes(data[5:8], "big", signed=True) * 180 / 2**23
        longitude = int.from_bytes(data[8:11], "big", signed=True) * 180 / 2**23
        altitude = (data[11] << 4) | (data[12] >> 4)
        misc, nic, nacp = data[12] & 15, data[13] >> 4, data[13] & 15
        horizontal = (data[14] << 4) | (data[15] >> 4)
        vertical = ((data[15] & 15) << 8) | data[16]
        rate_valid = vertical <= 0x1FE or vertical >= 0xE02
        position_valid = abs(latitude) <= 90 and not (latitude == longitude == nic == 0)
        angle_type = (None, "true_track", "magnetic_heading", "true_heading")[misc & 3]
        result.update(
            kind="ownship" if identifier == 10 else "traffic",
            participant_address=data[2:5].hex().upper(),
            address_type=data[1] & 15,
            alert_status=data[1] >> 4,
            position_valid=position_valid,
            latitude_deg=latitude if position_valid else None,
            longitude_deg=longitude if position_valid else None,
            pressure_altitude_ft=altitude * 25 - 1000 if altitude != 0xFFF else None,
            horizontal_speed_kt=horizontal if horizontal < 0xFFE else None,
            horizontal_speed_at_least_kt=4094 if horizontal == 0xFFE else None,
            horizontal_speed_saturated=horizontal == 0xFFE,
            vertical_speed_fpm=(
                ((vertical - 4096 if vertical & 0x800 else vertical) * 64)
                if rate_valid and vertical not in {0x1FE, 0xE02}
                else None
            ),
            vertical_speed_bound_fpm=(
                32576 if vertical == 0x1FE else -32576 if vertical == 0xE02 else None
            ),
            vertical_speed_saturated=vertical in {0x1FE, 0xE02},
            angle_deg=data[17] * 360 / 256 if angle_type else None,
            angle_reference=angle_type,
            nic=nic,
            nacp=nacp,
            airborne=bool(misc & 8),
            extrapolated=bool(misc & 4),
            emitter_category=data[18],
            callsign=data[19:27].decode("ascii", errors="replace").strip(" "),
            emergency_code=data[27] >> 4,
        )
    elif identifier == 11:
        quality = int.from_bytes(data[3:5], "big")
        vfom = quality & 0x7FFF
        result.update(
            kind="geometric_altitude",
            geometric_altitude_ft=int.from_bytes(data[1:3], "big", signed=True) * 5,
            datum="WGS84_ellipsoid",
            datum_source="gdl90_standard",
            vertical_warning=bool(quality & 0x8000),
            vertical_figure_of_merit_m=None if vfom == 0x7FFF else vfom,
            vertical_figure_of_merit_lower_bound=vfom == 0x7FFE,
        )
    elif identifier == 0x65 and len(data) > 1 and data[1] == 0:
        if len(data) < 3 or (data[2] == 1 and len(data) != 39):
            raise ValueError("invalid-message-length")
        if data[2] != 1:
            result.update(kind="unsupported", supported=False)
        else:
            mask = int.from_bytes(data[35:39], "big")
            result.update(
                kind="device_id",
                version=1,
                serial_number_hex=(None if data[3:11] == b"\xff" * 8 else data[3:11].hex().upper()),
                device_name=data[11:19].decode("utf-8", errors="replace").rstrip("\x00 "),
                device_long_name=data[19:35].decode("utf-8", errors="replace").rstrip("\x00 "),
                capabilities_mask=mask,
                geometric_altitude_datum="MSL" if mask & 1 else "WGS84_ellipsoid",
                internet_policy=("unrestricted", "expensive", "disallowed", None)[(mask >> 1) & 3],
                reserved_capabilities_mask=mask & 0xFFFFFFF8,
            )
    elif identifier == 0x65 and len(data) == 1:
        raise ValueError("invalid-message-length")
    else:
        result.update(kind="unsupported", supported=False)
    return result


def resolve_geometric_altitude(
    report: dict, device_id: dict | None = None, *, profile_unknown=False
) -> dict:
    """Resolve supplied receiver context without mutating input or converting altitude."""
    if report.get("kind") != "geometric_altitude":
        raise ValueError("Expected a geometric-altitude report")
    if device_id is not None and (
        device_id.get("kind") != "device_id" or device_id.get("version") != 1
    ):
        raise ValueError("Expected a supported device-ID report")
    if profile_unknown:
        datum, source = None, "unknown_receiver_profile"
    elif device_id is not None:
        datum, source = device_id["geometric_altitude_datum"], "foreflight_device_id"
    else:
        datum, source = "WGS84_ellipsoid", "gdl90_standard"
    return dict(report, datum=datum, datum_source=source)


class Gdl90Decoder:
    """Incremental state, bounded independently of sender framing behavior."""

    def __init__(self):
        self._pending = bytearray()
        self._started = self._escaped = self._discard = False

    def push(self, chunk: bytes) -> dict:
        if not isinstance(chunk, (bytes, bytearray)) or len(chunk) > 65535:
            raise ValueError("GDL90 input must be at most 65535 bytes")
        messages, errors = [], []

        def error(code):
            if len(errors) < 32:
                errors.append(code)
            else:
                errors[-1] = "error-limit"

        for byte in chunk:
            if byte == 0x7E:
                if self._started and not self._discard and (self._pending or self._escaped):
                    frame = bytes(self._pending)
                    if self._escaped:
                        error("incomplete-escape")
                    elif len(frame) < 3:
                        error("short-frame")
                    elif _crc(frame[:-2]) != int.from_bytes(frame[-2:], "little"):
                        error("invalid-fcs")
                    elif len(messages) == 256:
                        if "message-limit" not in errors:
                            error("message-limit")
                    else:
                        try:
                            messages.append(_report(frame[:-2]))
                        except ValueError as exception:
                            error(str(exception))
                self._pending.clear()
                self._started, self._escaped, self._discard = True, False, False
            elif self._started and not self._discard:
                if self._escaped:
                    self._pending.append(byte ^ 0x20)
                    self._escaped = False
                elif byte == 0x7D:
                    self._escaped = True
                else:
                    self._pending.append(byte)
                if len(self._pending) > 4096:
                    self._pending.clear()
                    self._discard = True
                    error("frame-too-large")
        return {"messages": messages, "errors": errors}

    def finish(self) -> dict:
        incomplete = bool(self._pending or self._escaped)
        self._pending.clear()
        self._started = self._escaped = self._discard = False
        return {"messages": [], "errors": ["incomplete-frame"] if incomplete else []}
