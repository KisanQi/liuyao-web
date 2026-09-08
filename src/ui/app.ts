import { castCoins, castManual } from '../domain/liuyao/engine';
import {
  requestAiFollowUp,
  requestAiInterpretation,
  type AiFollowUpExchange,
} from '../domain/liuyao/ai-client';
import type { AiInterpretation } from '../domain/liuyao/ai-contract';
import { buildAiEvidenceView, type AiEvidenceView } from '../domain/liuyao/ai-evidence';
import {
  clearHistory,
  loadHistory,
  removeHistoryEntry,
  saveAiToHistory,
  saveReadingToHistory,
  type HistoryAiSnapshot,
  type LiuyaoHistoryEntry,
} from '../domain/liuyao/history';
import { inferQuestionTopic } from '../domain/liuyao/question-intent';
import { parseYaoInput } from '../domain/liuyao/parse';
import { formatCivilTimeInput, parseCivilTimeInput } from '../domain/liuyao/time';
import {
  isQuestionTopic,
  isSixRelative,
  type CoinThrow,
  type LiuyaoReading,
  type QuestionContext,
  type YaoValue,
} from '../domain/liuyao/types';
import {
  CAST_POSITION_LABELS,
  advanceAutoReveal,
  appendManualYao,
  coinFaceLabel,
  nextCastLabel,
  yaoPresentation,
} from './casting-flow';
import { renderReading } from './render-reading';

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`页面缺少必要元素：${selector}`);
  return element;
}

function appendTextList(parent: HTMLElement, title: string, items: readonly string[]): void {
  const section = document.createElement('section');
  const heading = document.createElement('h4');
  const list = document.createElement('ul');
  heading.textContent = title;
  items.forEach((item) => {
    const listItem = document.createElement('li');
    listItem.textContent = item;
    list.append(listItem);
  });
  section.append(heading, list);
  parent.append(section);
}

function renderAiInterpretation(
  output: HTMLElement,
  interpretation: AiInterpretation,
  model: string,
  resultId: string,
): void {
  const answer = document.createElement('section');
  answer.className = 'ai-direct-answer';

  const meta = document.createElement('div');
  meta.className = 'ai-answer-meta';
  const tendency = document.createElement('strong');
  tendency.textContent = interpretation.tendencyLabel;
  meta.append(tendency);

  const heading = document.createElement('h4');
  heading.textContent = '结论';
  const directAnswer = document.createElement('p');
  directAnswer.textContent = interpretation.directAnswer;
  answer.append(meta, heading, directAnswer);

  const visibleBasis = document.createElement('div');
  visibleBasis.className = 'ai-visible-basis';
  appendTextList(visibleBasis, '这次卦给出的信息', interpretation.keyReasons);
  appendTextList(visibleBasis, '给到的建议', interpretation.realityChecks);

  const uncertainty = document.createElement('p');
  uncertainty.className = 'ai-uncertainty';
  const uncertaintyLabel = document.createElement('strong');
  uncertaintyLabel.textContent = '关键转折：';
  uncertainty.append(uncertaintyLabel, interpretation.mainUncertainty);

  const details = document.createElement('details');
  details.className = 'ai-professional-basis';
  const summary = document.createElement('summary');
  summary.textContent = '查看专业分析（含术语，可选）';
  const professionalBasis = document.createElement('p');
  professionalBasis.textContent = interpretation.professionalBasis;
  const boundary = document.createElement('p');
  boundary.className = 'ai-boundary';
  boundary.textContent = interpretation.boundary;
  const audit = document.createElement('small');
  audit.textContent = `模型：${model} · 内部证据力度：${interpretation.evidenceStrength} · 证据案例：${resultId}`;
  details.append(summary, professionalBasis, boundary, audit);

  output.replaceChildren(answer, visibleBasis, uncertainty, details);
}

