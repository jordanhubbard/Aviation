/** Bounded, transport-free GDL90 input (Public ICD Rev A). */
type Base = { message_id: number; payload_hex: string };
export type Gdl90Message = Base &
  (
    | {
        kind: 'heartbeat';
        gps_position_valid: boolean;
        utc_valid: boolean;
        seconds_since_midnight: number | null;
        status_byte_1: number;
        status_byte_2: number;
        message_counts_raw: number;
      }
    | {
        kind: 'ownship' | 'traffic';
        participant_address: string;
        address_type: number;
        alert_status: number;
        position_valid: boolean;
        latitude_deg: number | null;
        longitude_deg: number | null;
        pressure_altitude_ft: number | null;
        horizontal_speed_kt: number | null;
        horizontal_speed_at_least_kt: number | null;
        horizontal_speed_saturated: boolean;
        vertical_speed_fpm: number | null;
        vertical_speed_bound_fpm: number | null;
        vertical_speed_saturated: boolean;
        angle_deg: number | null;
        angle_reference: string | null;
        nic: number;
        nacp: number;
        airborne: boolean;
        extrapolated: boolean;
        emitter_category: number;
        callsign: string;
        emergency_code: number;
      }
    | {
        kind: 'geometric_altitude';
        geometric_altitude_ft: number;
        datum: 'WGS84_ellipsoid' | 'MSL' | null;
        datum_source:
          | 'gdl90_standard'
          | 'foreflight_device_id'
          | 'unknown_receiver_profile';
        vertical_warning: boolean;
        vertical_figure_of_merit_m: number | null;
        vertical_figure_of_merit_lower_bound: boolean;
      }
    | {
        kind: 'device_id';
        version: 1;
        serial_number_hex: string | null;
        device_name: string;
        device_long_name: string;
        capabilities_mask: number;
        geometric_altitude_datum: 'WGS84_ellipsoid' | 'MSL';
        internet_policy: 'unrestricted' | 'expensive' | 'disallowed' | null;
        reserved_capabilities_mask: number;
      }
    | { kind: 'unsupported'; supported: false }
  );
export type Gdl90Result = { messages: Gdl90Message[]; errors: string[] };

function crc(data: Uint8Array): number {
  let value = 0;
  for (const byte of data) {
    let entry = (value >>> 8) << 8;
    for (let bit = 0; bit < 8; bit++) {
      entry = ((entry << 1) ^ (entry & 0x8000 ? 0x1021 : 0)) & 0xffff;
    }
    value = (entry ^ (value << 8) ^ byte) & 0xffff;
  }
  return value;
}
const hex = (data: Uint8Array): string =>
  Array.from(data, (b) => ('0' + b.toString(16)).slice(-2)).join('');
function signed(data: Uint8Array, offset: number, count: number): number {
  let value = data[offset] & 0x80 ? -1 : 0;
  for (let i = offset; i < offset + count; i++) value = (value << 8) | data[i];
  return value;
}

