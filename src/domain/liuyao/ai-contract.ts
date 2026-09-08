import { containsInternalLiuyaoLanguage } from './public-language';

export type EvidenceStrength = '强' | '中' | '弱';

export interface AiInterpretation {
  directAnswer: string;
  tendencyLabel: string;
  evidenceStrength: EvidenceStrength;
  keyReasons: string[];
  mainUncertainty: string;
  realityChecks: string[];
  professionalBasis: string;
  boundary: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requiredText(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('AI 服务返回了无效结果。');
  }
  return value.trim();
}

function shortTextList(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  if (!Array.isArray(value) || value.length < 1 || value.length > 5) {
    throw new Error('AI 服务返回了无效结果。');
  }
  const items = value.map((item) => (typeof item === 'string' ? item.trim() : ''));
  if (items.some((item) => !item)) {
    throw new Error('AI 服务返回了无效结果。');
  }
  return items;
}

export function parseAiInterpretation(value: unknown): AiInterpretation {
  if (!isRecord(value)) throw new Error('AI 服务返回了无效结果。');
  const evidenceStrength = requiredText(value, 'evidenceStrength');
  if (!['强', '中', '弱'].includes(evidenceStrength)) {
    throw new Error('AI 服务返回了无效结果。');
  }
  const interpretation = {
    directAnswer: requiredText(value, 'directAnswer'),
    tendencyLabel: requiredText(value, 'tendencyLabel'),
    evidenceStrength: evidenceStrength as EvidenceStrength,
    keyReasons: shortTextList(value, 'keyReasons'),
    mainUncertainty: requiredText(value, 'mainUncertainty'),
    realityChecks: shortTextList(value, 'realityChecks'),
    professionalBasis: requiredText(value, 'professionalBasis'),
    boundary: requiredText(value, 'boundary'),
  };
  const publicTexts = [
    interpretation.tendencyLabel,
    interpretation.directAnswer,
    ...interpretation.keyReasons,
    interpretation.mainUncertainty,
    ...interpretation.realityChecks,
  ];
  if (publicTexts.some(containsInternalLiuyaoLanguage)) {
    throw new Error('AI 服务返回了包含内部术语的用户文案。');
  }
  return interpretation;
}