function mountAiFollowUps(
  output: HTMLElement,
  evidence: AiEvidenceView,
  initialInterpretation: AiInterpretation,
  initialHistory: readonly AiFollowUpExchange[] = [],
  onHistoryChange?: (history: readonly AiFollowUpExchange[]) => void,
): void {
  const section = document.createElement('section');
  section.className = 'ai-followups';

  const heading = document.createElement('div');
  heading.className = 'ai-followup-heading';
  const title = document.createElement('h4');
  title.textContent = '还想问得更具体？';
  const allowance = document.createElement('span');
  allowance.textContent = '还可追问 2 次';
  heading.append(title, allowance);

  const exchanges = document.createElement('div');
  exchanges.className = 'ai-followup-exchanges';
  const form = document.createElement('form');
  form.className = 'ai-followup-form';
  const textarea = document.createElement('textarea');
  textarea.rows = 2;
  textarea.maxLength = 240;
  textarea.placeholder = '继续问，例如：我最需要留意什么？';
  textarea.setAttribute('aria-label', '继续追问');
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = '提交追问';
  const status = document.createElement('p');
  status.className = 'ai-followup-status';
  status.setAttribute('role', 'status');
  form.append(textarea, submit);
  section.append(heading, exchanges, form, status);
  output.append(section);

  const history: AiFollowUpExchange[] = initialHistory.slice(0, 2);
  const appendExchange = (item: AiFollowUpExchange): void => {
    const exchange = document.createElement('article');
    exchange.className = 'ai-followup-exchange';
    const questionElement = document.createElement('p');
    questionElement.className = 'ai-followup-question';
    questionElement.textContent = item.question;
    const answerElement = document.createElement('p');
    answerElement.className = 'ai-followup-answer';
    answerElement.textContent = item.answer.replace(/\*\*([^*\n]+)\*\*/gu, '$1');
    exchange.append(questionElement, answerElement);
    exchanges.append(exchange);
  };
  history.forEach(appendExchange);
  if (history.length >= 2) {
    allowance.textContent = '已完成 2 次追问';
    textarea.disabled = true;
    textarea.placeholder = '本次解读已完成两次追问';
    submit.disabled = true;
    submit.textContent = '追问已完成';
    status.textContent = '历史记录已恢复两次追问。';
  } else if (history.length === 1) {
    allowance.textContent = '还可追问 1 次';
    status.textContent = '已恢复上一次追问，可以继续追问一次。';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (history.length >= 2) return;
    const question = textarea.value.trim();
    if (question.length < 2) {
      status.textContent = '请写下一个具体追问。';
      return;
    }

    textarea.disabled = true;
    submit.disabled = true;
    submit.textContent = '正在回答…';
    status.textContent = '正在结合原问题和前文回答，请稍候。';
    try {
      const response = await requestAiFollowUp(evidence, initialInterpretation, question, history);
      const historyItem = { question, answer: response.answer };
      appendExchange(historyItem);
      history.push(historyItem);
      onHistoryChange?.([...history]);
      const remaining = 2 - history.length;
      allowance.textContent = remaining ? `还可追问 ${remaining} 次` : '已完成 2 次追问';
      textarea.value = '';
      status.textContent = remaining ? '可以继续追问一次。' : '本次解读的两次追问已用完。';
      if (!remaining) {
        textarea.placeholder = '本次解读已完成两次追问';
        submit.textContent = '追问已完成';
        return;
      }
    } catch (cause) {
      status.textContent = cause instanceof Error ? cause.message : 'AI 追问失败，请稍后重试。';
    } finally {
      if (history.length < 2) {
        textarea.disabled = false;
        submit.disabled = false;
        submit.textContent = '提交追问';
        textarea.focus();
      }
    }
  });
}

