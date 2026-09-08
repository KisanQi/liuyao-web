export const CALCULATION_TIME_ZONE = 'Asia/Shanghai' as const;
export const CALCULATION_UTC_OFFSET = '+08:00' as const;
export const DAY_BOUNDARY = '23:00' as const;
export const CALCULATION_OFFSET_MINUTES = 480 as const;

export interface EngineTimeContext {
  instant: Date;
  engineDate: Date;
  civilTime: string;
}

function requireValidDate(date: Date): void {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error('起卦时间无效。');
  }
}

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0');
}

function civilParts(date: Date): Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', string> {
  requireValidDate(date);
  const shifted = new Date(date.getTime() + CALCULATION_OFFSET_MINUTES * 60_000);
  return {
    year: pad(shifted.getUTCFullYear(), 4),
    month: pad(shifted.getUTCMonth() + 1),
    day: pad(shifted.getUTCDate()),
    hour: pad(shifted.getUTCHours()),
    minute: pad(shifted.getUTCMinutes()),
    second: pad(shifted.getUTCSeconds()),
  };
}

export function toEngineTime(instant: Date): EngineTimeContext {
  const parts = civilParts(instant);
  const civilTime = `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;

  // 六爻入口内部通过 TimeManager 按明确的 timezoneOffset 读取同一时间戳。
  // 不能在这里重建本机墙上时间，否则非 UTC+8 运行环境会产生二次偏移。
  const engineDate = new Date(instant.getTime());
  return { instant, engineDate, civilTime };
}

export function formatCivilTimeInput(instant: Date): string {
  const parts = civilParts(instant);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function parseCivilTimeInput(value: string): Date {
  const normalized = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/u.exec(normalized);
  if (!match) throw new Error('请提供有效的北京时间，精确到分钟。');

  const instant = new Date(`${normalized}:00${CALCULATION_UTC_OFFSET}`);
  requireValidDate(instant);
  if (formatCivilTimeInput(instant) !== normalized) {
    throw new Error('起卦时间超出有效日历范围。');
  }
  return instant;
}
