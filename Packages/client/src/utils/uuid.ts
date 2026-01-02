let nodeId: number[] | null = null;
let clockSequence: number | null = null;
let lastTimestamp = 0;

function getNodeId(): number[] {
  if (nodeId) {
    return nodeId;
  }

  // Generate a random node ID (6 bytes) since we can't access MAC address in browser
  // Set the multicast bit to indicate this is a random node ID (per RFC 4122)
  const id: number[] = [];
  for (let i = 0; i < 6; i++) {
    id[i] = Math.floor(Math.random() * 256);
  }
  id[0]! |= 0x01; // Set multicast bit
  nodeId = id;
  return nodeId;
}

function getClockSequence(): number {
  if (clockSequence !== null) {
    return clockSequence;
  }
  // Random 14-bit clock sequence
  clockSequence = Math.floor(Math.random() * 0x3fff);
  return clockSequence;
}

/**
 * Generate a UUID v1-like identifier using timestamp and node identifier.
 * Uses 100-nanosecond intervals since October 15, 1582 (UUID epoch).
 * Node ID is randomly generated (browser can't access MAC address).
 */
export function generateUUID(): string {
  // UUID epoch: October 15, 1582
  const UUID_EPOCH = Date.UTC(1582, 9, 15);

  // Get current timestamp in 100-nanosecond intervals since UUID epoch
  let timestamp = (Date.now() - UUID_EPOCH) * 10000;

  // Ensure timestamp is unique by incrementing if same as last
  if (timestamp <= lastTimestamp) {
    timestamp = lastTimestamp + 1;
  }
  lastTimestamp = timestamp;

  const node = getNodeId();
  const clockSeq = getClockSequence();

  // Extract timestamp parts
  const timeLow = timestamp & 0xffffffff;
  const timeMid = (timestamp / 0x100000000) & 0xffff;
  const timeHiAndVersion = ((timestamp / 0x1000000000000) & 0x0fff) | 0x1000; // Version 1

  // Clock sequence with variant
  const clockSeqHiAndReserved = ((clockSeq >> 8) & 0x3f) | 0x80; // Variant bits
  const clockSeqLow = clockSeq & 0xff;

  // Format as hex string
  const hex = (n: number, len: number) => n.toString(16).padStart(len, "0");

  return [
    hex(timeLow, 8),
    hex(timeMid, 4),
    hex(timeHiAndVersion, 4),
    hex(clockSeqHiAndReserved, 2) + hex(clockSeqLow, 2),
    node.map((b) => hex(b, 2)).join(""),
  ].join("-");
}
