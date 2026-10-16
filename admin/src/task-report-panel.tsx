import { useEffect, useRef, useState } from "react";
import { downloadBlob } from "./storage";
import { RefreshCw, ArrowDownToLine } from "lucide-react";
import type { Task } from "./domain";
import * as api from "./api";
import { Empty } from "./ui";
export function TaskReportPanel({
  tasks,
  onDataRefresh,
}: {
  tasks: Task[];
  onDataRefresh?: () => Promise<void>;
}) {
  const [exporting, setExporting] = useState(false);
  const exportingRef = useRef(false), syncingRef = useRef(false);
  const panelRef = useRef<HTMLElement>(null);
  const [exportError, setExportError] = useState("");
  const [syncError, setSyncError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [readAt, setReadAt] = useState("");
  const [id, setId] = useState(
      tasks.find((t) => t.status === "published")?.id || tasks.find((t) => t.status !== "draft")?.id || "",
    ),
    [offset, setOffset] = useState(0),
    [report, setReport] = useState<any>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (id && !tasks.some((task) => task.id === id && task.status !== "draft")) {
      setId("");
      setOffset(0);
    }
  }, [tasks, id]);
  useEffect(() => {
    setError("");
    setExportError("");
    setSyncError("");
    setReport(null);
    if (!id) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    api
      .taskReport(id, offset)
      .then(async (value) => {
        if (active) {
          setReport(value);
          setReadAt(new Date().toLocaleString("zh-CN"));
          try { await onDataRefresh?.(); }
          catch { if (active) setSyncError("明细已读取，但任务摘要同步失败。可重试同步，当前明细仍可查看。"); }
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, offset, refresh]);
  const reload = () => { panelRef.current?.focus(); setRefresh(value => value + 1); };
  const retrySync = async () => {
    if (syncingRef.current) return;
    syncingRef.current = true; setSyncing(true);
    panelRef.current?.focus();
    try { await onDataRefresh?.(); setSyncError(""); }
    catch { setSyncError("明细已读取，但任务摘要同步失败。可重试同步，当前明细仍可查看。"); }
    finally { syncingRef.current = false; setSyncing(false); }
  };
  return (
    <section ref={panelRef} tabIndex={-1} className="surface" aria-label="任务成员完成明细">
      <div className="section-heading">
        <div>
          <h2>任务成员完成明细</h2>
          <p>按任务冻结的课程版本统计，课堂记录与正式成绩分别显示。</p>
        </div>
        <div className="title-actions">
          <button
            className="button"
            disabled={loading || exporting || syncing || !id}
            onClick={async () => {
              if (exportingRef.current) return;
              exportingRef.current = true;
              panelRef.current?.focus();
              setExporting(true);
              setExportError("");
              try {
                const blob = await api.exportTaskReport(id);
                downloadBlob(blob, `任务学习明细-${id}.csv`);
              } catch (e) {
                setExportError((e as Error).message);
              } finally {
                exportingRef.current = false;
                setExporting(false);
              }
            }}
          >
            <ArrowDownToLine size={16} />
            {exporting ? "正在导出…" : "导出任务学习明细"}
          </button>
          <button
            className="button"
            disabled={loading || exporting || syncing || !id}
            onClick={reload}
          >
            <RefreshCw size={16} />
            刷新明细
          </button>
        </div>
      </div>
      <label className="field" style={{ maxWidth: 480, marginBottom: 18 }}>
        <span>查看任务</span>
        <select
          disabled={exporting || syncing}
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            setOffset(0);
            setReport(null);
          }}
        >
          <option value="">选择任务</option>
          {tasks
            .filter((t) => t.status !== "draft")
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
        </select>
      </label>
      {error && (
        <div role="alert" className="error-message">
          {error}
        </div>
      )}
      {exportError && <div role="alert" className="error-message"><p>导出失败：{exportError}</p><p>可重试导出，当前明细仍可查看。</p></div>}
      {syncError && <div role="alert" className="error-message"><p>{syncError}</p><button className="button" disabled={syncing} onClick={() => void retrySync()}>{syncing ? "正在同步…" : "重试同步任务摘要"}</button></div>}
      {loading ? (
        <p role="status">正在读取成员学习记录…</p>
      ) : error ? <div className="report-recovery"><Empty title="学习明细读取失败" hint="当前任务的学习明细未能读取，请检查连接后重试。" action="重试读取明细" onAction={reload}/>{offset > 0 && <button className="button" onClick={() => {panelRef.current?.focus();setOffset(0);}}>返回第一页</button>}</div> : report ? (
        <>
          <p className="muted info-line">
            当前可见成员 {report.total} 人 · 已记录任务完成 {report.completed}{" "}
            人
            {readAt && <> · 最近读取：{readAt}</>}
          </p>
          {report.items.length ? (
            <div className="table-scroll" tabIndex={0} role="region" aria-label="任务学习明细表格">
              <table>
                <thead>
                  <tr>
                    <th>成员 / 部门</th>
                    <th>课程完成情况</th>
                    <th>任务状态</th>
                    <th>最后学习活动</th>
                  </tr>
                </thead>
                <tbody>
                  {report.items.map((member: any) => (
                    <tr key={member.memberId}>
                      <td>
                        <strong>{member.name}</strong>
                        <p className="muted">
                          {member.employeeNo} · {member.department}
                        </p>
                      </td>
                      <td>
                        <details>
                          <summary>
                            {member.completedCourses} / {member.totalCourses}{" "}
                            门课程完成
                          </summary>
                          {member.stages.map((stage: any) => (
                            <div
                              className="report-stage"
                              key={`${stage.courseId}:${stage.version}`}
                            >
                              <strong>
                                {stage.title} · v{stage.version}
                              </strong>
                              <p>
                                {stage.completed
                                  ? "已完成"
                                  : stage.pendingReview
                                    ? "待人工评价"
                                    : "未完成"}
                                {stage.kind === "learn"
                                  ? ` · ${stage.completedLessons}/${stage.totalLessons} 课时`
                                  : stage.score !== null
                                    ? ` · ${stage.score} 分`
                                    : ""}
                              </p>
                            </div>
                          ))}
                        </details>
                      </td>
                      <td>{member.completed ? "已完成" : "未完成"}</td>
                      <td>
                        {member.lastActivity
                          ? new Date(member.lastActivity).toLocaleString(
                              "zh-CN",
                            )
                          : "暂无记录"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="暂无接收成员"
              hint="此任务没有当前可查看的成员记录。"
            />
          )}
          <div className="pagination">
            <span>共 {report.total} 人{report.items.length > 0 ? ` · 第 ${offset + 1}–${offset + report.items.length} 条` : ""}</span>
            <div>
              <button
                disabled={loading || exporting || syncing || offset === 0}
                onClick={() => {panelRef.current?.focus();setOffset(Math.max(0, offset - 30));}}
              >
                上一页
              </button>
              <button
                disabled={loading || exporting || syncing || offset + report.items.length >= report.total}
                onClick={() => {panelRef.current?.focus();setOffset(offset + 30);}}
              >
                下一页
              </button>
            </div>
          </div>
        </>
      ) : (
        !error && (
          <Empty
            title={tasks.some(task => task.status !== 'draft') ? "选择一个任务" : "暂无可查看的任务"}
            hint={tasks.some(task => task.status !== 'draft') ? "选择已发布或已归档任务，查看成员的学习完成情况。" : "任务发布并分配后，可在这里查看成员的学习完成情况。"}
          />
        )
      )}
    </section>
  );
}
