"""Bounded product-413 decoding; protocol fields are not weather-validity claims."""

ALPHABET = "\x03ABCDEFGHIJKLMNOPQRSTUVWXYZ\x1a\t\x1e\n| !\"#$%&'()*+,-./0123456789:;<=>?"


def _records(data):
    value, remaining = int.from_bytes(data, "big"), len(data) * 8
    current, result, expanded, tab = [], [], 0, False
    while remaining >= 6:
        remaining -= 6
        code = (value >> remaining) & 63
        if tab:
            current.append(" " * code)
            expanded += code
            tab = False
        elif code == 28:
            tab = True
        elif code == 29:
            raw = "".join(current)
            fields = raw.split(" ", 3)
            if len(fields) != 4 or any(not field for field in fields):
                raise ValueError("invalid-text-record")
            if any(len(field) > 32 for field in fields[:3]):
                raise ValueError("invalid-text-record")
            result.append(
                dict(
                    product_id=413,
                    raw_text=raw,
                    report_type=fields[0],
                    location_id=fields[1],
                    report_time=fields[2],
                    body=fields[3],
                )
            )
            if len(result) > 128:
                raise ValueError("uplink-text-limit")
            current = []
            padding = remaining % 8
            remaining -= padding
            if padding and (value >> remaining) & ((1 << padding) - 1):
                raise ValueError("invalid-text-padding")
        elif code == 0 and not current and not (value & ((1 << remaining) - 1)):
            remaining = 0
            break
        elif code == 27:
            continue
        elif code == 31:
            raise ValueError("unsupported-text-control")
        elif code == 0:
            raise ValueError("invalid-text-control")
        else:
            current.append(ALPHABET[code])
            expanded += 1
        if expanded > 4096:
            raise ValueError("uplink-text-limit")
    if current or tab or (remaining and value & ((1 << remaining) - 1)):
        raise ValueError("incomplete-text-record")
    return result


def decode_uplink(data):
    """Called only after the shared decoder's fixed-length and CRC gates."""
    if len(data) != 436:
        raise ValueError("invalid-message-length")
    tor = int.from_bytes(data[1:4], "little")
    valid = bool(data[10] & 0x20)
    result = dict(
        kind="uplink",
        time_of_reception_ns=tor * 80 if tor < 12500000 else None,
        application_data_valid=valid,
        records=[],
        unsupported_frames=0,
        unsupported_products=[],
        errors=[],
    )
    if not valid:
        result["errors"].append("invalid-application-data")
        return result
    application, offset, frames = data[12:], 0, 0
    while offset < 424:
        if offset == 423:
            if application[offset]:
                raise ValueError("invalid-uplink-padding")
            break
        first, second = application[offset : offset + 2]
        length = (first << 1) | (second >> 7)
        if length == 0:
            if any(application[offset:]):
                raise ValueError("invalid-uplink-padding")
            break
        frames += 1
        end = offset + 2 + length
        if frames > 141 or end > 424 or second & 0x70:
            raise ValueError("invalid-uplink-frame")
        frame = application[offset + 2 : end]
        offset = end
        if second & 15:
            result["unsupported_frames"] += 1
            continue
        if len(frame) < 2:
            if len(result["errors"]) < 32:
                result["errors"].append("short-apdu")
            continue
        product = ((frame[0] & 31) << 6) | (frame[1] >> 2)
        if product != 413 or frame[0] & 0xE0 or frame[1] & 2:
            result["unsupported_frames"] += 1
            if product not in result["unsupported_products"]:
                result["unsupported_products"].append(product)
            continue
        try:
            if len(frame) < 4:
                raise ValueError("short-apdu")
            option = ((frame[1] & 1) << 1) | (frame[2] >> 7)
            size, mask = ((4, 15), (5, 63), (5, 7), (6, 31))[option]
            if len(frame) <= size:
                raise ValueError("short-apdu")
            if frame[size - 1] & mask:
                raise ValueError("invalid-apdu-padding")
            records = _records(frame[size:])
            if (
                len(result["records"]) + len(records) > 128
                or sum(len(r["raw_text"]) for r in result["records"] + records) > 4096
            ):
                raise ValueError("uplink-text-limit")
            result["records"].extend(records)
        except ValueError as error:
            if len(result["errors"]) < 32:
                result["errors"].append(str(error))
    return result
