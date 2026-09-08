import {
  generateLiuyao,
  type LiuyaoGenerationOptions,
} from 'mingyu-core/divination/liuyao';
import { configure as configureMingyuCore } from 'mingyu-core/calendar';
import type { RandomOptions } from 'mingyu-core/random';
import { buildLiuyaoAnalysis } from './analysis';
import { applicationInputHash, applicationResultId } from './audit';
import { najiaStems, palacePureHexagramStems, stemAt, type HeavenlyStem } from './najia';
import {
  CALCULATION_OFFSET_MINUTES,
  CALCULATION_TIME_ZONE,
  CALCULATION_UTC_OFFSET,
  DAY_BOUNDARY,
  toEngineTime,
  type EngineTimeContext,
} from './time';
import {
  RULESET_VERSION,
  SCHEMA_VERSION,
  isYaoValue,
  type CoinThrow,
  type HiddenSpirit,
  type LiuyaoReading,
  type QuestionContext,
  type YaoValue,
} from './types';

export interface CoinCastOptions {
  seed?: string | number;
  replay?: readonly number[];
}

type CoreReading = ReturnType<typeof generateLiuyao>;

function generateWithFixedTimezone(
  date: Date,
  options: LiuyaoGenerationOptions,
): CoreReading {
  // 上游时区是进程级可变状态。每次同步计算前重新锁定，防止其他调用方
  // 改写 configure() 后，四柱与本项目声明的 UTC+8 口径脱节。
  configureMingyuCore({ timezoneOffset: CALCULATION_OFFSET_MINUTES });
  return generateLiuyao(date, options);
}

function requireYaoValue(value: number): YaoValue {
  if (!isYaoValue(value)) {
    throw new Error(`排盘引擎返回了无效爻值：${String(value)}`);
  }
  return value;
}

function normalizeHiddenSpirits(
  raw: CoreReading,
  originalStems: readonly HeavenlyStem[],
  palaceStems: readonly HeavenlyStem[],
): HiddenSpirit[] {
  return (raw.hiddenSpirits ?? []).map((spirit) => ({
    position: spirit.position,
    sixRelative: spirit.sixRelative,
    stem: stemAt(palaceStems, spirit.position),
    branch: spirit.najiaDizhi,
    element: spirit.wuxing,
    isVoid: spirit.isVoid,
    coveringLine: {
      position: spirit.underYao.position,
      sixRelative: spirit.underYao.sixRelative,
      stem: stemAt(originalStems, spirit.underYao.position),
      branch: spirit.underYao.najiaDizhi,
      element: spirit.underYao.wuxing,
    },
  }));
}

function requireSupportedMethod(raw: CoreReading): 'manual' | 'coins' {
  const method = raw.generation?.method;
  if (method !== 'manual' && method !== 'coins') {
    throw new Error(`当前项目不接受起卦方式：${String(method ?? '未记录')}`);
  }
  return method;
}

