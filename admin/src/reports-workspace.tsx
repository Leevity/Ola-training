import { useState } from "react";
import { CheckCircle2, ClipboardCheck, ListChecks, Users } from "lucide-react";
import type { Audit, Task } from "./domain";
import { TaskReportPanel } from "./task-report-panel";
import { ReviewPanel } from "./review-panel";
import { Empty } from "./ui";

export function ReportsWorkspace({
  tasks,
  audit,
  canReview,
  canAudit = canReview,
  onRefresh,
}: {
  tasks: Task[];
  audit: Audit[];
  canReview: boolean;
  canAudit?: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [tab, setTab] = useState("tasks");
  const assigned = tasks.filter((t) => t.status === "published");
  const tabs = [
    ["tasks", "任务完成明细"],
    ...(canReview ? [["reviews", "待评记录"]] : []),
    ...(canAudit ? [["audit", "管理操作记录"]] : []),
  ];
  return (
    <div className="reports-workspace">
      <div className="report-metrics">
        {[
          {
            label: "已发布任务",
            value: assigned.length,
            unit: "项",
            Icon: ListChecks,
          },
          {
            label: "接收成员（去重）",
            value: new Set(assigned.flatMap((t) => t.memberIds)).size,
            unit: "人",
            Icon: Users,
          },
          {
            label: "已完成任务分配",
            value: assigned.reduce(
              (n, t) => n + t.completedMemberIds.length,
              0,
            ),
            unit: "人次",
            Icon: ClipboardCheck,
          },
        ].map(({ label, value, unit, Icon }) => (
          <section key={label}>
            <span className="metric-icon">
              <Icon size={21} />
            </span>
            <div>
              <p>{label}</p>
              <strong>
                {value}
                <small>{unit}</small>
              </strong>
            </div>
          </section>
        ))}
      </div>
      <nav className="workspace-tabs" aria-label="报告分类">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            aria-current={tab === id ? "page" : undefined}
            className={tab === id ? "selected" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "tasks" && (
        <TaskReportPanel tasks={tasks} onDataRefresh={onRefresh} />
      )}
      {tab === "reviews" && canReview && (
        <ReviewPanel onDataRefresh={onRefresh} />
      )}
      {tab === "audit" && canAudit && (
        <section className="surface">
          <div className="section-heading">
            <div>
              <h2>管理操作记录</h2>
              <p>当前企业的内容维护、分配与配置操作</p>
            </div>
          </div>
          {audit.length ? (
            <div className="audit-list">
              {audit.map((a) => (
                <div key={a.id}>
                  <span className="audit-icon">
                    <CheckCircle2 size={17} />
                  </span>
                  <div>
                    <strong>{a.action}</strong>
                    <p>{a.target}</p>
                  </div>
                  <time>
                    {new Date(a.at).toLocaleString("zh-CN", { hour12: false })}
                  </time>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="暂无操作记录"
              hint="维护课程、任务和企业资料后会记录在这里。"
            />
          )}
        </section>
      )}
    </div>
  );
}
