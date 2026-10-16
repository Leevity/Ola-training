import type { Actor } from "./auth.ts";
import type { Queryable } from "./db.ts";
import { courseVisible } from "./content-access.ts";
import { finished } from "./learning.ts";

/** Structured personal learning lookup, independent of model configuration. */
export async function personalLearningAnswer(
  tx: Queryable,
  actor: Actor,
  text: string,
) {
  if (!/(课程|学习|待学)/.test(text) || !/(没|未|待|继续|还有)/.test(text))
    return null;
  const rows = (
    await tx.query(
      "SELECT v.content,c.data AS policy FROM courses c JOIN course_versions v ON v.tenant_id=c.tenant_id AND v.course_id=c.id AND v.version=c.version WHERE c.tenant_id=$1 AND c.status='published' ORDER BY c.updated_at DESC",
      [actor.tenantId],
    )
  ).rows;
  const progress = (
    await tx.query(
      "SELECT course_id,course_version,lesson_id,completed_at FROM learning_progress WHERE tenant_id=$1 AND member_id=$2 ORDER BY completed_at DESC",
      [actor.tenantId, actor.memberId],
    )
  ).rows;
  const items = [];
  for (const row of rows) {
    const c = row.content;
    if (
      c.kind !== "learn" ||
      !courseVisible(actor, row.policy) ||
      (await finished(tx, actor, c.id, c.version))
    )
      continue;
    const matches = progress.filter(
      (p) => p.course_id === c.id && p.course_version === c.version,
    );
    const ids = new Set(matches.map((p) => p.lesson_id));
    const done = c.lessons.filter((l: { id: string }) => ids.has(l.id)).length;
    items.push({
      type: "course",
      id: c.id,
      title: c.title,
      excerpt: c.summary,
      version: c.version,
      cover: c.cover,
      progress: c.lessons.length
        ? Math.round((done / c.lessons.length) * 100)
        : 0,
      latest: matches[0]?.completed_at || "",
    });
  }
  items.sort(
    (a, b) =>
      Number(b.progress > 0) - Number(a.progress > 0) ||
      String(b.latest).localeCompare(String(a.latest)),
  );
  return {
    mode: "learning",
    message: items.length
      ? `你有 ${items.length} 门待学课程，可以从上次的进度继续。`
      : "当前可访问的学习课程都已完成，可以到课程中心查看训练和考试。",
    total: items.length,
    sources: items.slice(0, 4).map(({ latest, ...item }) => item),
  };
}
