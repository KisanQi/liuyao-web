import { describe, expect, test } from 'vitest';
import { configure as configureMingyuCore } from 'mingyu-core/calendar';
import aiEvidenceSchema from '../docs/ai-evidence-view.schema.json';
import { buildAiEvidenceView } from '../src/domain/liuyao/ai-evidence';
import { castCoins, castManual } from '../src/domain/liuyao/engine';
import { parseYaoInput } from '../src/domain/liuyao/parse';
import { inferQuestionTopic } from '../src/domain/liuyao/question-intent';
import {
  RULESET_VERSION,
  SCHEMA_VERSION,
  type QuestionContext,
  type YaoValue,
} from '../src/domain/liuyao/types';

const FIXED_DATE = new Date('2025-01-01T08:00:00+08:00');
const CAREER_QUESTION: QuestionContext = {
  text: '这份工作邀约会在本月底前落实吗？',
  topic: 'shiye',
  timeframe: '本月底前',
  background: '已经口头确认，仍在等待书面审批。',
};

describe('六爻输入契约', () => {
  test('支持中英文分隔符并保持初爻到上爻顺序', () => {
    expect(parseYaoInput('7，8、9 6,7,8')).toEqual([7, 8, 9, 6, 7, 8]);
  });

  test('拒绝长度和取值不合法的输入', () => {
    expect(() => parseYaoInput('7,8,9')).toThrow('六个爻值');
    expect(() => parseYaoInput('7,8,5,6,7,8')).toThrow('只能是 6、7、8、9');
  });
});

describe('确定性排盘', () => {
  test('黄金样例：既济变随，三四爻动，世三应六', () => {
    const reading = castManual([7, 8, 9, 6, 7, 8], FIXED_DATE);

    expect(reading.chart.original).toBe('水火既济');
    expect(reading.chart.changed).toBe('泽雷随');
    expect(reading.chart.movingPositions).toEqual([3, 4]);
    expect(reading.chart.palace).toBe('坎');
    expect(reading.lines.filter((line) => line.role === '世').map((line) => line.position)).toEqual([3]);
    expect(reading.lines.filter((line) => line.role === '应').map((line) => line.position)).toEqual([6]);
    expect(reading.lines.map((line) => line.branch)).toEqual(['卯', '丑', '亥', '申', '戌', '子']);
    expect(reading.lines.map((line) => `${line.stem}${line.branch}`)).toEqual([
      '己卯', '己丑', '己亥', '戊申', '戊戌', '戊子',
    ]);
    expect(reading.lines[2]?.changed).toEqual(expect.objectContaining({ stem: '庚', branch: '辰' }));
    expect(reading.lines[3]?.changed).toEqual(expect.objectContaining({ stem: '丁', branch: '亥' }));
    expect(reading.lines.map((line) => line.sixRelative)).toEqual([
      '子孙',
      '官鬼',
      '兄弟',
      '父母',
      '官鬼',
      '兄弟',
    ]);
    expect(reading.hiddenSpirits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          position: 3,
          sixRelative: '妻财',
          stem: '戊',
          branch: '午',
          element: '火',
        }),
      ]),
    );
  });

  test('64 种静卦输入必须得到 64 个不同本卦', () => {
    const names = new Set<string>();
    for (let mask = 0; mask < 64; mask += 1) {
      const values = Array.from({ length: 6 }, (_, index) =>
        ((mask >> index) & 1) === 1 ? 7 : 8,
      ) as YaoValue[];
      names.add(castManual(values, FIXED_DATE).chart.original);
    }
    expect(names.size).toBe(64);
  });

  test('静卦不伪造变卦，并记录稳定协议和规则版本', () => {
    const reading = castManual([7, 7, 7, 7, 7, 7], FIXED_DATE, CAREER_QUESTION);

    expect(reading.schemaVersion).toBe(SCHEMA_VERSION);
    expect(reading.rulesetVersion).toBe(RULESET_VERSION);
    expect(reading.chart.movingPositions).toEqual([]);
    expect(reading.chart.changed).toBeNull();
    expect(reading.lines.map((line) => line.stem)).toEqual(['甲', '甲', '甲', '壬', '壬', '壬']);
    expect(reading.input.question).toEqual(CAREER_QUESTION);
    expect(reading.timing).toEqual(
      expect.objectContaining({
        timeZone: 'Asia/Shanghai',
        utcOffset: '+08:00',
        civilTime: '2025-01-01 08:00:00',
        dayBoundary: '23:00',
      }),
    );
  });

  test('北京时间 23:00 换日，并保持同一子时', () => {
    const before = castManual([7, 7, 7, 7, 7, 7], new Date('2025-01-01T22:59:00+08:00'));
    const after = castManual([7, 7, 7, 7, 7, 7], new Date('2025-01-01T23:00:00+08:00'));

    expect(before.timing.day).toBe('庚午');
    expect(before.timing.hour).toBe('丁亥');
    expect(after.timing.day).toBe('辛未');
    expect(after.timing.hour).toBe('戊子');
  });

  test('每次计算都重新锁定 UTC+8，不受上游全局配置污染', () => {
    configureMingyuCore({ timezoneOffset: 0 });
    const reading = castManual([7, 7, 7, 7, 7, 7], FIXED_DATE, CAREER_QUESTION);

    expect(reading.timing.civilTime).toBe('2025-01-01 08:00:00');
    expect(reading.timing.day).toBe('庚午');
    expect(reading.timing.hour).toBe('庚辰');
  });

  test('历史日期也统一按固定 UTC+8 显示，不混入 IANA 夏令时', () => {
    const reading = castManual(
      [7, 7, 7, 7, 7, 7],
      new Date('1991-07-01T12:00:00+08:00'),
      CAREER_QUESTION,
    );

    expect(reading.timing.civilTime).toBe('1991-07-01 12:00:00');
    expect(reading.timing.utcOffset).toBe('+08:00');
  });
});

