import { describe, expect, test } from 'vitest';
import {
  advanceAutoReveal,
  appendManualYao,
  coinFaceLabel,
  nextCastLabel,
  yaoPresentation,
} from '../src/ui/casting-flow';

describe('逐爻起卦状态机', () => {
  test('按初爻到上爻累计且第六爻后封口', () => {
    let values = appendManualYao([], 7);
    values = appendManualYao(values, 8);
    values = appendManualYao(values, 9);
    values = appendManualYao(values, 6);
    values = appendManualYao(values, 7);
    values = appendManualYao(values, 8);
    expect(values).toEqual([7, 8, 9, 6, 7, 8]);
    expect(() => appendManualYao(values, 7)).toThrow('六爻已经完成');
  });

  test('三钱和值与老少阴阳映射一致', () => {
    expect(yaoPresentation(6)).toMatchObject({ name: '老阴', changing: true, coins: [2, 2, 2] });
    expect(yaoPresentation(7)).toMatchObject({ name: '少阳', changing: false, coins: [3, 2, 2] });
    expect(yaoPresentation(8)).toMatchObject({ name: '少阴', changing: false, coins: [3, 3, 2] });
    expect(yaoPresentation(9)).toMatchObject({ name: '老阳', changing: true, coins: [3, 3, 3] });
    expect(coinFaceLabel(2)).toBe('阴');
    expect(coinFaceLabel(3)).toBe('阳');
  });

  test('进度文案始终指向下一爻', () => {
    expect(nextCastLabel(0)).toBe('准备记录初爻');
    expect(nextCastLabel(1)).toBe('准备起二爻');
    expect(nextCastLabel(5)).toBe('准备起上爻');
    expect(nextCastLabel(6)).toBe('六爻已成');
  });

  test('自动起卦每次点击只推进一爻且必须点击六次', () => {
    let revealed = 0;
    for (let click = 1; click <= 6; click += 1) {
      revealed = advanceAutoReveal(revealed);
      expect(revealed).toBe(click);
    }
    expect(() => advanceAutoReveal(revealed)).toThrow('六爻已经完成');
  });
});
