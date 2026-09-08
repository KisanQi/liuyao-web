import type { YaoValue } from './types';

export const HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
export type HeavenlyStem = (typeof HEAVENLY_STEMS)[number];

type TrigramName = '乾' | '兑' | '离' | '震' | '巽' | '坎' | '艮' | '坤';

const TRIGRAM_BY_BOTTOM_UP_BITS: Record<string, TrigramName> = {
  '111': '乾',
  '110': '兑',
  '101': '离',
  '100': '震',
  '011': '巽',
  '010': '坎',
  '001': '艮',
  '000': '坤',
};

const TRIGRAM_STEMS: Record<TrigramName, { inner: HeavenlyStem; outer: HeavenlyStem }> = {
  乾: { inner: '甲', outer: '壬' },
  兑: { inner: '丁', outer: '丁' },
  离: { inner: '己', outer: '己' },
  震: { inner: '庚', outer: '庚' },
  巽: { inner: '辛', outer: '辛' },
  坎: { inner: '戊', outer: '戊' },
  艮: { inner: '丙', outer: '丙' },
  坤: { inner: '乙', outer: '癸' },
};

function trigramName(bits: readonly boolean[]): TrigramName {
  const key = bits.map((yang) => (yang ? '1' : '0')).join('');
  const name = TRIGRAM_BY_BOTTOM_UP_BITS[key];
  if (!name) throw new Error(`无法识别经卦阴阳序列：${key}`);
  return name;
}

function isYang(value: YaoValue, changed: boolean): boolean {
  if (!changed) return value === 7 || value === 9;
  return value === 6 || value === 7;
}

export function najiaStems(
  values: readonly YaoValue[],
  changed = false,
): [HeavenlyStem, HeavenlyStem, HeavenlyStem, HeavenlyStem, HeavenlyStem, HeavenlyStem] {
  if (values.length !== 6) throw new Error('纳甲装干必须提供初爻至上爻共六个爻值。');
  const yang = values.map((value) => isYang(value, changed));
  const lower = trigramName(yang.slice(0, 3));
  const upper = trigramName(yang.slice(3, 6));
  const lowerStem = TRIGRAM_STEMS[lower].inner;
  const upperStem = TRIGRAM_STEMS[upper].outer;
  return [lowerStem, lowerStem, lowerStem, upperStem, upperStem, upperStem];
}

export function palacePureHexagramStems(
  palace: string,
): [HeavenlyStem, HeavenlyStem, HeavenlyStem, HeavenlyStem, HeavenlyStem, HeavenlyStem] {
  if (!(palace in TRIGRAM_STEMS)) throw new Error(`无法识别卦宫：${palace}`);
  const stems = TRIGRAM_STEMS[palace as TrigramName];
  return [stems.inner, stems.inner, stems.inner, stems.outer, stems.outer, stems.outer];
}

export function stemAt(stems: readonly HeavenlyStem[], position: number): HeavenlyStem {
  const stem = stems[position - 1];
  if (!stem) throw new Error(`无法取得第 ${position} 爻的纳甲天干。`);
  return stem;
}
