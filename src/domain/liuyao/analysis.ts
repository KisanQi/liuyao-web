import {
  analyzeLiuyaoEvidence,
  type LiuyaoEvidenceAnalysis,
} from 'mingyu-core/divination/liuyao';
import {
  isQuestionTopic,
  isSixRelative,
  type AnalysisCandidate,
  type AnalysisFact,
  type AnalysisReference,
  type LiuyaoAnalysis,
  type QuestionAssessment,
  type QuestionContext,
} from './types';

type CoreLiuyaoData = Parameters<typeof analyzeLiuyaoEvidence>[0];
type UpstreamCandidate = LiuyaoEvidenceAnalysis['candidates'][number];
type UpstreamReference = UpstreamCandidate['references'][number];

const DEFAULT_QUESTION: QuestionContext = {
  text: '未填写具体问题',
  topic: 'general',
};

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function normalizeQuestionContext(
  context?: Partial<QuestionContext>,
): QuestionContext {
  const text = context?.text?.trim() || DEFAULT_QUESTION.text;
  const topic = context?.topic && isQuestionTopic(context.topic)
    ? context.topic
    : DEFAULT_QUESTION.topic;
  const topicSource = context?.topicSource;
  const topicReason = context?.topicReason?.trim() || undefined;
  const timeframe = context?.timeframe?.trim() || undefined;
  const background = context?.background?.trim() || undefined;
  const usefulGodRelative = context?.usefulGodRelative && isSixRelative(context.usefulGodRelative)
    ? context.usefulGodRelative
    : undefined;

  return {
    text,
    topic,
    ...(topicSource ? { topicSource } : {}),
    ...(topicReason ? { topicReason } : {}),
    ...(timeframe ? { timeframe } : {}),
    ...(background ? { background } : {}),
    ...(usefulGodRelative ? { usefulGodRelative } : {}),
  };
}

export function assessQuestionContext(
  context?: Partial<QuestionContext>,
): { question: QuestionContext; assessment: QuestionAssessment } {
  const question = normalizeQuestionContext(context);
  const hasQuestion = Boolean(
    context?.text?.trim() && context.text.replace(/\s+/gu, '').length >= 4,
  );
  const hasTimeframe = Boolean(question.timeframe);
  const issues = [
    !hasQuestion ? '缺少能够明确对象与事件的具体问题' : '',
    !hasTimeframe ? '缺少现实期限，不能把触发条件收束到日期范围' : '',
  ].filter(Boolean);
  const status: QuestionAssessment['status'] = !hasQuestion && !hasTimeframe
    ? '缺少具体问题和现实期限'
    : !hasQuestion
      ? '缺少具体问题'
      : !hasTimeframe
        ? '缺少现实期限'
        : '完整';

  return {
    question,
    assessment: {
      status,
      canAnalyze: hasQuestion,
      issues,
    },
  };
}

function referenceFactKey(
  reference: UpstreamReference,
  analysis: LiuyaoEvidenceAnalysis,
): string {
  if (reference.source === '本卦') {
    return analysis.lineFacts.find((fact) => fact.position === reference.position)?.key ?? reference.key;
  }
  return analysis.hiddenSpiritFacts.find(
    (fact) =>
      fact.position === reference.position &&
      fact.sixRelative === reference.sixRelative &&
      fact.najia.branch === reference.branch,
  )?.key ?? reference.key;
}

function mapReference(
  reference: UpstreamReference,
  analysis: LiuyaoEvidenceAnalysis,
): AnalysisReference {
  return {
    key: reference.key,
    factKey: referenceFactKey(reference, analysis),
    source: reference.source,
    position: reference.position,
    sixRelative: reference.sixRelative,
    branch: reference.branch,
    element: reference.wuxing,
    role: reference.isWorld ? '世' : reference.isResponse ? '应' : null,
    isChanging: Boolean(reference.isChanging),
    isVoid: reference.isVoid,
    support: [...reference.support],
    constraints: [...reference.constraints],
  };
}

function mapCandidate(
  candidate: UpstreamCandidate,
  analysis: LiuyaoEvidenceAnalysis,
): AnalysisCandidate {
  const references = candidate.references.map((reference) => mapReference(reference, analysis));
  return {
    key: candidate.key,
    label: candidate.label,
    relative: candidate.relative,
    sourceStatus: candidate.sourceStatus,
    status: candidate.status,
    reason: candidate.reason,
    references,
    referenceKeys: [...candidate.referenceKeys],
    ownerFactKeys: unique(references.map((reference) => reference.factKey)),
    support: [...candidate.support],
    constraints: [...candidate.constraints],
    promptText: candidate.promptText,
    sources: [...candidate.sources],
    limitation: candidate.limitation,
  };
}

