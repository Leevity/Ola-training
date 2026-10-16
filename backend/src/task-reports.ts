import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Database } from "./db.ts";
import { requireTenant } from "./auth.ts";
import { forbidden, missing, HttpError } from "./errors.ts";
import { id } from "./schemas.ts";
import { iso } from "./store.ts";

export async function registerTaskReports(app: FastifyInstance, db: Database) {
  const readReport = async (req: FastifyRequest, exporting = false) => {
    const a = requireTenant(req);
    if (!["企业管理员", "部门管理员"].includes(a.role)) throw forbidden();
    const taskId = id.parse((req.params as any).id),
      pagination = exporting
        ? { limit: 10000, offset: 0 }
        : z
            .object({
              limit: z.coerce.number().int().min(1).max(100).default(30),
              offset: z.coerce.number().int().min(0).max(100000).default(0),
            })
            .parse(req.query);
    return db.transaction(async (tx) => {
      await tx.query(
        "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY",
      );
      const task = (
        await tx.query(
          "SELECT *,due_date::text AS due_text FROM tasks WHERE tenant_id=$1 AND id=$2",
          [a.tenantId, taskId],
        )
      ).rows[0];
      if (!task) throw missing();
      const scopedDepartment = a.role === "部门管理员" ? a.department : null;
      const scope = [a.tenantId, taskId, scopedDepartment];
      const counts = (
        await tx.query(
          "SELECT count(*)::int AS total,count(x.completed_at)::int AS completed FROM assignments x JOIN members m ON m.tenant_id=x.tenant_id AND m.id=x.member_id WHERE x.tenant_id=$1 AND x.task_id=$2 AND ($3::text IS NULL OR m.department=$3)",
          scope,
        )
      ).rows[0];
      if (scopedDepartment && counts.total === 0) throw missing();
      if (exporting && counts.total > 10000)
        throw new HttpError(
          413,
          "REPORT_TOO_LARGE",
          "任务超过1万名可见成员，请拆分任务后导出",
        );
      const members = (
        await tx.query(
          "SELECT m.id,m.name,m.employee_no,m.department,m.active,x.completed_at FROM assignments x JOIN members m ON m.tenant_id=x.tenant_id AND m.id=x.member_id WHERE x.tenant_id=$1 AND x.task_id=$2 AND ($3::text IS NULL OR m.department=$3) ORDER BY m.employee_no LIMIT $4 OFFSET $5",
          [...scope, pagination.limit, pagination.offset],
        )
      ).rows;
      const versions = (
        await tx.query(
          "SELECT i.course_id,i.course_version,i.position,v.content FROM task_items i LEFT JOIN course_versions v ON v.tenant_id=i.tenant_id AND v.course_id=i.course_id AND v.version=i.course_version WHERE i.tenant_id=$1 AND i.task_id=$2 ORDER BY i.position",
          [a.tenantId, taskId],
        )
      ).rows;
      const memberIds = members.map((m) => m.id);
      const progress = (
        await tx.query(
          "SELECT p.* FROM learning_progress p JOIN task_items i ON i.tenant_id=p.tenant_id AND i.course_id=p.course_id AND i.course_version=p.course_version WHERE p.tenant_id=$1 AND p.member_id=ANY($2::text[]) AND i.task_id=$3",
          [a.tenantId, memberIds, taskId],
        )
      ).rows;
      const runtime = (
        await tx.query(
          "SELECT r.member_id,r.course_id,r.course_version,max(r.updated_at) AS updated_at FROM classroom_runtime r JOIN task_items i ON i.tenant_id=r.tenant_id AND i.course_id=r.course_id AND i.course_version=r.course_version WHERE r.tenant_id=$1 AND r.member_id=ANY($2::text[]) AND i.task_id=$3 GROUP BY r.member_id,r.course_id,r.course_version",
          [a.tenantId, memberIds, taskId],
        )
      ).rows;
      const exams = (
        await tx.query(
          "SELECT e.* FROM exam_attempts e JOIN task_items i ON i.tenant_id=e.tenant_id AND i.course_id=e.course_id AND i.course_version=e.course_version WHERE e.tenant_id=$1 AND e.member_id=ANY($2::text[]) AND i.task_id=$3",
          [a.tenantId, memberIds, taskId],
        )
      ).rows;
      const training = (
        await tx.query(
          "SELECT s.* FROM training_sessions s JOIN task_items i ON i.tenant_id=s.tenant_id AND i.course_id=s.course_id AND i.course_version=s.course_version WHERE s.tenant_id=$1 AND s.member_id=ANY($2::text[]) AND i.task_id=$3",
          [a.tenantId, memberIds, taskId],
        )
      ).rows;
      const match = (rows: any[], m: string, c: any) =>
        rows.filter(
          (r) =>
            r.member_id === m &&
            r.course_id === c.course_id &&
            r.course_version === c.course_version,
        );
      const latest = (dates: unknown[]) => {
        const valid = dates
          .filter(Boolean)
          .map((value) => new Date(value as any).getTime())
          .filter(Number.isFinite);
        return valid.length ? new Date(Math.max(...valid)).toISOString() : null;
      };
      return {
        task: {
          id: task.id,
          title: task.title,
          status: task.status,
          due: task.due_text,
          sequential: task.sequential,
        },
        total: counts.total,
        completed: counts.completed,
        limit: pagination.limit,
        offset: pagination.offset,
        items: members.map((member) => {
          const stages = versions.map((c) => {
            const course = c.content,
              p = match(progress, member.id, c),
              e = match(exams, member.id, c),
              t = match(training, member.id, c),
              r = match(runtime, member.id, c);
            const expected = (course?.lessons || []).map((l: any) => l.id),
              done = expected.filter((lessonId: string) =>
                p.some((row) => row.lesson_id === lessonId),
              ).length;
            const complete =
              course?.kind === "learn"
                ? expected.length > 0 && done === expected.length
                : course?.kind === "exam"
                  ? e.some((row) => row.passed === true)
                  : t.some((row) => row.status === "completed");
            const scores = [...e, ...t]
              .filter((row) => row.score !== null && row.score !== undefined)
              .map((row) => Number(row.score));
            return {
              courseId: c.course_id,
              version: c.course_version,
              title: course?.title || "未发布课程",
              kind: course?.kind || "learn",
              completed: complete,
              completedLessons: done,
              totalLessons: expected.length,
              score: scores.length ? Math.max(...scores) : null,
              pendingReview:
                e.some((row) => row.status === "pending_review") ||
                t.some((row) => row.status === "pending_review"),
              lastActivity: latest([
                ...p.map((row) => row.completed_at),
                ...r.map((row) => row.updated_at),
                ...e.map((row) => row.submitted_at || row.started_at),
                ...t.map((row) => row.created_at),
              ]),
            };
          });
          return {
            memberId: member.id,
            name: member.name,
            employeeNo: member.employee_no,
            department: member.department,
            active: member.active,
            completed: Boolean(member.completed_at),
            completedAt: member.completed_at ? iso(member.completed_at) : null,
            completedCourses: stages.filter((s) => s.completed).length,
            totalCourses: stages.length,
            lastActivity: latest(stages.map((s) => s.lastActivity)),
            stages,
          };
        }),
      };
    });
  };
  app.get("/api/tenants/:tenantId/reports/tasks/:id", (req) => readReport(req));
  app.get(
    "/api/tenants/:tenantId/reports/tasks/:id/export",
    async (req, reply) => {
      const report = await readReport(req, true);
      const rows: unknown[][] = [
        [
          "任务ID",
          "任务名称",
          "任务状态",
          "截止日期",
          "成员ID",
          "姓名",
          "员工编号",
          "部门",
          "成员状态",
          "任务完成",
          "完成时间",
          "课程ID",
          "课程名称",
          "冻结版本",
          "课程类型",
          "课程状态",
          "已完成课时",
          "总课时",
          "最高已记录分数",
          "最后学习活动",
        ],
      ];
      for (const member of report.items)
        for (const stage of member.stages.length ? member.stages : [null]) {
          rows.push([
            report.task.id,
            report.task.title,
            report.task.status,
            report.task.due,
            member.memberId,
            member.name,
            member.employeeNo,
            member.department,
            member.active ? "启用" : "停用",
            member.completed ? "已完成" : "未完成",
            member.completedAt || "",
            stage?.courseId || "",
            stage?.title || "",
            stage?.version ?? "",
            stage
              ? (
                  { learn: "学习", train: "训练", exam: "考试" } as Record<
                    string,
                    string
                  >
                )[stage.kind] || stage.kind
              : "",
            stage
              ? stage.completed
                ? "已完成"
                : stage.pendingReview
                  ? "待人工评价"
                  : "未完成"
              : "",
            stage?.kind === "learn" ? stage.completedLessons : "",
            stage?.kind === "learn" ? stage.totalLessons : "",
            stage?.score ?? "",
            stage?.lastActivity || member.lastActivity || "",
          ]);
          if (rows.length > 100001)
            throw new HttpError(
              413,
              "REPORT_TOO_LARGE",
              "任务明细超过10万行，请拆分任务后导出",
            );
        }
      const csv =
        "\uFEFF" +
        rows.map((row) => row.map(reportCsvCell).join(",")).join("\r\n");
      reply
        .header("content-type", "text/csv; charset=utf-8")
        .header("cache-control", "private, no-store")
        .header(
          "content-disposition",
          `attachment; filename*=UTF-8''${encodeURIComponent("任务学习明细-" + report.task.id + ".csv")}`,
        );
      return reply.send(csv);
    },
  );
}

function reportCsvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s]*[=+\-@]|^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
