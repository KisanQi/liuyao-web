import { isYaoValue, type YaoValue } from './types';

export function parseYaoInput(input: string): YaoValue[] {
  const tokens = input
    .trim()
    .split(/[\s,，、]+/u)
    .filter(Boolean);

  if (tokens.length !== 6) {
    throw new Error(`需要恰好六个爻值，当前得到 ${tokens.length} 个。`);
  }

  const values = tokens.map(Number);
  const invalid = values.find((value) => !isYaoValue(value));
  if (invalid !== undefined) {
    throw new Error(`爻值只能是 6、7、8、9；检测到 ${String(invalid)}。`);
  }

  return values as YaoValue[];
}

export function formatYaoInput(values: readonly YaoValue[]): string {
  return values.join(',');
}

