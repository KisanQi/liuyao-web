import type {
  AnalysisCandidate,
  AnalysisFact,
  LiuyaoLine,
  LiuyaoReading,
} from '../domain/liuyao/types';
import { buildAiEvidenceView } from '../domain/liuyao/ai-evidence';

const POSITION_LABELS = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'] as const;
const TOPIC_LABELS = {
  general: '通用问题',
  shiye: '事业与工作',
  caifu: '财务与交易',
  ganqing: '感情与关系',
} as const;

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function lineSymbol(line: LiuyaoLine): string {
  return line.yinYang === '阳' ? '━━━━━━' : '━━  ━━';
}

function renderLine(line: LiuyaoLine): string {
  const flags = [
    line.role,
    line.isChanging ? '明动' : null,
    line.isHiddenMove ? '暗动' : null,
    line.isVoid ? '空' : null,
    line.isDayBreak ? '日破' : null,
    line.isMonthBreak ? '月破' : null,
    line.seasonState ? `月令${line.seasonState}` : null,
  ].filter(Boolean);
  const changeConditions = line.changed
    ? [...line.changed.relations, line.changed.direction].filter(Boolean).join('、')
    : '';
  const changed = line.changed
    ? ` → ${line.changed.sixRelative}${line.changed.stem}${line.changed.branch}${line.changed.element}${line.changed.isVoid ? '（空）' : ''}${changeConditions ? `（${changeConditions}）` : ''}`
    : '';
  const hidden = line.hiddenSpirits.length
    ? `<div class="hidden-spirit">伏：${line.hiddenSpirits
        .map((item) => `${escapeHtml(item.sixRelative)}${escapeHtml(item.stem)}${escapeHtml(item.branch)}${escapeHtml(item.element)}${item.isVoid ? '（空）' : ''}`)
        .join('、')}</div>`
    : '';

  return `
    <li class="yao-line ${line.isChanging ? 'changing' : ''}">
      <span class="position">${POSITION_LABELS[line.position - 1] ?? line.position}</span>
      <span class="symbol" aria-label="${escapeHtml(line.yinYang)}爻">${lineSymbol(line)}</span>
      <span class="line-value">${line.value}</span>
      <span class="line-data">${escapeHtml(line.sixGod)} · ${escapeHtml(line.sixRelative)}${escapeHtml(line.stem)}${escapeHtml(line.branch)}${escapeHtml(line.element)}${escapeHtml(changed)}</span>
      <span class="flags">${flags.map((flag) => `<b>${escapeHtml(flag)}</b>`).join('')}</span>
      ${line.twelveStage ? `<span class="line-stage">十二宫：${escapeHtml(line.twelveStage)}</span>` : ''}
      ${hidden}
    </li>`;
}

