export const PROFESSIONAL_RULEBOOK_VERSION = 'jingfang-zengshan-ai-guide-v1' as const;

export interface ProfessionalRule {
  id: string;
  title: string;
  principle: string;
  scope: string;
  sources: string[];
}

export const PROFESSIONAL_RULEBOOK: readonly ProfessionalRule[] = [
  {
    id: 'question.useful-god-candidate',
    title: '先按问事语义形成取用候选',
    principle: '问题主题只决定优先观察轴；用户明确指定六亲时优先采用，语义含混时保留通用候选，不强定单一用神。',
    scope: '感情问题固定比较世爻与应爻双轴，不按求测者性别机械套妻财或官鬼。',
    sources: ['jingfang-zengshan-v1 规则裁决', 'docs/RULESET_CASES.md'],
  },
  {
    id: 'najia.full-stem-branch',
    title: '纳甲使用完整干支',
    principle: '主卦、变爻与伏神分别按所在内外卦装天干，并与地支共同构成纳甲；六亲仍以主卦所属宫五行为“我”判定。',
    scope: '天干用于完整排盘与审计，不单凭某个天干生成现实吉凶。',
    sources: ['京房纳甲歌诀', 'bopo/najia（GPL-3.0，仅作差分核验）'],
  },
  {
    id: 'changed-line.original-palace-relative',
    title: '变爻六亲以主卦宫定',
    principle: '变爻地支与五行取变后爻位，但六亲关系仍以主卦宫五行为基准，不把变卦重新入宫后改算六亲。',
    scope: '这是本规则版本的明确口径；与另行重定变卦宫位的实现不混用。',
    sources: ['jingfang-zengshan-v1 规则裁决', 'mingyu-core@0.1.32'],
  },
  {
    id: 'day-clash.hidden-move-or-break',
    title: '日冲须区分暗动与日破',
    principle: '静爻受日冲时，旺相且有力者记为暗动；休囚死等无力者记为日破，不能把所有日冲统一解释成暗动。',
    scope: '只解释引擎已经计算出的 isHiddenMove 与 isDayBreak，不由 AI 自行重算旺衰。',
    sources: ['《增删卜易·暗动章》', 'mingyu-core@0.1.32'],
  },
  {
    id: 'hidden-spirit.missing-relative',
    title: '缺亲伏神只作潜在线索',
    principle: '本卦缺少目标六亲时，按本宫纯卦对应爻位安伏神，并同时保留覆盖它的飞神资料。',
    scope: '伏神是否可用仍看空破、月日生扶及飞伏关系；出现伏神不等于现实事件已经发生。',
    sources: ['京房八宫伏神法', 'mingyu-core@0.1.32'],
  },
  {
    id: 'calendar.fixed-beijing',
    title: '固定北京时间与节气月',
    principle: '排盘统一使用 Asia/Shanghai 的 UTC+8 民用时间、节气换月和 23:00 换日；时间输入属于盘面事实的一部分。',
    scope: 'AI 不得把用户设备时区或对话时间替换成起卦时间。',
    sources: ['jingfang-zengshan-v1 规则裁决', 'src/domain/liuyao/time.ts'],
  },
  {
    id: 'structure.sanhe-current-scope',
    title: '三合只采用当前已计算口径',
    principle: '当前版本只解释证据包中已经生成的日月三合结构，不自行补算其他动爻组合。',
    scope: '动爻、变爻参与的广义三合尚未完成独立差分验证，AI 不得扩写为既定事实。',
    sources: ['jingfang-zengshan-v1 当前实现边界', 'docs/ARCHITECTURE.md'],
  },
  {
    id: 'tomb.current-scope',
    title: '入墓只解释已计算事实',
    principle: '只使用证据包明确给出的入墓、化墓等字段；没有字段时不得凭模型知识补算。',
    scope: '当前版本尚未把日墓、动墓、化墓全部统一成经独立验证的规则层。',
    sources: ['jingfang-zengshan-v1 当前实现边界', 'docs/ARCHITECTURE.md'],
  },
  {
    id: 'timing.trigger-not-promise',
    title: '应期先给触发条件',
    principle: '应期只围绕动爻、出空冲实、伏神透出、月日生扶等已计算条件，并受用户现实期限约束。',
    scope: '不得把爻位、支序或卦数机械换算成唯一日期，也不得把触发条件写成事件保证。',
    sources: ['jingfang-zengshan-v1 产品边界', 'docs/RULESET_CASES.md'],
  },
] as const;
