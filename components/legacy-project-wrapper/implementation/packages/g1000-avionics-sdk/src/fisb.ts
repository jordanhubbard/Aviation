/** Product-413 text is decoded source material, never assessed weather validity. */
export type FisbTextRecord = {
  product_id: 413;
  raw_text: string;
  report_type: string;
  location_id: string;
  report_time: string;
  body: string;
};
export type UplinkReport = {
  kind: 'uplink';
  time_of_reception_ns: number | null;
  application_data_valid: boolean;
  records: FisbTextRecord[];
  unsupported_frames: number;
  unsupported_products: number[];
  errors: string[];
};
const alphabet =
  '\x03ABCDEFGHIJKLMNOPQRSTUVWXYZ\x1a\t\x1e\n| !"#$%&\'()*+,-./0123456789:;<=>?';
function records(data: Uint8Array): FisbTextRecord[] {
  let position = 0,
    current = '',
    expanded = 0,
    tab = false;
  const result: FisbTextRecord[] = [];
  const bits = (count: number): number => {
    let value = 0;
    for (let i = 0; i < count; i++, position++)
      value =
        (value << 1) | ((data[position >>> 3] >>> (7 - (position & 7))) & 1);
    return value;
  };
  const zeroRemainder = () => {
    for (let p = position; p < data.length * 8; p++)
      if ((data[p >>> 3] >>> (7 - (p & 7))) & 1) return false;
    return true;
  };
  while (position + 6 <= data.length * 8) {
    const code = bits(6);
    if (tab) {
      current += ' '.repeat(code);
      expanded += code;
      tab = false;
    } else if (code === 28) tab = true;
    else if (code === 29) {
      const match = /^([^ ]{1,32}) ([^ ]{1,32}) ([^ ]{1,32}) ([\s\S]+)$/.exec(
        current,
      );
      if (!match) throw new Error('invalid-text-record');
      result.push({
        product_id: 413,
        raw_text: current,
        report_type: match[1],
        location_id: match[2],
        report_time: match[3],
        body: match[4],
      });
      if (result.length > 128) throw new Error('uplink-text-limit');
      current = '';
      const padding = (8 - (position & 7)) & 7;
      if (bits(padding)) throw new Error('invalid-text-padding');
    } else if (code === 0 && !current && zeroRemainder()) {
      position = data.length * 8;
      break;
    } else if (code === 27) continue;
    else if (code === 31) throw new Error('unsupported-text-control');
    else if (code === 0) throw new Error('invalid-text-control');
    else {
      current += alphabet[code];
      expanded++;
    }
    if (expanded > 4096) throw new Error('uplink-text-limit');
  }
  if (current || tab || !zeroRemainder())
    throw new Error('incomplete-text-record');
  return result;
}
export function decodeUplink(data: Uint8Array): UplinkReport {
  if (data.length !== 436) throw new Error('invalid-message-length');
  const tor = data[1] | (data[2] << 8) | (data[3] << 16);
  const result: UplinkReport = {
    kind: 'uplink',
    time_of_reception_ns: tor < 12500000 ? tor * 80 : null,
    application_data_valid: Boolean(data[10] & 32),
    records: [],
    unsupported_frames: 0,
    unsupported_products: [],
    errors: [],
  };
  if (!result.application_data_valid) {
    result.errors.push('invalid-application-data');
    return result;
  }
  const application = data.slice(12);
  let offset = 0,
    frames = 0;
  while (offset < 424) {
    if (offset === 423) {
      if (application[offset]) throw new Error('invalid-uplink-padding');
      break;
    }
    const first = application[offset],
      second = application[offset + 1];
    const length = (first << 1) | (second >>> 7);
    if (!length) {
      if (application.slice(offset).some(Boolean))
        throw new Error('invalid-uplink-padding');
      break;
    }
    const end = offset + 2 + length;
    if (++frames > 141 || end > 424 || second & 0x70)
      throw new Error('invalid-uplink-frame');
    const frame = application.slice(offset + 2, end);
    offset = end;
    if (second & 15) {
      result.unsupported_frames++;
      continue;
    }
    if (frame.length < 2) {
      if (result.errors.length < 32) result.errors.push('short-apdu');
      continue;
    }
    const product = ((frame[0] & 31) << 6) | (frame[1] >>> 2);
    if (product !== 413 || frame[0] & 0xe0 || frame[1] & 2) {
      result.unsupported_frames++;
      if (!result.unsupported_products.includes(product))
        result.unsupported_products.push(product);
      continue;
    }
    try {
      if (frame.length < 4) throw new Error('short-apdu');
      const option = ((frame[1] & 1) << 1) | (frame[2] >>> 7);
      const [size, mask] = [
        [4, 15],
        [5, 63],
        [5, 7],
        [6, 31],
      ][option];
      if (frame.length <= size) throw new Error('short-apdu');
      if (frame[size - 1] & mask) throw new Error('invalid-apdu-padding');
      const decoded = records(frame.slice(size));
      if (
        result.records.length + decoded.length > 128 ||
        [...result.records, ...decoded].reduce(
          (n, r) => n + r.raw_text.length,
          0,
        ) > 4096
      )
        throw new Error('uplink-text-limit');
      result.records.push(...decoded);
    } catch (error) {
      if (result.errors.length < 32)
        result.errors.push((error as Error).message);
    }
  }
  return result;
}
