import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, RefreshCw, X } from 'lucide-react';
export function Loading({ text = '正在加载学习内容' }: { text?: string }) {
  return (
    <div className="state-panel" role="status">
      <Loader2 className="spin" size={28} />
      <strong>{text}</strong>
      <p>请稍候</p>
    </div>
  );
}
export function Empty({
  title,
  hint,
  action,
  onAction,
}: {
  title: string;
  hint: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="state-panel">
      <CheckCircle2 size={36} />
      <strong>{title}</strong>
      <p>{hint}</p>
      {action && (
        <button className="btn" onClick={onAction}>
          {action}
          <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}
export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="state-panel error-state" role="alert">
      <strong>暂时无法加载</strong>
      <p>{message}</p>
      <button className="btn" onClick={retry}>
        <RefreshCw size={16} />
        重新加载
      </button>
    </div>
  );
}
export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <i style={{ width: Math.min(100, Math.max(0, value)) + '%' }} />
    </div>
  );
}
export function PageTitle({
  title,
  description,
  children,
  back,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  back?: () => void;
}) {
  return (
    <div className="page-title">
      <div>
        {back && (
          <button className="back-link" onClick={back}>
            <ArrowLeft size={15} />
            返回
          </button>
        )}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="title-actions">{children}</div>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  footer,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement;
    const firstControl = ref.current?.querySelector<HTMLElement>(
      'button:not(:disabled),input,textarea,select,a[href]',
    );
    if (firstControl) firstControl.focus();
    else ref.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
      if (e.key === 'Tab') {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,textarea,select,a[href]',
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      before?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <header>
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="关闭弹窗" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
}
export function Cover({ src }: { src: string }) {
  return (
    <div className="cover">
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={(e) => {
          if (!e.currentTarget.src.endsWith('/assets/course-prompting.webp'))
            e.currentTarget.src = '/assets/course-prompting.webp';
        }}
      />
    </div>
  );
}
