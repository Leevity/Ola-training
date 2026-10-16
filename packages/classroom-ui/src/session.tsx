import { registerLeaveGuard } from "../../../shared/navigation-guard";
import { useEffect, useRef, useState } from "react";
import { ScenePlayer, type SceneState } from "./player";
import * as api from "@ola/learner-client";
import { SceneWriter } from "./scene-writer";
function Loading() {
  return (
    <p role="status" className="maic-hint">
      正在加载课堂记录…
    </p>
  );
}
export function ClassroomSession({
  courseId,
  version,
  sceneId,
  scene,
  onReadyChange,
}: {
  courseId: string;
  version: number;
  sceneId: string;
  scene: unknown;
  onReadyChange?: (ready: boolean) => void;
}) {
  const [runtime, setRuntime] = useState<api.SceneRuntime | null>(null),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [canRetry, setCanRetry] = useState(false);
  const writer = useRef<SceneWriter | null>(null),
    latest = useRef<SceneState | null>(null),
    saved = useRef<SceneState | null>(null),
    active = useRef(true),
    unsubscribe = useRef<(() => void) | undefined>(undefined);
  const loadSequence = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const changed = () =>
    JSON.stringify(latest.current) !== JSON.stringify(saved.current);
  const load = async () => {
    const sequence = ++loadSequence.current;
    setError("");
    setBusy(true);
    onReadyChange?.(false);
    try {
      const value = await api.sceneRuntime(courseId, version, sceneId);
      if (!active.current || sequence !== loadSequence.current) return;
      unsubscribe.current?.();
      latest.current = value.state;
      saved.current = value.state;
      writer.current = new SceneWriter(value, (attempt) =>
        api.saveSceneRuntime(
          courseId,
          version,
          sceneId,
          attempt.revision,
          attempt.state,
          attempt.eventId,
        ),
      );
      unsubscribe.current = writer.current.subscribe(() => {
        if (!active.current) return;
        const state = writer.current!.status;
        setError(state.error?.message || "");
        setCanRetry(state.canRetry);
        if (state.synchronized && !timer.current) {
          saved.current = structuredClone(latest.current);
          setStatus("课堂记录已保存");
          onReadyChange?.(true);
        } else {
          setStatus(state.error ? "有未保存的课堂记录" : "正在保存课堂记录…");
          onReadyChange?.(false);
        }
      });
      setRuntime(value);
      setCanRetry(false);
      setStatus("课堂记录已同步");
      onReadyChange?.(true);
    } catch (e) {
      if (active.current && sequence === loadSequence.current)
        setError((e as Error).message);
    } finally {
      if (active.current && sequence === loadSequence.current) setBusy(false);
    }
  };
  const flush = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = undefined;
      if (latest.current) void writer.current?.save(latest.current);
    }
  };
  useEffect(() => {
    active.current = true;
    void load();
    const beforeUnload = (event: BeforeUnloadEvent) => {
      flush();
      if (changed() || writer.current?.status.error) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const removeLeaveGuard = registerLeaveGuard(() => {
      flush();
      if (!changed() && !writer.current?.status.error) return true;
      return window.confirm(
        "课堂还有未保存内容。离开可能丢失当前文字和答题记录，建议先重试保存。仍要离开？",
      );
    });
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      removeLeaveGuard();
      active.current = false;
      loadSequence.current++;
      flush();
      unsubscribe.current?.();
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  const save = (state: SceneState) => {
    latest.current = state;
    onReadyChange?.(false);
    setRuntime((current) => (current ? { ...current, state } : current));
    setStatus("正在保存课堂记录…");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = undefined;
      void writer.current?.save(state);
    }, 350);
  };
  if (!runtime)
    return error ? (
      <div role="alert" className="maic-error">
        <p>{error}</p>
        <button disabled={busy} onClick={() => void load()}>
          重试
        </button>
      </div>
    ) : (
      <Loading />
    );
  return (
    <>
      <div className="maic-feedback" role="status">
        {status}
      </div>
      {error && (
        <div className="maic-error" role="alert">
          <p>{error}</p>
          {canRetry && (
            <button
              className="maic-primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                flush();
                await writer.current?.retry();
                if (active.current) setBusy(false);
              }}
            >
              保留当前内容并重试保存
            </button>
          )}
          <button
            disabled={busy}
            onClick={async () => {
              if (
                changed() &&
                !window.confirm(
                  "重新加载会替换当前未保存内容。请先保留文字，确认继续？",
                )
              )
                return;
              setBusy(true);
              await writer.current?.drain();
              await load();
            }}
          >
            重新加载已保存记录
          </button>
          {Object.values(runtime.state.notes).some(Boolean) && (
            <label>
              未保存的反思（可选中复制）
              <textarea
                readOnly
                rows={4}
                value={Object.values(runtime.state.notes).join("\n\n")}
              />
            </label>
          )}
          <p>
            未保存内容仍保留在本页。若另一设备已更新记录，请先保留文字，再重新加载；断网时可恢复网络后重试。
          </p>
        </div>
      )}
      <ScenePlayer
        scene={scene}
        state={runtime.state}
        onStateChange={save}
        disabled={Boolean(error) || busy}
      />
    </>
  );
}
