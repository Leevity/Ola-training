import { useEffect, useState } from "react";
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
  const [id, setId] = useState(
      tasks.find((t) => t.status === "published")?.id || "",
    ),
    [offset, setOffset] = useState(0),
    [report, setReport] = useState<any>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!id) {
      setReport(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    api
      .taskReport(id, offset)
      .then(async (value) => {
        if (active) {
          setReport(value);
          await onDataRefresh?.();
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
  return (
    <section className="surface" aria-label="任务成员完成明细">
      <div className="section-heading">
        <div>
          <h2>任务成员完成明细</h2>
          <p>按任务冻结的课程版本统计，课堂记录与正式成绩分别显示。</p>
        </div>
        <div className="title-actions">
          <button
            className="button"
            disabled={loading || exporting || !id}
            onClick={async () => {
              setExporting(true);
              setError("");
              try {
                const blob = await api.exportTaskReport(id);
                downloadBlob(blob, `任务学习明细-${id}.csv`);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setExporting(false);
              }
            }}
          >
            <ArrowDownToLine size={16} />
            {exporting ? "正在导出…" : "导出任务学习明细"}
          </button>
          <button
            className="button"
            disabled={loading || exporting || !id}
            onClick={() => setRefresh((v) => v + 1)}
          >
            <RefreshCw size={16} />
            刷新明细
          </button>
        </div>
      </div>
      <label className="field" style={{ maxWidth: 480, marginBottom: 18 }}>
        <span>查看任务</span>
        <select
          disabled={exporting}
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
      {loading ? (
        <p role="status">正在读取成员学习记录…</p>
      ) : report ? (
        <>
          <p className="muted info-line">
            当前可见成员 {report.total} 人 · 已记录任务完成 {report.completed}{" "}
            人
          </p>
          {report.items.length ? (
            <div className="table-scroll">
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
            <span>共 {report.total} 人</span>
            <div>
              <button
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - 30))}
              >
                上一页
              </button>
              <button
                disabled={offset + report.items.length >= report.total}
                onClick={() => setOffset(offset + 30)}
              >
                下一页
              </button>
            </div>
          </div>
        </>
      ) : (
        !error && (
          <Empty
            title="选择一个已发布任务"
            hint="查看指定成员的真实学习完成情况。"
          />
        )
      )}
    </section>
  );
}
