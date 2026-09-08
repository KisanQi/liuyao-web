const HASH_SEEDS = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35] as const;

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    const entries = Object.keys(object)
      .filter((key) => object[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`);
    return `{${entries.join(',')}}`;
  }
  throw new Error(`审计输入包含不支持的类型：${typeof value}`);
}

function fnv1a32(bytes: Uint8Array, seed: number): string {
  let hash = seed >>> 0;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function applicationInputHash(payload: unknown): string {
  const bytes = new TextEncoder().encode(canonicalJson(payload));
  return HASH_SEEDS.map((seed) => fnv1a32(bytes, seed)).join('');
}

export function applicationResultId(inputHash: string): string {
  return `liuyao-app:${inputHash}`;
}