function mapFact(
  fact: { key: string; promptText: string; sources: string[]; limitation: string },
  type: string,
  details: Partial<Pick<AnalysisFact, 'ownerFactKeys' | 'referenceKeys' | 'ownerCandidateKey' | 'sourceStatus'>> = {},
): AnalysisFact {
  return {
    key: fact.key,
    type,
    text: fact.promptText,
    sources: [...fact.sources],
    limitation: fact.limitation,
    ownerFactKeys: [...(details.ownerFactKeys ?? [])],
    referenceKeys: [...(details.referenceKeys ?? [])],
    ...(details.ownerCandidateKey ? { ownerCandidateKey: details.ownerCandidateKey } : {}),
    ...(details.sourceStatus ? { sourceStatus: details.sourceStatus } : {}),
  };
}

function evidenceState(candidates: readonly AnalysisCandidate[]): LiuyaoAnalysis['overview']['state'] {
  const support = unique(candidates.flatMap((candidate) => candidate.support));
  const constraints = unique(candidates.flatMap((candidate) => candidate.constraints));
  return support.length && constraints.length
    ? '支持与限制并见'
    : constraints.length
      ? '限制条件较集中'
      : support.length
        ? '支持条件较集中'
        : '盘面信号暂不集中';
}

function timingForFocus(
  analysis: LiuyaoEvidenceAnalysis,
  timingFacts: readonly AnalysisFact[],
  focusCandidates: readonly AnalysisCandidate[],
): AnalysisFact[] {
  const ownerFactKeys = new Set(focusCandidates.flatMap((candidate) => candidate.ownerFactKeys));
  const relatives = new Set(
    focusCandidates
      .map((candidate) => candidate.relative)
      .filter((relative): relative is string => Boolean(relative)),
  );
  const lineFacts = new Map(analysis.lineFacts.map((fact) => [fact.key, fact]));

  return timingFacts.filter((fact) => {
    if (fact.type === '期限边界') return false;
    if (fact.ownerFactKeys.some((key) => ownerFactKeys.has(key))) return true;
    return fact.ownerFactKeys.some((key) => {
      const changedRelative = lineFacts.get(key)?.changedYao?.sixRelative;
      return Boolean(changedRelative && relatives.has(changedRelative));
    });
  });
}

function candidateAxis(candidate: AnalysisCandidate): string {
  const references = candidate.references
    .map((reference) => `${reference.source}${reference.position}爻${reference.sixRelative}${reference.branch}${reference.element}`)
    .join('、') || '盘中未匹配';
  const support = candidate.support.join('、') || '未见额外增强';
  const constraints = candidate.constraints.join('、') || '未见明确空破墓退限制';
  return `${candidate.label}（${references}）：支持${support}；限制${constraints}`;
}

function overview(
  analysis: LiuyaoEvidenceAnalysis,
  question: QuestionContext,
  assessment: QuestionAssessment,
  selectedCandidate: AnalysisCandidate | null,
  focusCandidates: AnalysisCandidate[],
  timingFacts: AnalysisFact[],
): LiuyaoAnalysis['overview'] {
  if (!assessment.canAnalyze) {
    return {
      state: '资料不足',
      headline: '排盘已经完成，但问事资料不足，暂不选定用神候选。',
      rationale: assessment.issues.join('；'),
      nextCheck: '先补齐具体问题；至少写清对象、事件和希望核验的结果。',
    };
  }
  if (!focusCandidates.length) {
    return {
      state: '资料不足',
      headline: '当前没有找到可稳定承载问题的用神候选。',
      rationale: '应先检查问题对象、求测者角色和所问结果，不在资料不足时强行下结论。',
      nextCheck: '补齐问题语义或由熟悉口径的人明确指定用神六亲。',
    };
  }

  const relevantTiming = timingForFocus(analysis, timingFacts, focusCandidates)
    .slice(0, 2)
    .map((fact) => fact.text)
    .join('；');
  const timeframe = question.timeframe
    ? `在“${question.timeframe}”范围内，`
    : '尚未提供现实期限；';
  const nextCheck = relevantTiming
    ? `${timeframe}优先观察并核验这些与当前分析轴直接关联的触发条件：${relevantTiming}`
    : `${timeframe}先以现实进展验证支持与限制条件，不把当前盘面直接换算成唯一日期或成功率。`;

  if (question.topic === 'ganqing' && focusCandidates.length >= 2) {
    return {
      state: evidenceState(focusCandidates),
      headline: `关系主题采用世应双轴，同时观察“${focusCandidates[0]?.label}”与“${focusCandidates[1]?.label}”。`,
      rationale: focusCandidates.map(candidateAxis).join('；'),
      nextCheck,
    };
  }

  const selected = selectedCandidate ?? focusCandidates[0];
  if (!selected) {
    return {
      state: '资料不足',
      headline: '当前没有选定可用候选。',
      rationale: '候选存在，但没有满足当前问题口径的主候选。',
      nextCheck: '核对所问对象与用神口径。',
    };
  }
  const references = selected.references
    .map((reference) => `${reference.source}${reference.position}爻${reference.sixRelative}${reference.branch}${reference.element}`)
    .join('、');
  const rationale = [
    selected.support.length ? `支持条件：${unique(selected.support).join('、')}` : '未见额外增强条件',
    selected.constraints.length ? `限制条件：${unique(selected.constraints).join('、')}` : '未见明确空破墓退限制',
  ].join('；');

  return {
    state: evidenceState([selected]),
    headline: `当前以“${selected.label}”为主候选${references ? `，盘中匹配${references}` : ''}。`,
    rationale,
    nextCheck,
  };
}

