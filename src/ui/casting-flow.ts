import { isYaoValue, type CoinThrow, type YaoValue } from '../domain/liuyao/types';

export const CAST_POSITION_LABELS = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'] as const;

export interface YaoPresentation {
  value: YaoValue;
  name: '老阴' | '少阳' | '少阴' | '老阳';
  symbol: '━━  ━━' | '━━━━━━';
  changing: boolean;
  coins: CoinThrow['coins'];
}

const PRESENTATIONS: Record<YaoValue, YaoPresentation> = {
  6: { value: 6, name: '老阴', symbol: '━━  ━━', changing: true, coins: [2, 2, 2] },
  7: { value: 7, name: '少阳', symbol: '━━━━━━', changing: false, coins: [3, 2, 2] },
  8: { value: 8, name: '少阴', symbol: '━━  ━━', changing: false, coins: [3, 3, 2] },
  9: { value: 9, name: '老阳', symbol: '━━━━━━', changing: true, coins: [3, 3, 3] },
};

export function yaoPresentation(value: number): YaoPresentation {
  if (!isYaoValue(value)) throw new Error(`无效爻值：${String(value)}`);
  return PRESENTATIONS[value];
}

export function appendManualYao(values: readonly YaoValue[], value: number): YaoValue[] {
  if (values.length >= 6) throw new Error('六爻已经完成，请先重新起卦。');
  return [...values, yaoPresentation(value).value];
}

export function advanceAutoReveal(revealedCount: number): number {
  if (!Number.isInteger(revealedCount) || revealedCount < 0 || revealedCount > 6) {
    throw new Error('自动起卦进度无效。');
  }
  if (revealedCount === 6) throw new Error('六爻已经完成，请先重新起卦。');
  return revealedCount + 1;
}

export function nextCastLabel(revealedCount: number): string {
  if (!Number.isInteger(revealedCount) || revealedCount < 0 || revealedCount > 6) {
    throw new Error('起卦进度无效。');
  }
  return revealedCount === 6
    ? '六爻已成'
    : `准备${revealedCount === 0 ? '记录' : '起'}${CAST_POSITION_LABELS[revealedCount]}`;
}

export function coinFaceLabel(value: 2 | 3): '阴' | '阳' {
  return value === 3 ? '阳' : '阴';
}
