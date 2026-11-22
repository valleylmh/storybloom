const BITRATES_MPEG1_L3 = [
  0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0,
];
const BITRATES_MPEG2_L3 = [
  0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0,
];
const SAMPLE_RATES: Record<number, readonly number[]> = {
  3: [44_100, 48_000, 32_000], // MPEG-1
  2: [22_050, 24_000, 16_000], // MPEG-2
  0: [11_025, 12_000, 8_000], // MPEG-2.5
};

export type ParsedMp3Stream = {
  audioBytes: Uint8Array;
  durationSec: number;
  frameCount: number;
  version: number;
  sampleRate: number;
  channels: number;
  samplesPerFrame: number;
  sampleHeader: Uint8Array;
};

type FrameHeader = {
  version: number;
  bitrateBps: number;
  sampleRate: number;
  channels: number;
  samplesPerFrame: number;
  frameLength: number;
  sideInfoBytes: number;
};

function parseFrameHeader(bytes: Uint8Array, offset: number): FrameHeader | null {
  if (offset + 4 > bytes.length) return null;
  const b0 = bytes[offset];
  const b1 = bytes[offset + 1];
  const b2 = bytes[offset + 2];
  const b3 = bytes[offset + 3];
  if (b0 !== 0xff || (b1 & 0xe0) !== 0xe0) return null;

  const version = (b1 >> 3) & 0x03;
  const layer = (b1 >> 1) & 0x03;
  if (version === 1 || layer !== 1) return null; // Only Layer III (MP3)

  const brIdx = (b2 >> 4) & 0x0f;
  const srIdx = (b2 >> 2) & 0x03;
  const padding = (b2 >> 1) & 0x01;
  const channelMode = (b3 >> 6) & 0x03;

  const sampleRates = SAMPLE_RATES[version];
  if (!sampleRates || srIdx >= 3) return null;
  const sampleRate = sampleRates[srIdx];
  const bitrateKbps =
    version === 3 ? BITRATES_MPEG1_L3[brIdx] : BITRATES_MPEG2_L3[brIdx];
  if (!bitrateKbps) return null;

  const bitrateBps = bitrateKbps * 1000;
  const samplesPerFrame = version === 3 ? 1152 : 576;
  const frameLength = Math.floor(((samplesPerFrame / 8) * bitrateBps) / sampleRate) + padding;
  if (frameLength < 4 || offset + frameLength > bytes.length) return null;

  const channels = channelMode === 3 ? 1 : 2;
  const sideInfoBytes =
    version === 3 ? (channels === 1 ? 17 : 32) : channels === 1 ? 9 : 17;

  return {
    version,
    bitrateBps,
    sampleRate,
    channels,
    samplesPerFrame,
    frameLength,
    sideInfoBytes,
  };
}

function asciiAt(bytes: Uint8Array, offset: number, length: number): string {
  if (offset < 0 || offset + length > bytes.length) return "";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += String.fromCharCode(bytes[offset + i]);
  }
  return out;
}

function isMetadataFrame(bytes: Uint8Array, offset: number, header: FrameHeader): boolean {
  const xingTag = asciiAt(bytes, offset + 4 + header.sideInfoBytes, 4);
  if (xingTag === "Xing" || xingTag === "Info") return true;
  const vbriTag = asciiAt(bytes, offset + 4 + 32, 4);
  return vbriTag === "VBRI";
}

function stripId3Bounds(bytes: Uint8Array): { start: number; end: number } {
  let start = 0;
  let end = bytes.length;

  // Strip one or more leading ID3v2 tags.
  while (start + 10 <= end && asciiAt(bytes, start, 3) === "ID3") {
    const tagSize =
      ((bytes[start + 6] & 0x7f) << 21) |
      ((bytes[start + 7] & 0x7f) << 14) |
      ((bytes[start + 8] & 0x7f) << 7) |
      (bytes[start + 9] & 0x7f);
    const hasFooter = (bytes[start + 5] & 0x10) !== 0;
    const nextStart = start + 10 + tagSize + (hasFooter ? 10 : 0);
    if (nextStart <= start || nextStart > end) break;
    start = nextStart;
  }

  // Strip trailing ID3v1 tag if present.
  if (end - start >= 128 && asciiAt(bytes, end - 128, 3) === "TAG") {
    end -= 128;
  }

  return { start, end };
}

/**
 * Extracts raw MPEG Layer III audio frames (stripping ID3v2/ID3v1 tags and
 * Xing/Info/VBRI header frames) and computes the exact duration from frame count.
 */