describe('按问题取用与证据链', () => {
  test('自动主题只在语义单一时归类，跨主题时回退通用候选', () => {
    expect(inferQuestionTopic('这份工作邀约月底前能正式入职吗')).toEqual(
      expect.objectContaining({ topic: 'shiye', source: 'inferred' }),
    );
    expect(inferQuestionTopic('这笔项目回款月底能到账吗')).toEqual(
      expect.objectContaining({ topic: 'caifu', source: 'inferred' }),
    );
    expect(inferQuestionTopic('我和前任这个月能复合吗')).toEqual(
      expect.objectContaining({ topic: 'ganqing', source: 'inferred' }),
    );
    expect(inferQuestionTopic('下个月开学后的班级学习氛围怎么样')).toEqual(
      expect.objectContaining({ topic: 'general', source: 'fallback' }),
    );
    expect(inferQuestionTopic('这次工作变动会不会影响回款')).toEqual(
      expect.objectContaining({ topic: 'general', source: 'fallback' }),
    );
  });

  test('缺少具体问题时只完成排盘，不伪装成完整问事分析', () => {
    const reading = castManual([7, 8, 9, 6, 7, 8], FIXED_DATE);

    expect(reading.analysis.questionAssessment.canAnalyze).toBe(false);
    expect(reading.analysis.evidenceStatus).toBe('问事资料不足');
    expect(reading.analysis.selectedCandidate).toBeNull();
    expect(reading.analysis.focusCandidates).toEqual([]);
    expect(reading.analysis.overview.state).toBe('资料不足');
  });

  test('事业问题以官鬼为主候选，并同时保留支持和反证', () => {
    const reading = castManual([7, 8, 9, 6, 7, 8], FIXED_DATE, CAREER_QUESTION);
    const selected = reading.analysis.selectedCandidate;

    expect(reading.analysis.evidenceStatus).toBe('证据链完整');
    expect(selected?.label).toBe('事业用神');
    expect(selected?.relative).toBe('官鬼');
    expect(selected?.references.map((item) => item.position)).toEqual([2, 5]);
    expect(selected?.support).toContain('合月建');
    expect(selected?.constraints).toEqual(expect.arrayContaining(['月令囚', '本爻空亡']));
    expect(reading.analysis.overview.state).toBe('支持与限制并见');
    expect(reading.analysis.counterEvidence.length).toBeGreaterThan(0);
  });

  test('明确指定用神时覆盖主题默认，并能从伏神中取用', () => {
    const reading = castManual([7, 8, 9, 6, 7, 8], FIXED_DATE, {
      ...CAREER_QUESTION,
      usefulGodRelative: '妻财',
    });
    const selected = reading.analysis.selectedCandidate;

    expect(selected?.label).toBe('指定用神');
    expect(selected?.sourceStatus).toBe('用户指定');
    expect(selected?.references).toEqual([
      expect.objectContaining({ position: 3, sixRelative: '妻财', source: '伏神' }),
    ]);
  });

  test('感情主题优先比较世应双方，不按性别硬套妻财或官鬼', () => {
    const reading = castManual([7, 8, 9, 6, 7, 8], FIXED_DATE, {
      text: '我与对方在本月是否会恢复稳定沟通？',
      topic: 'ganqing',
      timeframe: '本月',
    });

    expect(reading.analysis.candidates.map((item) => item.label)).toEqual(['关系我方', '关系对方']);
    expect(reading.analysis.candidates[0]?.references[0]).toEqual(
      expect.objectContaining({ position: 3, role: '世' }),
    );
    expect(reading.analysis.candidates[1]?.references[0]).toEqual(
      expect.objectContaining({ position: 6, role: '应' }),
    );
    expect(reading.analysis.selectedCandidate).toBeNull();
    expect(reading.analysis.focusCandidates.map((item) => item.label)).toEqual(['关系我方', '关系对方']);
    expect(reading.analysis.overview.headline).toContain('世应双轴');
    expect(reading.analysis.overview.rationale).toContain('关系我方');
    expect(reading.analysis.overview.rationale).toContain('关系对方');
    expect(reading.analysis.godChain).toEqual([]);
  });

  test('应期按精确事实键关联，不把同爻位伏神误配给本爻候选', () => {
    const reading = castManual([7, 8, 7, 8, 7, 8], new Date('2025-01-07T08:00:00+08:00'), {
      text: '我在本月推进这件事会出现什么实际进展？',
      topic: 'general',
      timeframe: '本月',
    });
    const world = reading.analysis.focusCandidates[0];
    const hiddenTiming = reading.analysis.timingFacts.find((fact) => fact.type === '伏神透出');

    expect(world?.ownerFactKeys).toEqual(['本卦:第3爻']);
    expect(hiddenTiming?.ownerFactKeys).toEqual(['伏神:第3爻:妻财']);
    expect(reading.analysis.overview.nextCheck).not.toContain('伏神传统以透出');
  });

  test('应用级审计身份包含问题上下文，上游身份仍单独保留', () => {
    const career = castManual([7, 8, 9, 6, 7, 8], FIXED_DATE, CAREER_QUESTION);
    const finance = castManual([7, 8, 9, 6, 7, 8], FIXED_DATE, {
      text: '这笔项目回款会在本月底前到账吗？',
      topic: 'caifu',
      timeframe: '本月底前',
    });

    expect(career.audit.engineInputHash).toBe(finance.audit.engineInputHash);
    expect(career.audit.engineResultId).toBe(finance.audit.engineResultId);
    expect(career.audit.inputHash).not.toBe(finance.audit.inputHash);
    expect(career.audit.resultId).not.toBe(finance.audit.resultId);
    expect(career.audit.resultId).toBe(`liuyao-app:${career.audit.inputHash}`);
  });

  test('AI 只读证据包携带事实键、反证和禁止重算约束', () => {
    const reading = castManual([7, 8, 9, 6, 7, 8], FIXED_DATE, CAREER_QUESTION);
    const evidence = buildAiEvidenceView(reading);

    expect(aiEvidenceSchema.properties.schemaVersion.const).toBe(evidence.schemaVersion);
    expect(evidence.sourceCase.resultId).toBe(reading.audit.resultId);
    expect(evidence.facts.lineFacts).toHaveLength(6);
    expect(evidence.analysis.focusCandidates[0]?.ownerFactKeys.length).toBeGreaterThan(0);
    expect(evidence.analysis.counterEvidence[0]?.ownerCandidateKey).toBeTruthy();
    expect(evidence.analysis.timingFacts.some((fact) => fact.ownerFactKeys.length > 0)).toBe(true);
    expect(evidence.constraints).toEqual(expect.objectContaining({
      mustNotRecalculateChart: true,
      mustCiteFactKeys: true,
      mustPresentCounterEvidence: true,
    }));
  });

  test('摘要只给证据状态与现实核验点，不输出概率或必然断语', () => {
    const reading = castManual([7, 8, 9, 6, 7, 8], FIXED_DATE, CAREER_QUESTION);
    const overview = JSON.stringify(reading.analysis.overview);

    expect(overview).not.toMatch(/\d+(?:\.\d+)?%|百分之|必然|一定会|保证/);
    expect(reading.analysis.overview.nextCheck).toContain('观察');
    expect(reading.analysis.overview.nextCheck).toContain('官鬼');
    expect(reading.analysis.overview.nextCheck).toContain('空亡');
    expect(reading.analysis.timingFacts.at(-1)?.text).toContain('本月底前');
    expect(reading.analysis.timingFacts.at(-1)?.text).not.toContain('未给现实期限');
  });
});

describe('安全随机与重放', () => {
  test('种子起卦保存 18 个三钱样本，并可完整重放', () => {
    const first = castCoins({ seed: 'liuyao-regression' }, FIXED_DATE);
    const samples = first.audit.random?.samples;

    expect(first.audit.random?.mode).toBe('seeded');
    expect(samples).toHaveLength(18);
    expect(first.input.coinThrows).toHaveLength(6);

    const replayed = castCoins({ replay: samples }, FIXED_DATE);
    expect(replayed.audit.random?.mode).toBe('replay');
    expect(replayed.input.values).toEqual(first.input.values);
    expect(replayed.chart.original).toBe(first.chart.original);
    expect(replayed.chart.changed).toBe(first.chart.changed);
  });
});
