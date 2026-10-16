import { randomId } from '../../../shared/random-id.ts';
import type { SceneState } from "../../../shared/classroom.ts";
type Runtime = { revision: number; state: SceneState };
type Attempt = { revision: number; state: SceneState; eventId: string };
type Save = (attempt: Attempt) => Promise<Runtime>;
/** Preserve the exact event after an uncertain response; the server deduplicates it. */
export class SceneWriter {
  private revision: number;
  private saved: SceneState;
  private latest: SceneState;
  private queued?: SceneState;
  private attempt?: Attempt;
  private failure?: Error;
  private running?: Promise<boolean>;
  private listeners = new Set<() => void>();
  constructor(
    runtime: Runtime,
    private send: Save,
  ) {
    this.revision = runtime.revision;
    this.saved = structuredClone(runtime.state);
    this.latest = structuredClone(runtime.state);
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private emit() {
    for (const listener of this.listeners) listener();
  }
  get status() {
    const code = (this.failure as { status?: number } | undefined)?.status;
    return {
      error: this.failure,
      canRetry:
        !!this.failure &&
        (code === undefined || code >= 500 || code === 408 || code === 429),
      synchronized:
        !this.failure &&
        !this.running &&
        !this.queued &&
        !this.attempt &&
        JSON.stringify(this.saved) === JSON.stringify(this.latest),
    };
  }
  save(state: SceneState) {
    this.latest = structuredClone(state);
    this.queued = structuredClone(state);
    this.emit();
    return this.run();
  }
  retry() {
    if (!this.status.canRetry) return Promise.resolve(false);
    this.failure = undefined;
    return this.run();
  }
  drain() {
    return this.running || Promise.resolve(this.status.synchronized);
  }
  private run(): Promise<boolean> {
    if (this.running) return this.running;
    if (this.failure) return Promise.resolve(false);
    this.running = (async () => {
      while (this.attempt || this.queued) {
        if (!this.attempt) {
          this.attempt = {
            revision: this.revision,
            state: this.queued!,
            eventId: randomId(),
          };
          this.queued = undefined;
        }
        try {
          const result = await this.send(this.attempt);
          this.revision = result.revision;
          this.saved = structuredClone(this.attempt.state);
          this.attempt = undefined;
        } catch (error) {
          this.failure = error as Error;
          break;
        }
      }
      return !this.failure;
    })().finally(() => {
      this.running = undefined;
      this.emit();
    });
    this.emit();
    return this.running;
  }
}