function toReading(
  raw: CoreReading,
  calculationTime: EngineTimeContext,
  context?: Partial<QuestionContext>,
): LiuyaoReading {
  const values = raw.yaoArray.map(requireYaoValue);
  const originalStems = najiaStems(values);
  const changedStems = najiaStems(values, true);
  const palaceStems = palacePureHexagramStems(raw.palace.name);
  const hiddenSpirits = normalizeHiddenSpirits(raw, originalStems, palaceStems);
  const coinThrows: CoinThrow[] = (raw.generation?.coinThrows ?? []).map((item) => ({
    coins: [...item.coins],
    total: requireYaoValue(item.total),
  }));
  const meta = raw.meta;
  const method = requireSupportedMethod(raw);
  const random = meta?.random
    ? {
        mode: meta.random.mode,
        seed: meta.random.seed,
        samples: [...meta.random.samples],
      }
    : undefined;
  const { question, analysis } = buildLiuyaoAnalysis(raw, context);
  const createdAt = calculationTime.instant.toISOString();
  const engineVersion = meta?.engineVersion ?? '0.1.32';
  const engineSchemaVersion = meta?.schemaVersion ?? 'unknown';
  const inputHash = applicationInputHash({
    schemaVersion: SCHEMA_VERSION,
    rulesetVersion: RULESET_VERSION,
    createdAt,
    input: {
      method,
      question,
      values,
      coinThrows,
    },
    engine: {
      name: 'mingyu-core',
      version: engineVersion,
      schemaVersion: engineSchemaVersion,
      inputHash: meta?.inputHash ?? '',
    },
  });

  return {
    schemaVersion: SCHEMA_VERSION,
    rulesetVersion: RULESET_VERSION,
    createdAt,
    input: {
      method,
      question,
      values,
      coinThrows,
    },
    chart: {
      original: raw.originalName,
      changed: raw.changingYaos.length ? (raw.changedName ?? raw.originalName) : null,
      mutual: raw.interName ?? raw.originalName,
      palace: raw.palace.name,
      palaceElement: raw.palace.wuxing,
      palaceStage: raw.palaceStage,
      movingPositions: raw.changingYaos.map((yao) => yao.position),
      voidBranches: [...raw.voidBranches],
      specialPattern: raw.specialPattern,
      relationLabels: [
        raw.hexagramRelations?.original,
        raw.hexagramRelations?.transition,
        ...(raw.fanfuRelations?.labels ?? []),
      ].filter((label): label is string => Boolean(label)),
    },
    timing: {
      ...raw.ganzhi,
      timeZone: CALCULATION_TIME_ZONE,
      utcOffset: CALCULATION_UTC_OFFSET,
      civilTime: calculationTime.civilTime,
      dayBoundary: DAY_BOUNDARY,
    },
    lines: raw.yaosDetail.map((line) => ({
      position: line.position,
      value: requireYaoValue(line.rawValue),
      yinYang: line.yaoType,
      isChanging: line.isChanging,
      changeType: line.changeType,
      sixGod: line.sixGod,
      sixRelative: line.sixRelative,
      stem: stemAt(originalStems, line.position),
      branch: line.najiaDizhi,
      element: line.wuxing,
      role: line.isWorld ? '世' : line.isResponse ? '应' : null,
      isVoid: line.isVoid,
      isDayClash: Boolean(line.isDayClash),
      isHiddenMove: Boolean(line.isHiddenMove),
      isDayBreak: Boolean(line.isDayBreak),
      isMonthBreak: Boolean(line.isMonthBreak),
      seasonState: line.seasonState,
      twelveStage: line.shiErGong,
      changed: line.changedYao
        ? {
            stem: stemAt(changedStems, line.position),
            branch: line.changedYao.dizhi,
            element: line.changedYao.wuxing,
            sixRelative: line.changedYao.liuqin,
            isVoid: line.changedYao.isVoid,
            relations: [...(line.changeRelations ?? [])],
            ...(line.changeDirection ? { direction: line.changeDirection } : {}),
          }
        : undefined,
      hiddenSpirits: hiddenSpirits.filter((spirit) => spirit.position === line.position),
    })),
    hiddenSpirits,
    analysis,
    audit: {
      engine: 'mingyu-core',
      engineVersion,
      engineSchemaVersion,
      resultId: applicationResultId(inputHash),
      inputHash,
      engineResultId: meta?.resultId ?? '',
      engineInputHash: meta?.inputHash ?? '',
      hashAlgorithm: 'canonical-fnv1a-128-v1',
      random,
    },
  };
}

export function castManual(
  values: readonly YaoValue[],
  date: Date = new Date(),
  context?: Partial<QuestionContext>,
): LiuyaoReading {
  if (values.length !== 6 || !values.every(isYaoValue)) {
    throw new Error('手工起卦必须提供六个有效爻值。');
  }
  const calculationTime = toEngineTime(date);
  return toReading(
    generateWithFixedTimezone(calculationTime.engineDate, { method: 'manual', yaos: values }),
    calculationTime,
    context,
  );
}

export function castCoins(
  options: CoinCastOptions = {},
  date: Date = new Date(),
  context?: Partial<QuestionContext>,
): LiuyaoReading {
  if (options.seed !== undefined && options.replay !== undefined) {
    throw new Error('随机种子与重放轨迹不能同时提供。');
  }

  const randomOptions: RandomOptions = options.replay
    ? { replay: options.replay }
    : options.seed !== undefined
      ? { seed: options.seed }
      : {};
  const generationOptions: LiuyaoGenerationOptions = {
    method: 'coins',
    ...randomOptions,
  };
  const calculationTime = toEngineTime(date);
  return toReading(
    generateWithFixedTimezone(calculationTime.engineDate, generationOptions),
    calculationTime,
    context,
  );
}