export function mountLiuyaoApp(root: Document): void {
  const form = requireElement<HTMLFormElement>(root, '#manual-form');
  const questionInput = requireElement<HTMLTextAreaElement>(root, '#question-input');
  const topicSelect = requireElement<HTMLSelectElement>(root, '#topic-select');
  const timeframeInput = requireElement<HTMLInputElement>(root, '#timeframe-input');
  const backgroundInput = requireElement<HTMLTextAreaElement>(root, '#background-input');
  const usefulGodSelect = requireElement<HTMLSelectElement>(root, '#useful-god-select');
  const castTimeInput = requireElement<HTMLInputElement>(root, '#cast-time-input');
  const yaoInput = requireElement<HTMLInputElement>(root, '#yao-input');
  const seedInput = requireElement<HTMLInputElement>(root, '#seed-input');
  const manualModeButton = requireElement<HTMLButtonElement>(root, '#manual-mode-button');
  const autoModeButton = requireElement<HTMLButtonElement>(root, '#auto-mode-button');
  const manualPanel = requireElement<HTMLElement>(root, '#manual-cast-panel');
  const autoPanel = requireElement<HTMLElement>(root, '#auto-cast-panel');
  const randomButton = requireElement<HTMLButtonElement>(root, '#random-button');
  const replayButton = requireElement<HTMLButtonElement>(root, '#replay-button');
  const manualUndoButton = requireElement<HTMLButtonElement>(root, '#manual-undo-button');
  const resetCastButton = requireElement<HTMLButtonElement>(root, '#reset-cast-button');
  const manualChoiceButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-yao-value]')];
  const castStage = requireElement<HTMLOListElement>(root, '#cast-stage');
  const castStepLabel = requireElement<HTMLElement>(root, '#cast-step-label');
  const castProgressText = requireElement<HTMLElement>(root, '#cast-progress-text');
  const castProgressBar = requireElement<HTMLElement>(root, '#cast-progress-bar');
  const currentThrow = requireElement<HTMLElement>(root, '#current-throw');
  const currentThrowText = requireElement<HTMLElement>(root, '#current-throw-text');
  const coinFaces = [...currentThrow.querySelectorAll<HTMLElement>('.coin-row span')];
  const result = requireElement<HTMLElement>(root, '#result');
  const error = requireElement<HTMLElement>(root, '#error-message');
  const historyButton = requireElement<HTMLButtonElement>(root, '#history-button');
  const historyCount = requireElement<HTMLElement>(root, '#history-count');
  const historyDialog = requireElement<HTMLDialogElement>(root, '#history-dialog');
  const historyCloseButton = requireElement<HTMLButtonElement>(root, '#history-close-button');
  const historyClearButton = requireElement<HTMLButtonElement>(root, '#history-clear-button');
  const historyList = requireElement<HTMLElement>(root, '#history-list');
  const reducedMotion = root.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const directSubmitButton = requireElement<HTMLButtonElement>(form, 'button[type="submit"]');
  const contextControls = [
    questionInput,
    topicSelect,
    timeframeInput,
    backgroundInput,
    usefulGodSelect,
    castTimeInput,
    seedInput,
    yaoInput,
    directSubmitButton,
  ];
  let castMode: 'manual' | 'auto' = 'auto';
  let manualValues: YaoValue[] = [];
  let manualSession: { date: Date; question: QuestionContext } | null = null;
  let lastRandomReading: LiuyaoReading | null = null;
  let pendingAutomaticReading: LiuyaoReading | null = null;
  let autoRevealedCount = 0;
  let replayingAutomaticCast = false;
  let activeAnimation = 0;
  let busy = false;
  let historyStorage: Storage | null = null;
  try {
    historyStorage = root.defaultView?.localStorage ?? null;
  } catch {
    historyStorage = null;
  }

  if (!castTimeInput.value) {
    castTimeInput.value = formatCivilTimeInput(new Date());
  }

  const readCastTime = (): Date => parseCivilTimeInput(castTimeInput.value);

  const readQuestion = (): QuestionContext => {
    const text = questionInput.value.trim();
    if (text.replace(/\s+/gu, '').length < 4) {
      throw new Error('请先写清一个具体问题，至少包含对象和所问事件。');
    }
    const selectedTopic = topicSelect.value;
    if (!isQuestionTopic(selectedTopic)) {
      throw new Error('问题主题无效。');
    }
    const usefulGodValue = usefulGodSelect.value.trim();
    if (usefulGodValue && !isSixRelative(usefulGodValue)) {
      throw new Error('指定的用神六亲无效。');
    }
    const usefulGodRelative = usefulGodValue && isSixRelative(usefulGodValue)
      ? usefulGodValue
      : undefined;
    const timeframe = timeframeInput.value.trim();
    if (!timeframe) {
      throw new Error('请填写现实期限，例如“本月底前”或“未来三个月”。');
    }
    const background = backgroundInput.value.trim();

    const topicInference = selectedTopic === 'general'
      ? inferQuestionTopic(text)
      : null;

    return {
      text,
      topic: topicInference?.topic ?? selectedTopic,
      topicSource: topicInference?.source ?? 'user',
      topicReason: topicInference?.reason ?? '由用户在高级选项中明确选择问题主题。',
      timeframe,
      ...(background ? { background } : {}),
      ...(usefulGodRelative ? { usefulGodRelative } : {}),
    };
  };

  const showError = (cause: unknown): void => {
    error.textContent = cause instanceof Error ? cause.message : '起卦失败，请检查输入。';
    error.hidden = false;
  };

  const clearError = (): void => {
    error.hidden = true;
    error.textContent = '';
  };

  const wait = async (milliseconds: number): Promise<void> => {
    await new Promise<void>((resolve) => window.setTimeout(resolve, reducedMotion ? 0 : milliseconds));
  };

  const showReading = (
    reading: LiuyaoReading,
    savedAi?: HistoryAiSnapshot,
    persist = true,
  ): void => {
    clearError();
    if (persist) saveReadingToHistory(historyStorage, reading);
    renderHistoryList();
    renderReading(result, reading);
    window.setTimeout(() => {
      result.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    }, reducedMotion ? 0 : 120);
    const aiButton = result.querySelector<HTMLButtonElement>('#generate-ai-analysis');
    const aiOutput = result.querySelector<HTMLElement>('#ai-analysis-output');
    const evidence = buildAiEvidenceView(reading);

    const showAiSnapshot = (snapshot: HistoryAiSnapshot): void => {
      if (!aiOutput) return;
      aiOutput.dataset.state = 'ready';
      renderAiInterpretation(aiOutput, snapshot.interpretation, snapshot.model, snapshot.resultId);
      mountAiFollowUps(
        aiOutput,
        evidence,
        snapshot.interpretation,
        snapshot.followUps,
        (followUps) => {
          saveAiToHistory(historyStorage, reading.audit.resultId, {
            ...snapshot,
            followUps: [...followUps],
          });
          renderHistoryList();
        },
      );
      if (aiButton) aiButton.textContent = '重新生成 AI 解读';
    };

    if (savedAi) showAiSnapshot(savedAi);
    aiButton?.addEventListener('click', async () => {
      if (!aiOutput || !reading.analysis.questionAssessment.canAnalyze) return;
      aiButton.disabled = true;
      aiButton.textContent = 'Claude Fable 5.1 分析中…';
      aiOutput.dataset.state = 'loading';
      aiOutput.textContent = '正在整理结论和具体建议，Fable 5.1 通常需要 30—90 秒，繁忙时可能更久，请不要重复点击。';
      try {
        const response = await requestAiInterpretation(evidence);
        if (!aiButton.isConnected || !aiOutput.isConnected) return;
        const snapshot: HistoryAiSnapshot = {
          interpretation: response.interpretation,
          model: response.model,
          resultId: response.resultId,
          followUps: [],
        };
        saveAiToHistory(historyStorage, reading.audit.resultId, snapshot);
        renderHistoryList();
        showAiSnapshot(snapshot);
      } catch (cause) {
        if (!aiButton.isConnected || !aiOutput.isConnected) return;
        aiOutput.dataset.state = 'error';
        aiOutput.textContent = cause instanceof Error ? cause.message : 'AI 解读失败，请稍后重试。';
      } finally {
        if (aiButton.isConnected) {
          aiButton.disabled = false;
          aiButton.textContent = aiOutput.dataset.state === 'ready'
            ? '重新生成 AI 解读'
            : '使用 Claude Fable 5.1 深度解读';
        }
      }
    });
  };

  const restoreQuestionInputs = (reading: LiuyaoReading): void => {
    const question = reading.input.question;
    questionInput.value = question.text;
    topicSelect.value = isQuestionTopic(question.topic) ? question.topic : 'general';
    timeframeInput.value = question.timeframe ?? '';
    backgroundInput.value = question.background ?? '';
    usefulGodSelect.value = question.usefulGodRelative ?? '';
    castTimeInput.value = formatCivilTimeInput(new Date(reading.createdAt));
    yaoInput.value = reading.input.values.join(',');
    const seed = reading.audit.random?.seed;
    seedInput.value = typeof seed === 'string' || typeof seed === 'number' ? String(seed) : '';
  };

  const restoreHistoryEntry = (entry: LiuyaoHistoryEntry): void => {
    const reading = entry.reading;
    const targetMode = reading.input.method === 'coins' ? 'auto' : 'manual';
    if (castMode !== targetMode) setMode(targetMode);
    else resetCeremony();
    restoreQuestionInputs(reading);
    reading.input.values.forEach((value, index) => {
      revealLine(index + 1, value, reading.input.coinThrows[index]?.coins);
    });
    if (targetMode === 'auto') {
      pendingAutomaticReading = reading;
      autoRevealedCount = 6;
      lastRandomReading = reading.audit.random?.samples.length ? reading : null;
    } else {
      manualValues = [...reading.input.values];
      manualSession = { date: new Date(reading.createdAt), question: reading.input.question };
      lastRandomReading = null;
    }
    resetCastButton.hidden = false;
    updateProgress(6, '历史卦盘已恢复');
    showReading(reading, entry.ai, false);
    historyDialog.close();
    syncControls();
  };

  const renderHistoryList = (): void => {
    const entries = loadHistory(historyStorage);
    historyCount.textContent = String(entries.length);
    historyClearButton.disabled = entries.length === 0;
    historyList.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement('p');
      empty.className = 'history-empty';
      empty.textContent = '还没有记录。完成一次排盘后会自动保存在这里。';
      historyList.append(empty);
      return;
    }

    entries.forEach((entry) => {
      const item = document.createElement('article');
      item.className = 'history-item';
      const copy = document.createElement('div');
      const title = document.createElement('h3');
      title.textContent = entry.reading.input.question.text;
      title.title = entry.reading.input.question.text;
      const meta = document.createElement('p');
      const date = new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(entry.createdAt));
      meta.textContent = `${date} · ${entry.reading.chart.original}${entry.reading.chart.changed ? ` → ${entry.reading.chart.changed}` : ' · 静卦'}`;
      const tags = document.createElement('div');
      tags.className = 'history-item-tags';
      const method = document.createElement('span');
      method.textContent = entry.reading.input.method === 'coins' ? '自动摇卦' : '手动起卦';
      tags.append(method);
      if (entry.ai) {
        const ai = document.createElement('span');
        ai.textContent = entry.ai.followUps.length
          ? `含 AI 解读 · ${entry.ai.followUps.length} 次追问`
          : '含 AI 解读';
        tags.append(ai);
      }
      copy.append(title, meta, tags);

      const actions = document.createElement('div');
      actions.className = 'history-item-actions';
      const openButton = document.createElement('button');
      openButton.type = 'button';
      openButton.textContent = '查看';
      openButton.addEventListener('click', () => restoreHistoryEntry(entry));
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'history-delete secondary';
      deleteButton.textContent = '删除';
      deleteButton.addEventListener('click', () => {
        if (!window.confirm('删除这条历史记录？删除后无法恢复。')) return;
        removeHistoryEntry(historyStorage, entry.id);
        renderHistoryList();
      });
      actions.append(openButton, deleteButton);
      item.append(copy, actions);
      historyList.append(item);
    });
  };

  const updateProgress = (count: number, override?: string): void => {
    castStepLabel.textContent = override ?? nextCastLabel(count);
    castProgressText.textContent = `${count} / 6`;
    castProgressBar.style.transform = `scaleX(${count / 6})`;
  };

  const setCoinFaces = (coins?: CoinThrow['coins']): void => {
    coinFaces.forEach((face, index) => {
      const coin = coins?.[index];
      face.textContent = '';
      face.dataset.face = coin ? coinFaceLabel(coin) : 'waiting';
    });
  };

  const resetStageLine = (position: number): void => {
    const row = castStage.querySelector<HTMLElement>(`[data-position="${position}"]`);
    if (!row) return;
    row.className = '';
    const symbol = requireElement<HTMLElement>(row, 'b');
    const detail = requireElement<HTMLElement>(row, 'small');
    symbol.textContent = '等待';
    detail.textContent = '';
  };

  const revealLine = (position: number, value: YaoValue, coins?: CoinThrow['coins']): void => {
    const row = castStage.querySelector<HTMLElement>(`[data-position="${position}"]`);
    if (!row) throw new Error(`起卦台缺少第 ${position} 爻。`);
    const presentation = yaoPresentation(value);
    row.className = `is-revealed${presentation.changing ? ' is-changing' : ''}`;
    requireElement<HTMLElement>(row, 'b').textContent = presentation.symbol;
    requireElement<HTMLElement>(row, 'small').textContent = `${presentation.name} · ${value}${presentation.changing ? ' · 动爻' : ''}`;
    const visibleCoins = coins ?? presentation.coins;
    setCoinFaces(visibleCoins);
    currentThrow.dataset.state = 'revealed';
    currentThrowText.textContent = `第${position}次投币：${visibleCoins.map(coinFaceLabel).join('、')}，得${presentation.name} ${value}`;
    updateProgress(position);
  };

  const resetCeremony = (clearResult = true): void => {
    activeAnimation += 1;
    busy = false;
    manualValues = [];
    manualSession = null;
    pendingAutomaticReading = null;
    autoRevealedCount = 0;
    replayingAutomaticCast = false;
    for (let position = 1; position <= 6; position += 1) resetStageLine(position);
    setCoinFaces();
    currentThrow.dataset.state = 'idle';
    currentThrowText.textContent = castMode === 'manual'
      ? '写好问题，心中确认后再记录初爻。'
      : '写好问题，心中确认后再开始。';
    updateProgress(0, castMode === 'manual' ? undefined : '准备摇初爻');
    resetCastButton.hidden = true;
    if (clearResult) result.replaceChildren();
  };

  const syncRandomButtonLabel = (): void => {
    if (autoRevealedCount >= 6) {
      randomButton.textContent = '六爻已成';
      return;
    }
    const positionLabel = CAST_POSITION_LABELS[autoRevealedCount] ?? '下一爻';
    const prefix = replayingAutomaticCast
      ? '重放'
      : seedInput.value.trim() && !pendingAutomaticReading
        ? '按种子摇'
        : '摇';
    randomButton.textContent = `${prefix}${positionLabel} · 第${autoRevealedCount + 1}次`;
  };

  const syncControls = (): void => {
    const manualInProgress = castMode === 'manual' && manualValues.length > 0 && manualValues.length < 6;
    const autoInProgress = castMode === 'auto' && autoRevealedCount > 0 && autoRevealedCount < 6;
    const ceremonyInProgress = manualInProgress || autoInProgress;
    manualModeButton.disabled = busy || ceremonyInProgress;
    autoModeButton.disabled = busy || ceremonyInProgress;
    manualChoiceButtons.forEach((button) => {
      button.disabled = busy || manualValues.length >= 6;
    });
    manualUndoButton.disabled = busy || manualValues.length === 0;
    manualUndoButton.hidden = castMode !== 'manual';
    randomButton.disabled = busy || autoRevealedCount >= 6;
    resetCastButton.disabled = busy;
    replayButton.disabled = busy || !lastRandomReading?.audit.random?.samples.length;
    contextControls.forEach((control) => {
      control.disabled = busy || ceremonyInProgress;
    });
    syncRandomButtonLabel();
  };

  const setBusy = (value: boolean): void => {
    busy = value;
    syncControls();
  };

  const setMode = (mode: 'manual' | 'auto'): void => {
    if (busy || castMode === mode) return;
    castMode = mode;
    resetCeremony();
    manualPanel.hidden = mode !== 'manual';
    autoPanel.hidden = mode !== 'auto';
    manualModeButton.ariaPressed = String(mode === 'manual');
    autoModeButton.ariaPressed = String(mode === 'auto');
    manualModeButton.classList.toggle('secondary', mode !== 'manual');
    autoModeButton.classList.toggle('secondary', mode !== 'auto');
    currentThrowText.textContent = mode === 'manual'
      ? '写好问题，心中确认后再记录初爻。'
      : '写好问题，心中确认后再开始。';
    syncControls();
  };

  const animateReading = async (
    reading: LiuyaoReading,
    source: 'auto' | 'replay' | 'direct',
  ): Promise<void> => {
    resetCeremony();
    const run = activeAnimation;
    setBusy(true);
    resetCastButton.hidden = false;
    result.replaceChildren();
    try {
      for (let index = 0; index < reading.input.values.length; index += 1) {
        if (run !== activeAnimation) return;
        const position = index + 1;
        currentThrow.dataset.state = source === 'direct' ? 'recording' : 'rolling';
        setCoinFaces();
        currentThrowText.textContent = source === 'direct'
          ? `正在录入${CAST_POSITION_LABELS[index]}…`
          : `正在摇${CAST_POSITION_LABELS[index]}…`;
        await wait(source === 'direct' ? 90 : 260);
        if (run !== activeAnimation) return;
        const value = reading.input.values[index];
        if (value === undefined) throw new Error(`排盘缺少${CAST_POSITION_LABELS[index]}。`);
        revealLine(position, value, reading.input.coinThrows[index]?.coins);
        await wait(source === 'direct' ? 130 : 430);
      }
      updateProgress(6, '六爻已成，正在排盘');
      await wait(source === 'direct' ? 120 : 420);
      if (run !== activeAnimation) return;
      showReading(reading);
      updateProgress(6, '六爻已成');
    } finally {
      if (run === activeAnimation) setBusy(false);
    }
  };

  manualChoiceButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      if (busy) return;
      try {
        if (!manualSession) {
          manualSession = { date: readCastTime(), question: readQuestion() };
          clearError();
          result.replaceChildren();
          setBusy(true);
          currentThrow.dataset.state = 'recording';
          currentThrowText.textContent = '所问已确认，请保持同一问题完成六爻。';
          updateProgress(0, '所问已确认，准备记录初爻');
          await wait(260);
          setBusy(false);
        }
        manualValues = appendManualYao(manualValues, Number(button.dataset.yaoValue));
        const position = manualValues.length;
        const currentValue = manualValues[position - 1];
        if (currentValue === undefined) throw new Error('未能记录本爻。');
        revealLine(position, currentValue);
        resetCastButton.hidden = false;
        syncControls();
        if (manualValues.length === 6) {
          setBusy(true);
          updateProgress(6, '六爻已成，正在排盘');
          await wait(480);
          const reading = castManual(manualValues, manualSession.date, manualSession.question);
          lastRandomReading = null;
          replayButton.disabled = true;
          showReading(reading);
          updateProgress(6, '六爻已成');
          setBusy(false);
        }
      } catch (cause) {
        showError(cause);
        syncControls();
      }
    });
  });

  manualUndoButton.addEventListener('click', () => {
    if (busy || !manualValues.length) return;
    const removedPosition = manualValues.length;
    manualValues = manualValues.slice(0, -1);
    resetStageLine(removedPosition);
    result.replaceChildren();
    if (!manualValues.length) {
      manualSession = null;
      setCoinFaces();
      currentThrow.dataset.state = 'idle';
      currentThrowText.textContent = '实际投三枚铜钱，再记录初爻。';
      resetCastButton.hidden = true;
    } else {
      const previous = manualValues[manualValues.length - 1];
      if (previous === undefined) throw new Error('起卦记录不完整。');
      const presentation = yaoPresentation(previous);
      setCoinFaces(presentation.coins);
      currentThrowText.textContent = `已撤回，请重新记录${CAST_POSITION_LABELS[manualValues.length]}。`;
    }
    updateProgress(manualValues.length);
    syncControls();
  });

  resetCastButton.addEventListener('click', () => {
    resetCeremony();
    clearError();
    syncControls();
  });

  manualModeButton.addEventListener('click', () => setMode('manual'));
  autoModeButton.addEventListener('click', () => setMode('auto'));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const reading = castManual(parseYaoInput(yaoInput.value), readCastTime(), readQuestion());
      lastRandomReading = null;
      replayButton.disabled = true;
      clearError();
      await animateReading(reading, 'direct');
    } catch (cause) {
      showError(cause);
    }
  });

  seedInput.addEventListener('input', syncRandomButtonLabel);
  syncRandomButtonLabel();

  randomButton.addEventListener('click', async () => {
    if (busy || autoRevealedCount >= 6) return;
    try {
      if (!pendingAutomaticReading) {
        const seed = seedInput.value.trim();
        pendingAutomaticReading = castCoins(seed ? { seed } : {}, readCastTime(), readQuestion());
        lastRandomReading = pendingAutomaticReading;
        replayingAutomaticCast = false;
        result.replaceChildren();
        resetCastButton.hidden = false;
        clearError();
        setBusy(true);
        currentThrow.dataset.state = 'recording';
        currentThrowText.textContent = '所问已确认，请保持同一问题完成六爻。';
        updateProgress(0, '所问已确认，准备摇初爻');
        await wait(320);
      }
      const reading = pendingAutomaticReading;
      const position = advanceAutoReveal(autoRevealedCount);
      const value = reading.input.values[position - 1];
      if (value === undefined) throw new Error(`排盘缺少${CAST_POSITION_LABELS[position - 1]}。`);
      clearError();
      setBusy(true);
      currentThrow.dataset.state = 'rolling';
      setCoinFaces();
      currentThrowText.textContent = `正在摇${CAST_POSITION_LABELS[position - 1]}…`;
      await wait(420);
      revealLine(position, value, reading.input.coinThrows[position - 1]?.coins);
      autoRevealedCount = position;
      if (position === 6) {
        updateProgress(6, '六爻已成，正在排盘');
        await wait(420);
        showReading(reading);
        updateProgress(6, '六爻已成');
      } else {
        updateProgress(position, `等待摇${CAST_POSITION_LABELS[position]}`);
      }
      setBusy(false);
    } catch (cause) {
      showError(cause);
      setBusy(false);
    }
  });

  replayButton.addEventListener('click', async () => {
    const random = lastRandomReading?.audit.random;
    if (!lastRandomReading || !random?.samples.length) return;
    try {
      const replayed = castCoins(
        { replay: random.samples },
        new Date(lastRandomReading.createdAt),
        lastRandomReading.input.question,
      );
      if (castMode !== 'auto') setMode('auto');
      else resetCeremony();
      pendingAutomaticReading = replayed;
      lastRandomReading = replayed;
      replayingAutomaticCast = true;
      resetCastButton.hidden = false;
      currentThrowText.textContent = '随机轨迹已载入，请点击六次逐爻重放。';
      clearError();
      syncControls();
    } catch (cause) {
      showError(cause);
      setBusy(false);
    }
  });

  historyButton.addEventListener('click', () => {
    renderHistoryList();
    historyDialog.showModal();
  });
  historyCloseButton.addEventListener('click', () => historyDialog.close());
  historyDialog.addEventListener('click', (event) => {
    if (event.target === historyDialog) historyDialog.close();
  });
  historyClearButton.addEventListener('click', () => {
    if (!window.confirm('清空当前浏览器中的全部六爻历史记录？此操作无法恢复。')) return;
    clearHistory(historyStorage);
    renderHistoryList();
  });

  resetCeremony(false);
  manualPanel.hidden = true;
  autoPanel.hidden = false;
  renderHistoryList();
  syncControls();
}