export function buildLiuyaoAnalysis(
  data: CoreLiuyaoData,
  context?: Partial<QuestionContext>,
): { question: QuestionContext; analysis: LiuyaoAnalysis; upstream: LiuyaoEvidenceAnalysis } {
  const { question, assessment } = assessQuestionContext(context);
  const upstream = analyzeLiuyaoEvidence(data, {
    topic: question.topic,
    usefulGodRelative: question.usefulGodRelative,
  });
  const candidates = upstream.candidates.map((candidate) => mapCandidate(candidate, upstream));
  const upstreamSelected = upstream.selectedCandidate
    ? candidates.find((candidate) => candidate.key === upstream.selectedCandidate?.key) ?? null
    : null;
  const relationshipFocus = question.topic === 'ganqing'
    ? candidates.filter((candidate) => candidate.status === '已匹配').slice(0, 2)
    : [];
  const selectedCandidate = assessment.canAnalyze && question.topic !== 'ganqing'
    ? upstreamSelected
    : null;
  const focusCandidates = assessment.canAnalyze
    ? question.topic === 'ganqing'
      ? relationshipFocus
      : selectedCandidate
        ? [selectedCandidate]
        : []
    : [];
  const timingFacts = upstream.timingFacts.map((fact) => ({
    ...mapFact(fact, fact.type, {
      ownerFactKeys: fact.ownerFactKeys,
      sourceStatus: fact.sourceStatus,
    }),
    text: fact.type === '期限边界' && question.timeframe
      ? `现实期限已记录为“${question.timeframe}”；盘内触发条件只用于该范围内复核，不机械换算唯一日期`
      : fact.promptText,
  }));
  const evidenceStatus = !assessment.canAnalyze
    ? '问事资料不足'
    : assessment.status === '缺少现实期限'
      ? `${upstream.summaryFact.status}（缺少现实期限）`
      : upstream.summaryFact.status;

  return {
    question,
    upstream,
    analysis: {
      questionAssessment: assessment,
      chartEvidenceStatus: upstream.summaryFact.status,
      evidenceStatus,
      overview: overview(
        upstream,
        question,
        assessment,
        selectedCandidate,
        focusCandidates,
        timingFacts,
      ),
      selectedCandidate,
      focusCandidates,
      candidates,
      godChain: assessment.canAnalyze && question.topic !== 'ganqing'
        ? upstream.godChain.map((item) => {
            const references = item.references.map((reference) => mapReference(reference, upstream));
            return {
              key: item.key,
              role: item.role,
              element: item.wuxing,
              relation: item.relation,
              status: item.status,
              positions: unique(references.map((reference) => String(reference.position))).map(Number),
              references,
              referenceKeys: [...item.referenceKeys],
              sources: [...item.sources],
              limitation: item.limitation,
            };
          })
        : [],
      lineFacts: upstream.lineFacts.map((fact) => mapFact(fact, '逐爻事实')),
      hiddenSpiritFacts: upstream.hiddenSpiritFacts.map((fact) => mapFact(fact, '伏神事实')),
      structureFacts: upstream.structureFacts.map((fact) => mapFact(fact, fact.kind)),
      counterEvidence: assessment.canAnalyze
        ? upstream.counterEvidenceFacts.map((fact) => mapFact(fact, '反证', {
            ownerCandidateKey: fact.ownerCandidateKey,
            referenceKeys: fact.referenceKeys,
          }))
        : [],
      timingFacts,
      steps: upstream.calculationSteps.map((step) => ({
        key: step.key,
        stage: step.stage,
        status: step.status,
        text: step.promptText,
        dependsOn: [...step.dependsOnStepKeys],
        sources: [...step.sources],
        limitation: step.limitation,
      })),
      limitations: [...upstream.limitations],
      limitationFacts: upstream.limitationFacts.map((fact) => mapFact(fact, fact.type, {
        ownerFactKeys: fact.ownerFactKeys,
      })),
    },
  };
}
