import type { AiEvidenceView } from './ai-evidence';
import { parseAiInterpretation, type AiInterpretation } from './ai-contract';
import { containsInternalLiuyaoLanguage, stripEvidenceMarkers } from './public-language';

export interface AiInterpretationResponse {
  resultId: string;
  model: string;
  interpretation: AiInterpretation;
  usage?: Record<string, unknown>;
}

export interface AiFollowUpExchange {
  question: string;
  answer: string;
}

export interface AiFollowUpResponse {
  resultId: string;
  model: string;
  answer: string;
  usage?: Record<string, unknown>;
}

export interface AiRequestOptions {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parseAiInterpretationResponse(value: unknown): AiInterpretationResponse {
  if (!isRecord(value) || typeof value.resultId !== 'string' || typeof value.model !== 'string') {
    throw new Error('AI 服务返回了无效结果。');
  }
  return {
    resultId: value.resultId,
    model: value.model,
    interpretation: parseAiInterpretation(value.interpretation),
    ...(isRecord(value.usage) ? { usage: value.usage } : {}),
  };
}

export function parseAiFollowUpResponse(value: unknown): AiFollowUpResponse {
  if (
    !isRecord(value)
    || typeof value.resultId !== 'string'
    || typeof value.model !== 'string'
    || typeof value.answer !== 'string'
    || !value.answer.trim()
  ) {
    throw new Error('AI 服务返回了无效追问结果。');
  }
  const answer = stripEvidenceMarkers(value.answer);
  if (!answer || containsInternalLiuyaoLanguage(answer)) {
    throw new Error('AI 追问没有转换成易懂语言，请重试。');
  }
  return {
    resultId: value.resultId,
    model: value.model,
    answer,
    ...(isRecord(value.usage) ? { usage: value.usage } : {}),
  };
}

export async function requestAiInterpretation(
  evidence: AiEvidenceView,
  options: AiRequestOptions = {},
): Promise<AiInterpretationResponse> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher('/api/interpret', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ evidence }),
    signal: options.signal,
  });
  const payload = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    const message = isRecord(payload) && typeof payload.error === 'string'
      ? payload.error
      : 'AI 解读失败，请稍后重试。';
    throw new Error(message);
  }
  return parseAiInterpretationResponse(payload);
}

export async function requestAiFollowUp(
  evidence: AiEvidenceView,
  initialInterpretation: AiInterpretation,
  question: string,
  history: readonly AiFollowUpExchange[],
  options: AiRequestOptions = {},
): Promise<AiFollowUpResponse> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher('/api/interpret', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      evidence,
      followUp: { question, initialInterpretation, history },
    }),
    signal: options.signal,
  });
  const payload = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    const message = isRecord(payload) && typeof payload.error === 'string'
      ? payload.error
      : 'AI 追问失败，请稍后重试。';
    throw new Error(message);
  }
  return parseAiFollowUpResponse(payload);
}
