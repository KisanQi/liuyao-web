export const YAO_VALUES = [6, 7, 8, 9] as const;
export const SIX_RELATIVES = ['父母', '兄弟', '子孙', '妻财', '官鬼'] as const;
export const QUESTION_TOPICS = ['general', 'shiye', 'caifu', 'ganqing'] as const;
export const RULESET_VERSION = 'jingfang-zengshan-v1' as const;
export const SCHEMA_VERSION = '2.2' as const;

export type YaoValue = (typeof YAO_VALUES)[number];
export type SixRelative = (typeof SIX_RELATIVES)[number];
export type QuestionTopic = (typeof QUESTION_TOPICS)[number];
export type QuestionTopicSource = 'user' | 'inferred' | 'fallback';
export type CastMethod = 'manual' | 'coins';

export interface QuestionContext {
  text: string;
  topic: QuestionTopic;
  topicSource?: QuestionTopicSource;
  topicReason?: string;
  timeframe?: string;
  background?: string;
  usefulGodRelative?: SixRelative;
}

export interface QuestionAssessment {
  status: '完整' | '缺少具体问题' | '缺少现实期限' | '缺少具体问题和现实期限';
  canAnalyze: boolean;
  issues: string[];
}

export interface CoinThrow {
  coins: readonly (2 | 3)[];
  total: YaoValue;
}

export interface RandomAudit {
  mode: 'system' | 'seeded' | 'custom' | 'replay';
  seed?: string | number;
  samples: number[];
}

export interface HiddenSpirit {
  position: number;
  sixRelative: string;
  stem: string;
  branch: string;
  element: string;
  isVoid: boolean;
  coveringLine: {
    position: number;
    sixRelative: string;
    stem: string;
    branch: string;
    element: string;
  };
}

export interface ChangedLine {
  stem: string;
  branch: string;
  element: string;
  sixRelative: string;
  isVoid: boolean;
  relations: string[];
  direction?: string;
}

export interface LiuyaoLine {
  position: number;
  value: YaoValue;
  yinYang: '阳' | '阴';
  isChanging: boolean;
  changeType: string;
  sixGod: string;
  sixRelative: string;
  stem: string;
  branch: string;
  element: string;
  role: '世' | '应' | null;
  isVoid: boolean;
  isDayClash: boolean;
  isHiddenMove: boolean;
  isDayBreak: boolean;
  isMonthBreak: boolean;
  seasonState?: string;
  twelveStage?: string;
  changed?: ChangedLine;
  hiddenSpirits: HiddenSpirit[];
}

export interface AnalysisReference {
  key: string;
  factKey: string;
  source: '本卦' | '伏神';
  position: number;
  sixRelative: string;
  branch: string;
  element: string;
  role: '世' | '应' | null;
  isChanging: boolean;
  isVoid: boolean;
  support: string[];
  constraints: string[];
}

export interface AnalysisCandidate {
  key: string;
  label: string;
  relative?: string;
  sourceStatus: string;
  status: string;
  reason: string;
  references: AnalysisReference[];
  referenceKeys: string[];
  ownerFactKeys: string[];
  support: string[];
  constraints: string[];
  promptText: string;
  sources: string[];
  limitation: string;
}

export interface GodChainItem {
  key: string;
  role: '用神' | '原神' | '忌神' | '仇神';
  element: string;
  relation: string;
  status: string;
  positions: number[];
  references: AnalysisReference[];
  referenceKeys: string[];
  sources: string[];
  limitation: string;
}

export interface AnalysisFact {
  key: string;
  type: string;
  text: string;
  sources: string[];
  limitation: string;
  ownerFactKeys: string[];
  referenceKeys: string[];
  ownerCandidateKey?: string;
  sourceStatus?: string;
}

export interface AnalysisStep {
  key: string;
  stage: string;
  status: string;
  text: string;
  dependsOn: string[];
  sources: string[];
  limitation: string;
}

export interface LiuyaoAnalysis {
  questionAssessment: QuestionAssessment;
  chartEvidenceStatus: string;
  evidenceStatus: string;
  overview: {
    state: '支持与限制并见' | '限制条件较集中' | '支持条件较集中' | '盘面信号暂不集中' | '资料不足';
    headline: string;
    rationale: string;
    nextCheck: string;
  };
  selectedCandidate: AnalysisCandidate | null;
  focusCandidates: AnalysisCandidate[];
  candidates: AnalysisCandidate[];
  godChain: GodChainItem[];
  lineFacts: AnalysisFact[];
  hiddenSpiritFacts: AnalysisFact[];
  structureFacts: AnalysisFact[];
  counterEvidence: AnalysisFact[];
  timingFacts: AnalysisFact[];
  steps: AnalysisStep[];
  limitations: string[];
  limitationFacts: AnalysisFact[];
}

export interface LiuyaoReading {
  schemaVersion: typeof SCHEMA_VERSION;
  rulesetVersion: typeof RULESET_VERSION;
  createdAt: string;
  input: {
    method: CastMethod;
    question: QuestionContext;
    values: YaoValue[];
    coinThrows: CoinThrow[];
  };
  chart: {
    original: string;
    changed: string | null;
    mutual: string;
    palace: string;
    palaceElement: string;
    palaceStage?: string;
    movingPositions: number[];
    voidBranches: string[];
    specialPattern?: string;
    relationLabels: string[];
  };
  timing: {
    year: string;
    month: string;
    day: string;
    hour: string;
    timeZone: 'Asia/Shanghai';
    utcOffset: '+08:00';
    civilTime: string;
    dayBoundary: '23:00';
  };
  lines: LiuyaoLine[];
  hiddenSpirits: HiddenSpirit[];
  analysis: LiuyaoAnalysis;
  audit: {
    engine: 'mingyu-core';
    engineVersion: string;
    engineSchemaVersion: string;
    resultId: string;
    inputHash: string;
    engineResultId: string;
    engineInputHash: string;
    hashAlgorithm: 'canonical-fnv1a-128-v1';
    random?: RandomAudit;
  };
}

export function isYaoValue(value: number): value is YaoValue {
  return YAO_VALUES.includes(value as YaoValue);
}

export function isQuestionTopic(value: string): value is QuestionTopic {
  return QUESTION_TOPICS.includes(value as QuestionTopic);
}

export function isSixRelative(value: string): value is SixRelative {
  return SIX_RELATIVES.includes(value as SixRelative);
}
