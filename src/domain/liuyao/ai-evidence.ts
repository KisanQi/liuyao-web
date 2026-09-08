import type {
  AnalysisCandidate,
  AnalysisFact,
  HiddenSpirit,
  LiuyaoLine,
  LiuyaoReading,
  QuestionAssessment,
  QuestionContext,
} from './types';
import {
  PROFESSIONAL_RULEBOOK,
  PROFESSIONAL_RULEBOOK_VERSION,
  type ProfessionalRule,
} from './professional-rulebook';

export const AI_EVIDENCE_SCHEMA_VERSION = '1.1' as const;

export interface AiEvidenceView {
  schemaVersion: typeof AI_EVIDENCE_SCHEMA_VERSION;
  sourceCase: {
    resultId: string;
    inputHash: string;
    readingSchemaVersion: LiuyaoReading['schemaVersion'];
    rulesetVersion: LiuyaoReading['rulesetVersion'];
    engine: string;
    engineVersion: string;
  };
  question: QuestionContext;
  questionAssessment: QuestionAssessment;
  rulebook: {
    version: typeof PROFESSIONAL_RULEBOOK_VERSION;
    rules: ProfessionalRule[];
  };
  facts: {
    chart: LiuyaoReading['chart'];
    timing: LiuyaoReading['timing'];
    lines: LiuyaoLine[];
    hiddenSpirits: HiddenSpirit[];
    lineFacts: AnalysisFact[];
    hiddenSpiritFacts: AnalysisFact[];
    structureFacts: AnalysisFact[];
  };
  analysis: {
    evidenceStatus: string;
    overview: LiuyaoReading['analysis']['overview'];
    focusCandidates: AnalysisCandidate[];
    counterEvidence: AnalysisFact[];
    timingFacts: AnalysisFact[];
    limitations: string[];
    limitationFacts: AnalysisFact[];
  };
  constraints: {
    mustNotRecalculateChart: true;
    mustCiteFactKeys: true;
    mustPresentCounterEvidence: true;
    prohibitedOutputs: string[];
  };
}

export function buildAiEvidenceView(reading: LiuyaoReading): AiEvidenceView {
  return {
    schemaVersion: AI_EVIDENCE_SCHEMA_VERSION,
    sourceCase: {
      resultId: reading.audit.resultId,
      inputHash: reading.audit.inputHash,
      readingSchemaVersion: reading.schemaVersion,
      rulesetVersion: reading.rulesetVersion,
      engine: reading.audit.engine,
      engineVersion: reading.audit.engineVersion,
    },
    question: reading.input.question,
    questionAssessment: reading.analysis.questionAssessment,
    rulebook: {
      version: PROFESSIONAL_RULEBOOK_VERSION,
      rules: PROFESSIONAL_RULEBOOK.map((rule) => ({
        ...rule,
        sources: [...rule.sources],
      })),
    },
    facts: {
      chart: reading.chart,
      timing: reading.timing,
      lines: reading.lines,
      hiddenSpirits: reading.hiddenSpirits,
      lineFacts: reading.analysis.lineFacts,
      hiddenSpiritFacts: reading.analysis.hiddenSpiritFacts,
      structureFacts: reading.analysis.structureFacts,
    },
    analysis: {
      evidenceStatus: reading.analysis.evidenceStatus,
      overview: reading.analysis.overview,
      focusCandidates: reading.analysis.focusCandidates,
      counterEvidence: reading.analysis.counterEvidence,
      timingFacts: reading.analysis.timingFacts,
      limitations: reading.analysis.limitations,
      limitationFacts: reading.analysis.limitationFacts,
    },
    constraints: {
      mustNotRecalculateChart: true,
      mustCiteFactKeys: true,
      mustPresentCounterEvidence: true,
      prohibitedOutputs: [
        '重新计算或改写纳甲、世应、旬空、六亲、旺衰、动变与伏神字段',
        '按证据条数、候选数量或模型语气生成成功率',
        '隐藏与结论方向相反的限制和反证',
        '把触发条件机械换算为唯一日期或必然结果',
        '把传统类象写成现实身份、疾病、官非或财务结果已被证明',
      ],
    },
  };
}