function report(data: Uint8Array): Gdl90Message {
  const identifier = data[0];
  if (identifier > 127) throw new Error('invalid-message-id');
  const base: Base = { message_id: identifier, payload_hex: hex(data) };
  const sizes: Record<number, number> = { 0: 7, 10: 28, 20: 28, 11: 5 };
  if (sizes[identifier] && data.length !== sizes[identifier])
    throw new Error('invalid-message-length');
  if (identifier === 0) {
    const seconds = ((data[2] & 0x80) << 9) | data[3] | (data[4] << 8);
    return {
      ...base,
      kind: 'heartbeat',
      gps_position_valid: Boolean(data[1] & 0x80),
      utc_valid: Boolean(data[2] & 1) && seconds < 86400,
      seconds_since_midnight: seconds < 86400 ? seconds : null,
      status_byte_1: data[1],
      status_byte_2: data[2],
      message_counts_raw: data[5] | (data[6] << 8),
    };
  }
  if (identifier === 10 || identifier === 20) {
    const latitude = (signed(data, 5, 3) * 180) / 2 ** 23;
    const longitude = (signed(data, 8, 3) * 180) / 2 ** 23;
    const altitude = (data[11] << 4) | (data[12] >>> 4);
    const misc = data[12] & 15,
      nic = data[13] >>> 4,
      nacp = data[13] & 15;
    const horizontal = (data[14] << 4) | (data[15] >>> 4);
    const vertical = ((data[15] & 15) << 8) | data[16];
    const rateValid = vertical <= 0x1fe || vertical >= 0xe02;
    const positionValid =
      Math.abs(latitude) <= 90 &&
      !(latitude === 0 && longitude === 0 && nic === 0);
    const angleType = [null, 'true_track', 'magnetic_heading', 'true_heading'][
      misc & 3
    ];
    return {
      ...base,
      kind: identifier === 10 ? 'ownship' : 'traffic',
      participant_address: hex(data.slice(2, 5)).toUpperCase(),
      address_type: data[1] & 15,
      alert_status: data[1] >>> 4,
      position_valid: positionValid,
      latitude_deg: positionValid ? latitude : null,
      longitude_deg: positionValid ? longitude : null,
      pressure_altitude_ft: altitude !== 0xfff ? altitude * 25 - 1000 : null,
      horizontal_speed_kt: horizontal < 0xffe ? horizontal : null,
      horizontal_speed_at_least_kt: horizontal === 0xffe ? 4094 : null,
      horizontal_speed_saturated: horizontal === 0xffe,
      vertical_speed_fpm:
        rateValid && vertical !== 0x1fe && vertical !== 0xe02
          ? (vertical & 0x800 ? vertical - 4096 : vertical) * 64
          : null,
      vertical_speed_bound_fpm:
        vertical === 0x1fe ? 32576 : vertical === 0xe02 ? -32576 : null,
      vertical_speed_saturated: vertical === 0x1fe || vertical === 0xe02,
      angle_deg: angleType ? (data[17] * 360) / 256 : null,
      angle_reference: angleType,
      nic,
      nacp,
      airborne: Boolean(misc & 8),
      extrapolated: Boolean(misc & 4),
      emitter_category: data[18],
      callsign: Array.from(data.slice(19, 27), (b) =>
        b <= 127 ? String.fromCharCode(b) : '\ufffd',
      )
        .join('')
        .replace(/^ +| +$/g, ''),
      emergency_code: data[27] >>> 4,
    };
  }
  if (identifier === 11) {
    const quality = (data[3] << 8) | data[4],
      vfom = quality & 0x7fff;
    return {
      ...base,
      kind: 'geometric_altitude',
      geometric_altitude_ft: signed(data, 1, 2) * 5,
      datum: 'WGS84_ellipsoid',
      datum_source: 'gdl90_standard',
      vertical_warning: Boolean(quality & 0x8000),
      vertical_figure_of_merit_m: vfom === 0x7fff ? null : vfom,
      vertical_figure_of_merit_lower_bound: vfom === 0x7ffe,
    };
  }
  if (identifier === 0x65) {
    if (
      data.length < 2 ||
      (data[1] === 0 &&
        (data.length < 3 || (data[2] === 1 && data.length !== 39)))
    )
      throw new Error('invalid-message-length');
    if (data[1] === 0 && data[2] === 1) {
      const mask =
        (data[35] * 2 ** 24 + (data[36] << 16) + (data[37] << 8) + data[38]) >>> 0;
      const serial = data.slice(3, 11);
      const name = (start: number, end: number) =>
        new TextDecoder('utf-8', { ignoreBOM: true })
          .decode(data.slice(start, end))
          .replace(/[\0 ]+$/g, '');
      return {
        ...base,
        kind: 'device_id',
        version: 1,
        serial_number_hex: serial.every((b) => b === 255)
          ? null
          : hex(serial).toUpperCase(),
        device_name: name(11, 19),
        device_long_name: name(19, 35),
        capabilities_mask: mask,
        geometric_altitude_datum: mask & 1 ? 'MSL' : 'WGS84_ellipsoid',
        internet_policy: (['unrestricted', 'expensive', 'disallowed', null] as const)[
          (mask >>> 1) & 3
        ],
        reserved_capabilities_mask: (mask & 0xfffffff8) >>> 0,
      };
    }
  }
  return { ...base, kind: 'unsupported', supported: false };
}

export function resolveGeometricAltitude(
  report: Gdl90Message,
  deviceId?: Gdl90Message | null,
  profileUnknown = false,
): Extract<Gdl90Message, { kind: 'geometric_altitude' }> {
  if (report.kind !== 'geometric_altitude')
    throw new Error('Expected a geometric-altitude report');
  if (deviceId != null && (deviceId.kind !== 'device_id' || deviceId.version !== 1))
    throw new Error('Expected a supported device-ID report');
  if (profileUnknown)
    return { ...report, datum: null, datum_source: 'unknown_receiver_profile' };
  if (deviceId?.kind === 'device_id')
    return {
      ...report,
      datum: deviceId.geometric_altitude_datum,
      datum_source: 'foreflight_device_id',
    };
  return { ...report, datum: 'WGS84_ellipsoid', datum_source: 'gdl90_standard' };
}

export class Gdl90Decoder {
  private pending: number[] = [];
  private started = false;
  private escaped = false;
  private discard = false;

  push(chunk: Uint8Array): Gdl90Result {
    if (!(chunk instanceof Uint8Array) || chunk.length > 65535)
      throw new Error('GDL90 input must be at most 65535 bytes');
    const messages: Gdl90Message[] = [],
      errors: string[] = [];
    const error = (code: string): void => {
      if (errors.length < 32) errors.push(code);
      else errors[31] = 'error-limit';
    };
    for (const byte of chunk) {
      if (byte === 0x7e) {
        if (
          this.started &&
          !this.discard &&
          (this.pending.length || this.escaped)
        ) {
          const frame = Uint8Array.from(this.pending),
            n = frame.length;
          if (this.escaped) error('incomplete-escape');
          else if (n < 3) error('short-frame');
          else if (
            crc(frame.slice(0, -2)) !==
            (frame[n - 2] | (frame[n - 1] << 8))
          )
            error('invalid-fcs');
          else if (messages.length === 256) {
            if (errors.indexOf('message-limit') < 0) error('message-limit');
          } else {
            try {
              messages.push(report(frame.slice(0, -2)));
            } catch (exception) {
              error((exception as Error).message);
            }
          }
        }
        this.pending = [];
        this.started = true;
        this.escaped = false;
        this.discard = false;
      } else if (this.started && !this.discard) {
        if (this.escaped) {
          this.pending.push(byte ^ 0x20);
          this.escaped = false;
        } else if (byte === 0x7d) this.escaped = true;
        else this.pending.push(byte);
        if (this.pending.length > 4096) {
          this.pending = [];
          this.discard = true;
          error('frame-too-large');
        }
      }
    }
    return { messages, errors };
  }

  finish(): Gdl90Result {
    const incomplete = Boolean(this.pending.length || this.escaped);
    this.pending = [];
    this.started = false;
    this.escaped = false;
    this.discard = false;
    return { messages: [], errors: incomplete ? ['incomplete-frame'] : [] };
  }
}
