import type { QuestionTopic } from './types';

export interface TopicInference {
  topic: QuestionTopic;
  source: 'inferred' | 'fallback';
  reason: string;
  matchedTerms: string[];
}

interface TopicRule {
  topic: Exclude<QuestionTopic, 'general'>;
  label: string;
  patterns: readonly RegExp[];
}

const TOPIC_RULES: readonly TopicRule[] = [
  {
    topic: 'ganqing',
    label: '感情与关系',
    patterns: [
      /感情|恋爱|婚姻|姻缘|复合|分手|前任/u,
      /男友|女友|伴侣|对象|相亲|暧昧|追求/u,
      /(?:他|她|对方)对我|关系(?:能否|是否|会不会)/u,
    ],
  },
  {
    topic: 'caifu',
    label: '财务与交易',
    patterns: [
      /财运|钱财|收入|回款|货款|借款|欠款|贷款|债务/u,
      /投资|股票|基金|交易|买卖|收益|盈利|亏损/u,
      /工资|奖金|赔偿|到账|收款|付款/u,
    ],
  },
  {
    topic: 'shiye',
    label: '事业与工作',
    patterns: [
      /事业|工作|职场|职位|入职|离职|辞职|跳槽/u,
      /面试|录用|录取|offer|升职|晋升|求职|考编/u,
      /项目|审批|竞聘/u,
    ],
  },
] as const;

function matchedPatterns(text: string, patterns: readonly RegExp[]): string[] {
  return patterns.flatMap((pattern) => text.match(pattern)?.[0] ?? []);
}

export function inferQuestionTopic(text: string): TopicInference {
  const normalized = text.replace(/\s+/gu, '');
  const educationTerm = normalized.match(/学习氛围|班级|开学|课堂|课程|老师|作业|成绩|升学|考试/u)?.[0];
  if (educationTerm) {
    return {
      topic: 'general',
      source: 'fallback',
      reason: `问题中的“${educationTerm}”可能同时涉及世应、父母爻与官鬼爻；当前不按单一事业主题强定用神，保留通用候选。`,
      matchedTerms: [educationTerm],
    };
  }
  const matches = TOPIC_RULES
    .map((rule) => ({ ...rule, matchedTerms: matchedPatterns(normalized, rule.patterns) }))
    .filter((rule) => rule.matchedTerms.length > 0)
    .sort((left, right) => right.matchedTerms.length - left.matchedTerms.length);

  const strongest = matches[0];
  const runnerUp = matches[1];
  if (!strongest) {
    return {
      topic: 'general',
      source: 'fallback',
      reason: '未识别到单一明确主题，保留世爻与应爻等通用候选，不自动强定用神。',
      matchedTerms: [],
    };
  }
  if (runnerUp && runnerUp.matchedTerms.length === strongest.matchedTerms.length) {
    return {
      topic: 'general',
      source: 'fallback',
      reason: `问题同时涉及${strongest.label}与${runnerUp.label}，保留通用候选，避免按单一主题误取用神。`,
      matchedTerms: [...strongest.matchedTerms, ...runnerUp.matchedTerms],
    };
  }

  return {
    topic: strongest.topic,
    source: 'inferred',
    reason: `根据问题中的“${strongest.matchedTerms.join('、')}”识别为${strongest.label}；这只决定取用候选，不替代盘面判断。`,
    matchedTerms: strongest.matchedTerms,
  };
}