export function parseMp3Stream(bytes: Uint8Array): ParsedMp3Stream | null {
  if (bytes.length < 16) return null;
  const { start, end } = stripId3Bounds(bytes);

  // Locate the first valid MP3 sync frame (confirming next frame sync when possible).
  let offset = start;
  let firstHeader: FrameHeader | null = null;
  while (offset + 4 <= end) {
    const header = parseFrameHeader(bytes, offset);
    if (header) {
      const nextOffset = offset + header.frameLength;
      if (nextOffset >= end || parseFrameHeader(bytes, nextOffset) !== null) {
        firstHeader = header;
        break;
      }
    }
    offset += 1;
  }
  if (!firstHeader) return null;

  let audioStart = offset;
  if (isMetadataFrame(bytes, offset, firstHeader)) {
    audioStart = offset + firstHeader.frameLength;
  }

  let cursor = audioStart;
  let frameCount = 0;
  let audioEnd = audioStart;
  let sampleHeader: Uint8Array | null = null;
  let version = firstHeader.version;
  let sampleRate = firstHeader.sampleRate;
  let channels = firstHeader.channels;
  let samplesPerFrame = firstHeader.samplesPerFrame;

  while (cursor + 4 <= end) {
    const header = parseFrameHeader(bytes, cursor);
    if (!header) break;
    if (frameCount === 0) {
      version = header.version;
      sampleRate = header.sampleRate;
      channels = header.channels;
      samplesPerFrame = header.samplesPerFrame;
      sampleHeader = bytes.slice(cursor, cursor + 4);
    } else if (
      header.version !== version ||
      header.sampleRate !== sampleRate ||
      header.channels !== channels
    ) {
      break;
    }
    frameCount += 1;
    cursor += header.frameLength;
    audioEnd = cursor;
  }

  if (frameCount === 0 || !sampleHeader || audioEnd <= audioStart) {
    return null;
  }

  return {
    audioBytes: bytes.subarray(audioStart, audioEnd),
    durationSec: (frameCount * samplesPerFrame) / sampleRate,
    frameCount,
    version,
    sampleRate,
    channels,
    samplesPerFrame,
    sampleHeader,
  };
}

function buildSilentFrames(stream: ParsedMp3Stream, targetPauseSec: number): {
  bytes: Uint8Array;
  durationSec: number;
} {
  if (targetPauseSec <= 0) {
    return { bytes: new Uint8Array(0), durationSec: 0 };
  }
  // Construct a clean no-CRC, zero-padding silent MP3 frame matching the stream format.
  const headerBytes = new Uint8Array(stream.sampleHeader);
  headerBytes[1] = (headerBytes[1] & 0xfe) | 0x01; // protection_bit = 1 (no CRC)
  headerBytes[2] = headerBytes[2] & 0xfd; // padding_bit = 0
  const parsed = parseFrameHeader(
    new Uint8Array([...headerBytes, ...new Uint8Array(2048)]),
    0,
  );
  if (!parsed) {
    return { bytes: new Uint8Array(0), durationSec: 0 };
  }
  const frameDurationSec = parsed.samplesPerFrame / parsed.sampleRate;
  const count = Math.max(0, Math.round(targetPauseSec / frameDurationSec));
  if (count === 0) {
    return { bytes: new Uint8Array(0), durationSec: 0 };
  }
  const out = new Uint8Array(count * parsed.frameLength);
  for (let i = 0; i < count; i += 1) {
    out.set(headerBytes, i * parsed.frameLength);
  }
  return {
    bytes: out,
    durationSec: count * frameDurationSec,
  };
}

export type CombinedMp3Result = {
  bytes: Uint8Array;
  introDurationSec: number;
  totalDurationSec: number;
};

/**
 * Concatenates a spoken next-book announcement MP3 and the next book's MP3 into
 * one continuous, gapless MP3 stream so mobile PWAs play seamlessly across the
 * prompt and into page 1 with zero `audio.src` swap and zero background network load.
 */
export function concatenateMp3WithPause(
  introBytes: Uint8Array,
  bookBytes: Uint8Array,
  pauseSec = 0.35,
): CombinedMp3Result | null {
  const intro = parseMp3Stream(introBytes);
  const book = parseMp3Stream(bookBytes);
  if (!intro || !book) return null;

  // Only concatenate streams with matching MPEG version, sample rate, and channel count.
  if (
    intro.version !== book.version ||
    intro.sampleRate !== book.sampleRate ||
    intro.channels !== book.channels
  ) {
    return null;
  }

  const pause = buildSilentFrames(book, pauseSec);
  const totalBytes =
    intro.audioBytes.length + pause.bytes.length + book.audioBytes.length;
  const combined = new Uint8Array(totalBytes);
  combined.set(intro.audioBytes, 0);
  combined.set(pause.bytes, intro.audioBytes.length);
  combined.set(book.audioBytes, intro.audioBytes.length + pause.bytes.length);

  const introDurationSec = intro.durationSec + pause.durationSec;
  return {
    bytes: combined,
    introDurationSec,
    totalDurationSec: introDurationSec + book.durationSec,
  };
}
