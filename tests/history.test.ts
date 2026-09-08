import { describe, expect, test } from 'vitest';
import {
  HISTORY_LIMIT,
  HISTORY_STORAGE_KEY,
  clearHistory,
  loadHistory,
  removeHistoryEntry,
  saveAiToHistory,
  saveReadingToHistory,
  type HistoryStorage,
} from '../src/domain/liuyao/history';
import type { LiuyaoReading } from '../src/domain/liuyao/types';

class MemoryStorage implements HistoryStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function reading(id: string, question = `问题 ${id}`): LiuyaoReading {
  return {
    createdAt: '2026-09-02T08:00:00.000Z',
    input: { values: [7, 8, 7, 8, 7, 8], question: { text: question } },
    audit: { resultId: id },
  } as LiuyaoReading;
}

describe('本机历史记录', () => {
  test('保存完整排盘并按最近更新时间排序，同一结果不重复', () => {
    const storage = new MemoryStorage();
    expect(saveReadingToHistory(storage, reading('case-a'), '2026-09-02T08:00:00.000Z')).toBe(true);
    expect(saveReadingToHistory(storage, reading('case-b'), '2026-09-02T09:00:00.000Z')).toBe(true);
    expect(saveReadingToHistory(storage, reading('case-a', '更新后的问题'), '2026-09-02T10:00:00.000Z')).toBe(true);

    const entries = loadHistory(storage);
    expect(entries.map((entry) => entry.id)).toEqual(['case-a', 'case-b']);
    expect(entries[0]?.reading.input.question.text).toBe('更新后的问题');
  });

  test('保存 AI 解读与追问，并支持删除和清空', () => {
    const storage = new MemoryStorage();
    saveReadingToHistory(storage, reading('case-a'));
    expect(saveAiToHistory(storage, 'case-a', {
      model: 'claude-fable-5-1',
      resultId: 'case-a',
      interpretation: {
        directAnswer: '可以继续观察。',
        tendencyLabel: '有条件推进',
        evidenceStrength: '中',
        keyReasons: ['条件一'],
        mainUncertainty: '外部进度',
        realityChecks: ['观察节点'],
        professionalBasis: '专业依据',
        boundary: '仅供参考',
      },
      followUps: [{ question: '最需要注意什么？', answer: '注意现实节点。' }],
    })).toBe(true);
    expect(loadHistory(storage)[0]?.ai?.followUps).toHaveLength(1);

    expect(removeHistoryEntry(storage, 'case-a')).toBe(true);
    expect(loadHistory(storage)).toEqual([]);
    saveReadingToHistory(storage, reading('case-b'));
    expect(clearHistory(storage)).toBe(true);
    expect(storage.getItem(HISTORY_STORAGE_KEY)).toBeNull();
  });

  test('损坏数据会被忽略，并只保留最近三十条', () => {
    const storage = new MemoryStorage();
    storage.setItem(HISTORY_STORAGE_KEY, '{broken');
    expect(loadHistory(storage)).toEqual([]);

    for (let index = 0; index < HISTORY_LIMIT + 3; index += 1) {
      saveReadingToHistory(
        storage,
        reading(`case-${index}`),
        new Date(Date.UTC(2026, 8, 2, 0, index)).toISOString(),
      );
    }
    expect(loadHistory(storage)).toHaveLength(HISTORY_LIMIT);
    expect(loadHistory(storage)[0]?.id).toBe(`case-${HISTORY_LIMIT + 2}`);
  });
});
