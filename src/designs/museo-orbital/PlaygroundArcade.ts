export const PLAYGROUND_WORD = 'ASTROINGENIERÍA';
export const PLAYGROUND_LIMIT_MS = 90_000;
export const PLAYGROUND_COMBO_MS = 6_000;
export const PLAYGROUND_LETTER_HP = 30;
export const PLAYGROUND_RAPID_LETTER_HP = 36;
export const PLAYGROUND_BASE_DAMAGE = 20;
export const PLAYGROUND_RAPID_DAMAGE = 3;
export const PLAYGROUND_RAPID_FIRE_INTERVAL = 1 / 9;

export type PlaygroundWeaponAffinity = 'charged' | 'rapid';
export type PlaygroundControlMode = 'pulsar' | 'comet';

export interface PlaygroundProgress {
  destroyed: number;
  total: number;
  phase: 'active' | 'complete' | 'timed-out';
  elapsedMs: number;
  score: number;
  combo: number;
  bestCombo: number;
  controlMode: PlaygroundControlMode;
}

export const playgroundBounceMultiplier = (bounceCount: number) =>
  bounceCount <= 0 ? 1 : Math.min(25, bounceCount * 5);

export const playgroundDamageBudget = (launchPower: number, bounceCount: number) =>
  PLAYGROUND_BASE_DAMAGE * Math.max(0, Math.min(1, launchPower)) * playgroundBounceMultiplier(bounceCount);

// Budgets are measured before affinity, so piercing never creates extra damage.
export const playgroundHitDamage = (
  hp: number,
  remainingBudget: number,
  weapon: PlaygroundWeaponAffinity,
  affinity: PlaygroundWeaponAffinity,
) => {
  const efficiency = weapon === affinity ? 1 : 0.5;
  const damage = Math.min(Math.max(0, hp), Math.max(0, remainingBudget) * efficiency);
  return { damage, spent: damage / efficiency };
};

export class PlaygroundArcade {
  private startedAt: number | null = null;
  private lastDestroyedAt: number | null = null;
  private destroyedIds = new Set<number>();
  private state: PlaygroundProgress;

  constructor(controlMode: PlaygroundControlMode) {
    this.state = {
      destroyed: 0, total: PLAYGROUND_WORD.length, phase: 'active',
      elapsedMs: 0, score: 0, combo: 1, bestCombo: 1, controlMode,
    };
  }

  start(nowMs: number) {
    if (this.startedAt === null && this.state.phase === 'active') this.startedAt = nowMs;
  }

  tick(nowMs: number) {
    if (this.startedAt === null || this.state.phase !== 'active') return;
    this.state.elapsedMs = Math.min(PLAYGROUND_LIMIT_MS, Math.max(this.state.elapsedMs, nowMs - this.startedAt));
    if (this.state.elapsedMs >= PLAYGROUND_LIMIT_MS) {
      this.state.phase = 'timed-out';
    } else if (this.lastDestroyedAt !== null && nowMs - this.lastDestroyedAt > PLAYGROUND_COMBO_MS) {
      this.state.combo = 1;
    }
  }

  destroy(id: number, rebounded: boolean, nowMs: number) {
    this.tick(nowMs);
    if (this.startedAt === null || this.state.phase !== 'active' || this.destroyedIds.has(id)) return false;
    this.state.combo = this.lastDestroyedAt !== null && nowMs - this.lastDestroyedAt <= PLAYGROUND_COMBO_MS
      ? Math.min(5, this.state.combo + 1) : 1;
    this.lastDestroyedAt = nowMs;
    this.destroyedIds.add(id);
    this.state.destroyed = this.destroyedIds.size;
    this.state.bestCombo = Math.max(this.state.bestCombo, this.state.combo);
    this.state.score += 100 * this.state.combo + (rebounded ? 50 : 0);
    if (this.state.destroyed === this.state.total) {
      this.state.phase = 'complete';
      this.state.score += Math.floor((PLAYGROUND_LIMIT_MS - this.state.elapsedMs) / 1000) * 10;
    }
    return true;
  }

  snapshot(): PlaygroundProgress { return { ...this.state }; }
}

export interface PlaygroundRecord {
  id: string;
  durationMs: number;
  score: number;
  bestCombo: number;
  completedAt: string;
  controlMode: PlaygroundControlMode;
}

export const playgroundRecordsKey = (mode: PlaygroundControlMode) => `mo-playground-arcade-records-v2-${mode}`;

export const rankPlaygroundRecords = (records: PlaygroundRecord[]) =>
  [...records].sort((a, b) => b.score - a.score || a.durationMs - b.durationMs).slice(0, 10);

export const parsePlaygroundRecords = (raw: string | null, mode: PlaygroundControlMode): PlaygroundRecord[] => {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return rankPlaygroundRecords(parsed.filter((entry): entry is PlaygroundRecord => {
      if (!entry || typeof entry !== 'object') return false;
      const record = entry as Partial<PlaygroundRecord>;
      return typeof record.id === 'string' && typeof record.completedAt === 'string' && record.controlMode === mode &&
        typeof record.durationMs === 'number' && Number.isFinite(record.durationMs) && record.durationMs > 0 && record.durationMs < PLAYGROUND_LIMIT_MS &&
        typeof record.score === 'number' && Number.isSafeInteger(record.score) && record.score >= 0 &&
        typeof record.bestCombo === 'number' && Number.isInteger(record.bestCombo) && record.bestCombo >= 1 && record.bestCombo <= 5;
    }));
  } catch { return []; }
};
