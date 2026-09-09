export type InactivityTimeoutHandler = (
  externalUserId: string,
) => Promise<void>;

type CancelScheduledTimeout = () => void;
type ScheduleTimeout = (
  callback: () => void,
  delayMs: number,
) => CancelScheduledTimeout;

function scheduleTimeout(
  callback: () => void,
  delayMs: number,
): CancelScheduledTimeout {
  const timeout = setTimeout(callback, delayMs);
  return () => clearTimeout(timeout);
}

interface ActiveTimeout {
  generation: number;
  cancel: CancelScheduledTimeout;
}

export class ConversationInactivityManager {
  private readonly activeTimeouts = new Map<string, ActiveTimeout>();
  private generation = 0;

  public constructor(
    private readonly onTimeout: InactivityTimeoutHandler,
    private readonly timeoutMs = 5 * 60 * 1000,
    private readonly schedule: ScheduleTimeout = scheduleTimeout,
  ) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new Error('timeoutMs must be greater than zero.');
    }
  }

  public touch(externalUserId: string): void {
    const id = externalUserId.trim();
    if (!id) {
      return;
    }

    this.cancel(id);

    const generation = ++this.generation;
    const cancel = this.schedule(() => {
      const active = this.activeTimeouts.get(id);
      if (!active || active.generation !== generation) {
        return;
      }

      this.activeTimeouts.delete(id);

      void this.onTimeout(id).catch((error: unknown) => {
        console.error(
          '[Conversation] Erro ao encerrar conversa por inatividade:',
          error,
        );
      });
    }, this.timeoutMs);

    this.activeTimeouts.set(id, { generation, cancel });
  }

  public cancel(externalUserId: string): void {
    const id = externalUserId.trim();
    const active = this.activeTimeouts.get(id);
    if (!active) {
      return;
    }

    active.cancel();
    this.activeTimeouts.delete(id);
  }

  public destroy(): void {
    for (const active of this.activeTimeouts.values()) {
      active.cancel();
    }

    this.activeTimeouts.clear();
  }
}
