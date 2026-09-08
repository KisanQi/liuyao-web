import type { AiInterpretation } from './ai-contract';
import type { AiFollowUpExchange } from './ai-client';
import type { LiuyaoReading } from './types';

export const HISTORY_STORAGE_KEY = 'liuyao.history.v1';
export const HISTORY_LIMIT = 30;

export interface HistoryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface HistoryAiSnapshot {
  interpretation: AiInterpretation;
  model: string;
  resultId: string;
  followUps: AiFollowUpExchange[];
}

export interface LiuyaoHistoryEntry {
  id: string;
  createdAt: string;
  updatedAt: string;
  reading: LiuyaoReading;
  ai?: HistoryAiSnapshot;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isHistoryEntry(value: unknown): value is LiuyaoHistoryEntry {
  if (!isRecord(value) || typeof value.id !== 'string') return false;
  if (typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') return false;
  if (!isRecord(value.reading) || !isRecord(value.reading.audit) || !isRecord(value.reading.input)) return false;
  if (value.reading.audit.resultId !== value.id) return false;
  if (!Array.isArray(value.reading.input.values) || value.reading.input.values.length !== 6) return false;
  return isRecord(value.reading.input.question) && typeof value.reading.input.question.text === 'string';
}

function newestFirst(entries: LiuyaoHistoryEntry[]): LiuyaoHistoryEntry[] {
  return entries
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, HISTORY_LIMIT);
}

export function loadHistory(storage: HistoryStorage | null): LiuyaoHistoryEntry[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return newestFirst(parsed.filter(isHistoryEntry));
  } catch {
    return [];
  }
}

function writeHistory(storage: HistoryStorage | null, entries: LiuyaoHistoryEntry[]): boolean {
  if (!storage) return false;
  try {
    storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(newestFirst(entries)));
    return true;
  } catch {
    return false;
  }
}

export function saveReadingToHistory(
  storage: HistoryStorage | null,
  reading: LiuyaoReading,
  now = new Date().toISOString(),
): boolean {
  const previous = loadHistory(storage);
  const existing = previous.find((entry) => entry.id === reading.audit.resultId);
  const next: LiuyaoHistoryEntry = {
    id: reading.audit.resultId,
    createdAt: reading.createdAt,
    updatedAt: now,
    reading,
    ...(existing?.ai ? { ai: existing.ai } : {}),
  };
  return writeHistory(storage, [next, ...previous.filter((entry) => entry.id !== next.id)]);
}

export function saveAiToHistory(
  storage: HistoryStorage | null,
  historyId: string,
  ai: HistoryAiSnapshot,
  now = new Date().toISOString(),
): boolean {
  const entries = loadHistory(storage);
  const target = entries.find((entry) => entry.id === historyId);
  if (!target) return false;
  const updated: LiuyaoHistoryEntry = { ...target, updatedAt: now, ai };
  return writeHistory(storage, [updated, ...entries.filter((entry) => entry.id !== historyId)]);
}

export function removeHistoryEntry(storage: HistoryStorage | null, historyId: string): boolean {
  return writeHistory(storage, loadHistory(storage).filter((entry) => entry.id !== historyId));
}

export function clearHistory(storage: HistoryStorage | null): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(HISTORY_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
