import { useEffect, useRef, type ReactNode } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Inbox, X } from "lucide-react";
import { statusLabels, type Status } from "./domain";
export function Badge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`badge ${status}`}>
      {label || statusLabels[status as Status] || status}
    </span>
  );
}
export function Empty({
  title = "没有找到相关内容",
  hint = "调整筛选条件，或创建第一条记录。",
  action,
  onAction,
}: {
  title?: string;
  hint?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty">
      <Inbox size={36} />
      <h3>{title}</h3>
      <p>{hint}</p>
      {action && (
        <button className="button primary" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="title-actions">{children}</div>
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  wide?: boolean;
}) {
  return (
    <label className={`field ${wide ? "wide" : ""}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Modal({
  title,
  description,
  children,
  onClose,
  wide = false,
  footer,
  layout = "dialog",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  footer?: ReactNode;
  layout?: "dialog" | "workspace";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prior = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const nodes = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],summary,[tabindex="0"]',
          ) || [],
        ).filter((el) => el.getClientRects().length);
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (!ref.current?.contains(document.activeElement)) {
          e.preventDefault();
          (e.shiftKey ? last : first)?.focus();
          return;
        }
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      prior?.focus();
    };
  }, []);
  return (
    <div
      className={`modal-backdrop ${layout === "workspace" ? "editor-workspace-backdrop" : ""}`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`modal ${wide ? "wide-modal" : ""} ${layout === "workspace" ? "editor-workspace" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        ref={ref}
      >
        <header>
          <div>
            <h2 id="modal-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            className="icon-button"
            aria-label="关闭弹窗"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
}
export function Pagination({
  total,
  page,
  onPage,
  size = 6,
}: {
  total: number;
  page: number;
  onPage: (page: number) => void;
  size?: number;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  const visiblePages = pages <= 7
    ? Array.from({ length: pages }, (_, index) => index + 1)
    : [...new Set([1, pages, ...Array.from({ length: 3 }, (_, index) =>
        Math.max(2, Math.min(page - 1, pages - 3)) + index)])].sort((a, b) => a - b);
  return (
    <div className="pagination">
      <span>
        共 {total} 条记录 · 每页 {size} 条
      </span>
      <div>
        <button
          aria-label="上一页"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        {visiblePages.flatMap((number, index) => [
          ...(index > 0 && number - visiblePages[index - 1] > 1
            ? [<span key={`gap-${number}`} className="pagination-gap" aria-hidden="true">…</span>]
            : []),
          <button
            key={number}
            aria-label={`第 ${number} 页`}
            aria-current={page === number ? "page" : undefined}
            className={page === number ? "selected" : ""}
            onClick={() => onPage(number)}
          >
            {number}
          </button>,
        ])}
        <button
          aria-label="下一页"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="button" onClick={onClick}>
      <ArrowLeft size={16} />
      返回
    </button>
  );
}
export const displayDate = (v: string) =>
  new Date(v).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
