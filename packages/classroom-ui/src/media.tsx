import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  PPTImageElement,
  PPTAudioElement,
  PPTVideoElement,
} from "@openmaic/dsl";
type Failure = { kind: string; message: string };
const MediaContext = createContext<{
  versions: Record<string, number>;
  fail: (id: string, kind: string, message: string) => void;
  clear: (id: string) => void;
}>({ versions: {}, fail: () => {}, clear: () => {} });
export function MediaFeedback({ children }: { children: ReactNode }) {
  const [failures, setFailures] = useState<Record<string, Failure>>({}),
    [versions, setVersions] = useState<Record<string, number>>({});
  const fail = useCallback(
    (id: string, kind: string, message: string) =>
      setFailures((old) =>
        old[id]?.message === message
          ? old
          : { ...old, [id]: { kind, message } },
      ),
    [],
  );
  const clear = useCallback(
    (id: string) =>
      setFailures((old) => {
        if (!old[id]) return old;
        const next = { ...old };
        delete next[id];
        return next;
      }),
    [],
  );
  return (
    <MediaContext.Provider value={{ versions, fail, clear }}>
      {children}
      {Object.entries(failures).length > 0 && (
        <section className="maic-media-errors" aria-label="课件资源提示">
          {Object.entries(failures).map(([id, error]) => (
            <div key={id} className="maic-error" role="alert">
              <span>
                {error.kind}：{error.message}
              </span>
              <button
                type="button"
                onClick={() => {
                  clear(id);
                  setVersions((old) => ({ ...old, [id]: (old[id] || 0) + 1 }));
                }}
              >
                重试{error.kind}
              </button>
            </div>
          ))}
        </section>
      )}
    </MediaContext.Provider>
  );
}
export function ClassroomImage({
  element,
  src,
  content,
}: {
  element: PPTImageElement;
  src: string;
  content: ReactNode;
}) {
  const media = useContext(MediaContext),
    version = media.versions[element.id] || 0;
  useEffect(() => {
    if (!src) media.fail(element.id, "图片", "未提供可用地址，请联系管理员。");
  }, [src, element.id, media.fail]);
  return (
    <div
      style={{ width: "100%", height: "100%" }}
      onError={() =>
        media.fail(
          element.id,
          "图片",
          "加载失败，请检查网络或联系管理员确认访问权限。",
        )
      }
      onLoad={() => media.clear(element.id)}
    >
      <ImageContent key={`${src}:${version}`}>{content}</ImageContent>
    </div>
  );
}
function ImageContent({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
export function ClassroomAudio({ element }: { element: PPTAudioElement }) {
  const media = useContext(MediaContext);
  return (
    <AudioClip
      key={`${element.src}:${media.versions[element.id] || 0}`}
      element={element}
    />
  );
}
function AudioClip({ element }: { element: PPTAudioElement }) {
  const media = useContext(MediaContext),
    ref = useRef<HTMLAudioElement>(null),
    attempt = useRef(0);
  const [playing, setPlaying] = useState(false),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    const audio = ref.current;
    return () => {
      attempt.current++;
      audio?.pause();
    };
  }, []);
  const failure = () => {
    attempt.current++;
    ref.current?.pause();
    setPlaying(false);
    setLoading(false);
    media.fail(
      element.id,
      "音频",
      "无法播放，请检查网络、格式或访问权限后重试。",
    );
  };
  const toggle = async () => {
    const audio = ref.current;
    if (!audio) return;
    if (playing) {
      attempt.current++;
      audio.pause();
      setPlaying(false);
      return;
    }
    const current = ++attempt.current;
    setLoading(true);
    const timer = setTimeout(() => {
      if (attempt.current === current) failure();
    }, 15000);
    try {
      await audio.play();
      if (attempt.current !== current) {
        audio.pause();
        return;
      }
      setPlaying(true);
      media.clear(element.id);
    } catch (error) {
      if (attempt.current === current) {
        setPlaying(false);
        media.fail(
          element.id,
          "音频",
          (error as Error).name === "NotAllowedError"
            ? "浏览器或App暂未允许播放，请允许媒体播放后重试。"
            : "无法播放，请检查网络、格式或访问权限后重试。",
        );
      }
    } finally {
      clearTimeout(timer);
      if (attempt.current === current) setLoading(false);
    }
  };
  useEffect(() => {
    if (!element.src)
      media.fail(element.id, "音频", "未提供可用地址，请联系管理员。");
  }, [element.src, element.id, media.fail]);
  return (
    <>
      <audio
        ref={ref}
        src={element.src || undefined}
        preload="none"
        loop={element.loop}
        onError={failure}
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
      />
      <button
        className="maic-audio-button"
        type="button"
        aria-label={
          loading ? "正在加载音频" : playing ? "暂停音频" : "播放音频"
        }
        aria-pressed={playing}
        disabled={!element.src || loading}
        onClick={() => void toggle()}
        style={{
          transform: `translate(-50%,-50%) rotate(${element.rotate}deg)`,
        }}
      >
        {loading ? "…" : playing ? "Ⅱ" : "▶"}
      </button>
    </>
  );
}
export function ClassroomVideo({ element }: { element: PPTVideoElement }) {
  const media = useContext(MediaContext);
  useEffect(() => {
    if (!element.src)
      media.fail(
        element.id,
        "视频",
        element.poster
          ? "当前仅有预览图，缺少可播放视频，请联系管理员。"
          : "未提供可用地址，请联系管理员。",
      );
  }, [element.src, element.poster, element.id, media.fail]);
  return (
    <video
      key={`${element.src}:${media.versions[element.id] || 0}`}
      aria-label="课程视频"
      src={element.src || undefined}
      poster={element.poster}
      controls={!!element.src}
      playsInline
      preload="metadata"
      style={{ width: "100%", height: "100%", objectFit: "contain" }}
      onLoadedData={() => media.clear(element.id)}
      onError={() =>
        media.fail(
          element.id,
          "视频",
          "加载失败或格式不受支持，请检查网络或联系管理员。",
        )
      }
    />
  );
}
export const renderClassroomImage = (
  element: PPTImageElement,
  src: string,
  content: ReactNode,
) => <ClassroomImage element={element} src={src} content={content} />;
export const renderClassroomAudio = (element: PPTAudioElement) => (
  <ClassroomAudio element={element} />
);
export const renderClassroomVideo = (element: PPTVideoElement) => (
  <ClassroomVideo element={element} />
);