function renderList(items: readonly string[], emptyText: string): string {
  if (!items.length) return `<p class="empty-note">${escapeHtml(emptyText)}</p>`;
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function renderCandidate(candidate: AnalysisCandidate): string {
  const references = candidate.references.length
    ? candidate.references
        .map((reference) => {
          const role = reference.role ? `·${reference.role}` : '';
          const moving = reference.isChanging ? '·动' : '';
          const empty = reference.isVoid ? '·空' : '';
          return `<li>${escapeHtml(`${reference.source}${reference.position}爻：${reference.sixRelative}${reference.branch}${reference.element}${role}${moving}${empty}`)}</li>`;
        })
        .join('')
    : '<li>盘中未匹配到对应爻位</li>';

  return `
    <article class="candidate">
      <div class="candidate-heading">
        <strong>${escapeHtml(candidate.label)}</strong>
        <span>${escapeHtml(candidate.sourceStatus)} · ${escapeHtml(candidate.status)}</span>
      </div>
      <p>${escapeHtml(candidate.reason)}</p>
      <ul class="reference-list">${references}</ul>
    </article>`;
}

function renderFactList(facts: readonly AnalysisFact[], emptyText: string): string {
  if (!facts.length) return `<p class="empty-note">${escapeHtml(emptyText)}</p>`;
  return `<ol class="fact-list">${facts
    .map(
      (fact) => `
        <li>
          <strong>${escapeHtml(fact.type)}</strong>
          <span>${escapeHtml(fact.text)}</span>
          <small>边界：${escapeHtml(fact.limitation)}</small>
        </li>`,
    )
    .join('')}</ol>`;
}

function renderFocusConditions(candidates: readonly AnalysisCandidate[], issues: readonly string[]): string {
  if (!candidates.length) {
    return `<div class="analysis-columns"><div><h4>问事资料</h4>${renderList(issues, '当前没有选定分析轴')}</div></div>`;
  }
  if (candidates.length === 1) {
    const candidate = candidates[0];
    return `
      <div class="analysis-columns">
        <div><h4>支持条件</h4>${renderList(candidate?.support ?? [], '未见额外增强条件')}</div>
        <div><h4>限制条件</h4>${renderList(candidate?.constraints ?? [], '未见明确空破墓退限制')}</div>
      </div>`;
  }
  return `<div class="focus-axis-grid">${candidates
    .map(
      (candidate) => `
        <article class="focus-axis">
          <h4>${escapeHtml(candidate.label)}</h4>
          <p><strong>支持：</strong>${escapeHtml(candidate.support.join('、') || '未见额外增强')}</p>
          <p><strong>限制：</strong>${escapeHtml(candidate.constraints.join('、') || '未见明确空破墓退限制')}</p>
        </article>`,
    )
    .join('')}</div>`;
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

export function renderReading(container: HTMLElement, reading: LiuyaoReading): void {
  const movingText = reading.chart.movingPositions.length
    ? reading.chart.movingPositions.join('、')
    : '无';
  const relationText = reading.chart.relationLabels.length
    ? reading.chart.relationLabels.join(' · ')
    : '无特殊整卦关系';
  const randomModeLabels = {
    system: '系统安全随机',
    seeded: '确定性种子',
    custom: '自定义随机源',
    replay: '轨迹重放',
  } as const;
  const randomText = reading.audit.random
    ? `${randomModeLabels[reading.audit.random.mode]} · ${reading.audit.random.samples.length} 个样本`
    : '手工确定性输入';
  const question = reading.input.question;
  const analysis = reading.analysis;
  const changedName = reading.chart.changed ?? '静卦';

  container.innerHTML = `
    <article class="reading-card">
      <header class="case-header">
        <div>
          <span class="section-index">3. 解读结果</span>
          <h2>${escapeHtml(reading.chart.original)}${reading.chart.changed ? ` → ${escapeHtml(reading.chart.changed)}` : ''}</h2>
          <p class="question-text">所问：${escapeHtml(question.text)}</p>
          ${question.timeframe ? `<p class="case-meta">期限：${escapeHtml(question.timeframe)}</p>` : ''}
          ${question.background ? `<p class="case-meta">背景：${escapeHtml(question.background)}</p>` : ''}
        </div>
      </header>

      <section class="ai-analysis-section" aria-labelledby="ai-analysis-title">
        <div class="section-heading">
          <div>
            <span class="section-index">AI 解读</span>
            <h3 id="ai-analysis-title">先回答问题，再给具体建议</h3>
          </div>
          <p>先说最可能的发展，再讲主要原因、需要留意的变化和接下来可以做什么。</p>
        </div>
        <button
          id="generate-ai-analysis"
          type="button"
          ${analysis.questionAssessment.canAnalyze ? '' : 'disabled'}
        >使用 Claude Fable 5.1 深度解读</button>
        <div id="ai-analysis-output" class="ai-analysis-output" data-state="idle" role="status" aria-live="polite">
          ${analysis.questionAssessment.canAnalyze
            ? '点击后，Claude 会直接回答你的问题；专业分析只放在可选的展开区域。'
            : '问事资料不足，暂不能生成 AI 解读。'}
        </div>
      </section>

      <details class="professional-disclosure">
        <summary>
          <span>查看专业排盘与完整证据</span>
          <small>六爻、用神、反证、应期、计算流程与技术审计</small>
        </summary>
        <div class="professional-disclosure-body">
          <div class="evidence-status">
            <span>证据状态</span>
            <strong>${escapeHtml(analysis.evidenceStatus)}</strong>
            <small>问事：${escapeHtml(analysis.questionAssessment.status)}</small>
            <small>${escapeHtml(reading.rulesetVersion)}</small>
            <small>取用主题：${escapeHtml(TOPIC_LABELS[question.topic])}${question.topicSource === 'inferred' ? '（系统识别）' : question.topicSource === 'fallback' ? '（保留通用候选）' : '（用户指定）'}</small>
            ${question.topicReason ? `<small>${escapeHtml(question.topicReason)}</small>` : ''}
          </div>

          <section class="analysis-overview" data-state="${escapeHtml(analysis.overview.state)}">
            <span class="analysis-state">${escapeHtml(analysis.overview.state)}</span>
            <h3>${escapeHtml(analysis.overview.headline)}</h3>
            <p>${escapeHtml(analysis.overview.rationale)}</p>
            <p class="next-check"><strong>下一步核验：</strong>${escapeHtml(analysis.overview.nextCheck)}</p>
          </section>

      <div class="reading-summary">
        <div><span>本卦</span><strong>${escapeHtml(reading.chart.original)}</strong></div>
        <div><span>变卦</span><strong>${escapeHtml(changedName)}</strong></div>
        <div><span>互卦</span><strong>${escapeHtml(reading.chart.mutual)}</strong></div>
        <div><span>卦宫</span><strong>${escapeHtml(reading.chart.palace)}宫 · ${escapeHtml(reading.chart.palaceElement)} · ${escapeHtml(reading.chart.palaceStage ?? '未标注')}</strong></div>
      </div>

      <div class="fact-strip">
        <span>爻值：${escapeHtml(reading.input.values.join('、'))}</span>
        <span>动爻：${escapeHtml(movingText)}</span>
        <span>旬空：${escapeHtml(reading.chart.voidBranches.join('、'))}</span>
        <span>${escapeHtml(reading.chart.specialPattern ?? relationText)}</span>
      </div>

      <ol class="yao-list" aria-label="六爻排盘，上爻在上、初爻在下">
        ${[...reading.lines].reverse().map(renderLine).join('')}
      </ol>

      <section class="analysis-section">
        <div class="section-heading">
          <h3>取用与作用链</h3>
          <p>用神先作候选，再根据盘面匹配；问题语义不足时不强定。</p>
        </div>
        ${renderFocusConditions(analysis.focusCandidates, analysis.questionAssessment.issues)}
        <div class="god-chain">
          ${analysis.godChain.length
            ? analysis.godChain
            .map(
              (item) => `
                <div>
                  <span>${escapeHtml(item.role)}</span>
                  <strong>${escapeHtml(item.element)}</strong>
                  <small>${escapeHtml(item.relation)} · ${escapeHtml(item.status)}${item.positions.length ? ` · 第${escapeHtml(item.positions.join('、'))}爻` : ''}</small>
                </div>`,
            )
            .join('')
            : '<p class="empty-note">当前采用多轴或资料不足口径，不用单一候选的用神—原神—忌神—仇神链概括全局。</p>'}
        </div>
      </section>

      <details class="analysis-detail" open>
        <summary>用神候选与匹配</summary>
        <div class="candidate-list">${analysis.candidates.map(renderCandidate).join('')}</div>
      </details>

      <details class="analysis-detail" open>
        <summary>反证与卦局结构</summary>
        <div class="detail-grid">
          <section><h4>反证</h4>${renderFactList(analysis.counterEvidence, '未见明确反证')}</section>
          <section><h4>结构</h4>${renderFactList(analysis.structureFacts, '无特殊整卦结构')}</section>
        </div>
      </details>

      <details class="analysis-detail" open>
        <summary>应期只保留触发条件</summary>
        ${renderFactList(analysis.timingFacts, '当前只有统一期限边界')}
      </details>

      <details class="analysis-detail">
        <summary>完整计算流程</summary>
        <ol class="calculation-steps">
          ${analysis.steps
            .map(
              (step, index) => `
                <li>
                  <span>${index + 1}</span>
                  <div><strong>${escapeHtml(step.stage)} · ${escapeHtml(step.status)}</strong><p>${escapeHtml(step.text)}</p></div>
                </li>`,
            )
            .join('')}
        </ol>
      </details>

      <details class="analysis-detail">
        <summary>方法边界</summary>
        ${renderList(analysis.limitations, '无额外边界说明')}
      </details>

      <details class="audit-panel">
        <summary>技术审计信息</summary>
        <dl>
          <div><dt>引擎</dt><dd>${escapeHtml(reading.audit.engine)} ${escapeHtml(reading.audit.engineVersion)}</dd></div>
          <div><dt>协议</dt><dd>${escapeHtml(reading.schemaVersion)}</dd></div>
          <div><dt>规则版本</dt><dd>${escapeHtml(reading.rulesetVersion)}</dd></div>
          <div><dt>随机／输入</dt><dd>${escapeHtml(randomText)}</dd></div>
          <div><dt>应用结果 ID</dt><dd>${escapeHtml(reading.audit.resultId || '未提供')}</dd></div>
          <div><dt>应用输入哈希</dt><dd>${escapeHtml(reading.audit.inputHash || '未提供')}</dd></div>
          <div><dt>内核结果 ID</dt><dd>${escapeHtml(reading.audit.engineResultId || '未提供')}</dd></div>
          <div><dt>内核输入哈希</dt><dd>${escapeHtml(reading.audit.engineInputHash || '未提供')}</dd></div>
          <div><dt>四柱</dt><dd>${escapeHtml(`${reading.timing.year} ${reading.timing.month} ${reading.timing.day} ${reading.timing.hour}`)}</dd></div>
          <div><dt>历法时间</dt><dd>${escapeHtml(`${reading.timing.civilTime} ${reading.timing.timeZone} (${reading.timing.utcOffset})，${reading.timing.dayBoundary} 换日`)}</dd></div>
        </dl>
        <div class="audit-actions">
          <button id="copy-ai-evidence" class="secondary" type="button">复制 AI 证据包</button>
          <button id="copy-json" class="secondary" type="button">复制完整结构化 JSON</button>
        </div>
      </details>
        </div>
      </details>
    </article>`;

  container.querySelector<HTMLButtonElement>('#copy-json')?.addEventListener('click', async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    try {
      await copyText(JSON.stringify(reading, null, 2));
      button.textContent = '已复制';
    } catch {
      button.textContent = '复制失败';
    }
    window.setTimeout(() => {
      button.textContent = '复制完整结构化 JSON';
    }, 1600);
  });

  container.querySelector<HTMLButtonElement>('#copy-ai-evidence')?.addEventListener('click', async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    try {
      await copyText(JSON.stringify(buildAiEvidenceView(reading), null, 2));
      button.textContent = 'AI 证据包已复制';
    } catch {
      button.textContent = '复制失败';
    }
    window.setTimeout(() => {
      button.textContent = '复制 AI 证据包';
    }, 1600);
  });
}
