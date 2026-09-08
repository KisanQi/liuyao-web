import { describe, expect, test } from 'vitest';
import { castManual } from '../src/domain/liuyao/engine';
import type { QuestionContext, YaoValue } from '../src/domain/liuyao/types';

const GENERAL_QUESTION: QuestionContext = {
  text: '这件事在本月会出现什么可核验的进展？',
  topic: 'general',
  timeframe: '本月',
};

function cast(values: readonly YaoValue[], iso = '2025-01-02T08:00:00+08:00') {
  return castManual(values, new Date(iso), GENERAL_QUESTION);
}

describe('jingfang-zengshan-v1 黄金规则', () => {
  test('乾静卦与坤用六分别保持静卦和全动特殊边界', () => {
    const qian = cast([7, 7, 7, 7, 7, 7]);
    const kun = cast([6, 6, 6, 6, 6, 6]);

    expect(qian.chart).toEqual(expect.objectContaining({
      original: '乾为天',
      changed: null,
      palace: '乾',
      palaceStage: '首卦',
      specialPattern: '静卦',
    }));
    expect(qian.lines.find((line) => line.role === '世')?.position).toBe(6);
    expect(qian.lines.find((line) => line.role === '应')?.position).toBe(3);
    expect(qian.lines.map((line) => line.stem)).toEqual(['甲', '甲', '甲', '壬', '壬', '壬']);
    expect(qian.hiddenSpirits).toEqual([]);

    expect(kun.chart.original).toBe('坤为地');
    expect(kun.chart.changed).toBe('乾为天');
    expect(kun.chart.specialPattern).toBe('坤卦用六');
    expect(kun.chart.movingPositions).toEqual([1, 2, 3, 4, 5, 6]);
    expect(kun.lines.map((line) => line.stem)).toEqual(['乙', '乙', '乙', '癸', '癸', '癸']);
    expect(kun.lines.map((line) => line.changed?.stem)).toEqual(['甲', '甲', '甲', '壬', '壬', '壬']);
  });

  test('游魂与归魂归宫及世应位置正确', () => {
    const youhun = cast([8, 8, 8, 7, 8, 7]);
    const guihun = cast([7, 7, 7, 7, 8, 7]);

    expect(youhun.chart).toEqual(expect.objectContaining({
      original: '火地晋', palace: '乾', palaceStage: '游魂', changed: null,
    }));
    expect(youhun.lines.find((line) => line.role === '世')?.position).toBe(4);
    expect(youhun.lines.find((line) => line.role === '应')?.position).toBe(1);

    expect(guihun.chart).toEqual(expect.objectContaining({
      original: '火天大有', palace: '乾', palaceStage: '归魂', changed: null,
    }));
    expect(guihun.lines.find((line) => line.role === '世')?.position).toBe(3);
    expect(guihun.lines.find((line) => line.role === '应')?.position).toBe(6);
  });

  test('伏神保留飞神结构，变爻六亲沿用主卦宫五行', () => {
    const staticJiji = cast([7, 8, 7, 8, 7, 8], '2025-01-07T08:00:00+08:00');
    const changingJiji = cast([7, 8, 9, 6, 7, 8], '2025-01-01T08:00:00+08:00');

    expect(staticJiji.hiddenSpirits).toEqual([
      expect.objectContaining({
        position: 3,
        sixRelative: '妻财',
        stem: '戊',
        branch: '午',
        element: '火',
        coveringLine: {
          position: 3,
          sixRelative: '兄弟',
          stem: '己',
          branch: '亥',
          element: '水',
        },
      }),
    ]);
    expect(changingJiji.lines[2]?.changed).toEqual(expect.objectContaining({
      branch: '辰', element: '土', sixRelative: '官鬼', relations: ['回头克'],
    }));
    expect(changingJiji.lines[3]?.changed).toEqual(expect.objectContaining({
      branch: '亥', element: '水', sixRelative: '兄弟',
    }));
  });

  test('旺相静爻日冲判暗动，休囚静爻日冲判日破', () => {
    const hiddenMove = cast([7, 7, 7, 7, 7, 7], '2025-01-01T08:00:00+08:00');
    const dayBreak = cast([7, 7, 7, 7, 7, 7], '2025-01-07T08:00:00+08:00');

    expect(hiddenMove.lines[0]).toEqual(expect.objectContaining({
      branch: '子', seasonState: '旺', isChanging: false, isHiddenMove: true, isDayBreak: false,
    }));
    expect(hiddenMove.chart.movingPositions).toEqual([]);
    expect(dayBreak.lines[3]).toEqual(expect.objectContaining({
      branch: '午', seasonState: '休', isChanging: false, isHiddenMove: false, isDayBreak: true,
    }));
  });

  test('小寒分钟边界切换月柱，并同步改变月破与暗动', () => {
    const before = cast([7, 7, 7, 7, 7, 7], '2025-01-05T10:32:00+08:00');
    const after = cast([7, 7, 7, 7, 7, 7], '2025-01-05T10:33:00+08:00');

    expect(before.timing).toEqual(expect.objectContaining({ month: '丙子', day: '甲戌', hour: '己巳' }));
    expect(after.timing).toEqual(expect.objectContaining({ month: '丁丑', day: '甲戌', hour: '己巳' }));
    expect(before.lines[3]).toEqual(expect.objectContaining({ branch: '午', isMonthBreak: true }));
    expect(after.lines[3]).toEqual(expect.objectContaining({ branch: '午', isMonthBreak: false }));
    expect(before.lines[2]).toEqual(expect.objectContaining({ isDayBreak: true, isHiddenMove: false }));
    expect(after.lines[2]).toEqual(expect.objectContaining({ isDayBreak: false, isHiddenMove: true }));
  });

  test('进退神和复合动变关系作为独立字段保存', () => {
    const advance = cast([7, 7, 6, 6, 6, 6], '2025-01-01T08:00:00+08:00');
    const retreat = cast([6, 9, 6, 6, 6, 6], '2025-01-01T08:00:00+08:00');
    const allMove = cast([6, 6, 6, 6, 6, 6], '2025-01-01T08:00:00+08:00');

    expect(advance.lines[2]?.changed).toEqual(expect.objectContaining({
      branch: '辰', direction: '化进神', relations: ['比和'],
    }));
    expect(retreat.lines[1]?.changed).toEqual(expect.objectContaining({
      branch: '丑', direction: '化退神', relations: ['比和'],
    }));
    expect(allMove.lines[5]?.changed?.relations).toEqual(['回头生', '化空']);
  });

  test('三合能力明确锁定为日辰与月建触发型结构', () => {
    const reading = cast([6, 6, 6, 6, 6, 6], '2025-01-01T08:00:00+08:00');
    const kinds = reading.analysis.structureFacts.map((fact) => fact.type);

    expect(kinds).toContain('日辰三合');
    expect(kinds).toContain('月建三合');
    expect(reading.analysis.structureFacts.find((fact) => fact.type === '日辰三合')?.text).toContain('火局');
    expect(reading.analysis.structureFacts.find((fact) => fact.type === '月建三合')?.text).toContain('水局');
  });
});
