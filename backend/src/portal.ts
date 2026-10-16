import { courseVisible, knowledgeVisible } from './content-access.ts';
import {personalLearningAnswer} from './assistant-learning.ts';
import type { Actor } from './auth.ts';
import type { Queryable } from './db.ts';
async function filterAssistantResult(tx:Queryable,a:Actor,result:any){
 const sources=[];
 for(const source of result.sources||[]){
  if(source.type==='course'){try{await accessible(tx,a,source.id,source.version);sources.push(source);}catch(e){if(![403,404].includes((e as any).status))throw e;}}
  if(source.type==='knowledge'){const row=(await tx.query("SELECT id,audience FROM knowledge WHERE tenant_id=$1 AND id=$2 AND status='ready'",[a.tenantId,source.id])).rows[0];if(row&&await knowledgeVisible(tx,a,{id:row.id,audience:row.audience}))sources.push(source);}
 }
 return sources.length===(result.sources||[]).length?result:{...result,message:'部分参考内容权限已调整，请重新提问。',sources};
}
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Database } from "./db.ts";
import type { Config } from "./config.ts";
import { accessible, finished, catalogCourse, learnerTasks } from "./learning.ts";
import { bad, conflict, missing } from "./errors.ts";
import { id } from "./schemas.ts";
import { iso, listTasks } from "./store.ts";

export async function registerPortal(
  app: FastifyInstance,
  db: Database,
  config: Config,
) {
  app.get("/api/learn/overview", async (req) => {
    const a = req.actor!;
    const courses = (
      await db.query(
        "SELECT v.content,c.data AS policy FROM courses c JOIN course_versions v ON v.tenant_id=c.tenant_id AND v.course_id=c.id AND v.version=c.version WHERE c.tenant_id=$1 AND c.status='published' ORDER BY c.updated_at DESC",
        [a.tenantId],
      )
    ).rows.filter(row=>courseVisible(a,row.policy)).map(({content})=>catalogCourse(content));
    const tasks=await learnerTasks(db,a);
    const allowedIds=new Set((await db.query('SELECT id,data FROM courses WHERE tenant_id=$1',[a.tenantId])).rows.filter(row=>courseVisible(a,row.data)).map(row=>row.id));
    const completed: string[] = [];
    for (const c of [...courses, ...tasks.flatMap((t) => t.snapshot)])
      if (
        !completed.includes(`${c.id}:${c.version}`) &&
        (await finished(db, a, c.id, c.version))
      )
        completed.push(`${c.id}:${c.version}`);
    const progress = (
      await db.query(
        'SELECT course_id AS "courseId",course_version AS version,lesson_id AS "lessonId",completed_at FROM learning_progress WHERE tenant_id=$1 AND member_id=$2 ORDER BY completed_at DESC',
        [a.tenantId, a.memberId],
      )
    ).rows;
    const attempts = (
      await db.query(
        'SELECT e.id,e.course_id AS "courseId",e.course_version AS version,e.status,e.score,e.passed,e.started_at AS "startedAt",e.expires_at AS "expiresAt",v.content->>\'title\' AS title FROM exam_attempts e JOIN course_versions v ON v.tenant_id=e.tenant_id AND v.course_id=e.course_id AND v.version=e.course_version WHERE e.tenant_id=$1 AND e.member_id=$2 ORDER BY e.started_at DESC LIMIT 200',
        [a.tenantId, a.memberId],
      )
    ).rows.filter(row=>allowedIds.has(row.courseId));
    const training = (
      await db.query(
        'SELECT s.id,s.course_id AS "courseId",s.course_version AS version,s.status,s.score,s.evaluation,s.created_at AS "createdAt",v.content->>\'title\' AS title FROM training_sessions s JOIN course_versions v ON v.tenant_id=s.tenant_id AND v.course_id=s.course_id AND v.version=s.course_version WHERE s.tenant_id=$1 AND s.member_id=$2 ORDER BY s.created_at DESC LIMIT 200',
        [a.tenantId, a.memberId],
      )
    ).rows.filter(row=>allowedIds.has(row.courseId));
    const favorites = (
      await db.query(
        "SELECT course_id FROM learner_favorites WHERE tenant_id=$1 AND member_id=$2",
        [a.tenantId, a.memberId],
      )
    ).rows.map((r) => r.course_id);
    const reviews = (
      await db.query(
        'SELECT course_id AS "courseId",version,rating,comment FROM course_reviews WHERE tenant_id=$1 AND member_id=$2',
        [a.tenantId, a.memberId],
      )
    ).rows;
    const read = (
      await db.query(
        "SELECT notification_id FROM notification_reads WHERE tenant_id=$1 AND member_id=$2",
        [a.tenantId, a.memberId],
      )
    ).rows.map((r) => r.notification_id);
    const notifications = [
      ...tasks.map((t) => ({
        id: `task-${t.id}`,
        title: "新的学习任务",
        text: t.title + " · 截止 " + t.due,
        at: t.assignedAt || t.start,
        href: `/task/${t.id}`,
      })),
      ...attempts
        .filter((r) => r.status === "graded")
        .map((r) => ({
          id: `exam-${r.id}`,
          title: "考试成绩已出",
          text: `${r.title} · ${r.score} 分`,
          at: iso(r.startedAt),
          href: `/exam/${r.id}`,
        })),
      ...training
        .filter((r) => r.status === "completed" || r.status === "failed")
        .map((r) => ({
          id: `train-${r.id}`,
          title: "训练评价已出",
          text: r.title,
          at: iso(r.createdAt),
          href: `/recap/${r.id}`,
        })),
    ]
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((n) => ({ ...n, read: read.includes(n.id) }));
    return {
      courses,
      tasks: tasks.map((t) => ({
        ...t,
        memberIds: [a.memberId],
        completedMemberIds: t.completedMemberIds.includes(a.memberId)
          ? [a.memberId]
          : [],
      })),
      completed,
      progress,
      attempts,
      training,
      favorites,
      reviews,
      notifications,
    };
  });
  app.put("/api/learn/favorites/:id", async (req) => {
    const a = req.actor!;
    const courseId = id.parse((req.params as any).id);
    const input = z.object({ favorite: z.boolean() }).parse(req.body);
    if (
      !(
        await db.query(
          "SELECT data FROM courses WHERE tenant_id=$1 AND id=$2 AND status='published'",
          [a.tenantId, courseId],
        )
      ).rows.length
    )
      throw missing();
    const favoriteCourse=(await db.query('SELECT data FROM courses WHERE tenant_id=$1 AND id=$2',[a.tenantId,courseId])).rows[0];if(!courseVisible(a,favoriteCourse.data))throw missing();
    if (input.favorite)
      await db.query(
        "INSERT INTO learner_favorites(tenant_id,member_id,course_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
        [a.tenantId, a.memberId, courseId],
      );
    else
      await db.query(
        "DELETE FROM learner_favorites WHERE tenant_id=$1 AND member_id=$2 AND course_id=$3",
        [a.tenantId, a.memberId, courseId],
      );
    return { ok: true };
  });
  app.put("/api/learn/courses/:id/review", async (req) => {
    const a = req.actor!;
    const courseId = id.parse((req.params as any).id);
    const input = z
      .object({
        version: z.number().int().positive(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().trim().max(2000),
      })
      .parse(req.body);
    await accessible(db,a,courseId,input.version);
    if (!(await finished(db, a, courseId, input.version)))
      throw conflict("完成课程后可提交评价");
    await db.query(
      "INSERT INTO course_reviews(tenant_id,member_id,course_id,version,rating,comment) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(tenant_id,member_id,course_id,version) DO UPDATE SET rating=EXCLUDED.rating,comment=EXCLUDED.comment,updated_at=now()",
      [
        a.tenantId,
        a.memberId,
        courseId,
        input.version,
        input.rating,
        input.comment,
      ],
    );
    return { ok: true };
  });
  app.get("/api/learn/courses/:id/reviews", async (req) => {
    const a = req.actor!;
    const courseId = id.parse((req.params as any).id);
    if (
      !(
        await db.query("SELECT 1 FROM courses WHERE tenant_id=$1 AND id=$2", [
          a.tenantId,
          courseId,
        ])
      ).rows.length
    )
      throw missing();
    const reviewCourse=(await db.query('SELECT data FROM courses WHERE tenant_id=$1 AND id=$2',[a.tenantId,courseId])).rows[0];if(!courseVisible(a,reviewCourse.data))throw missing();
    return {
      items: (
        await db.query(
          "SELECT r.rating,r.comment,r.version,r.updated_at,m.name FROM course_reviews r JOIN members m ON m.tenant_id=r.tenant_id AND m.id=r.member_id WHERE r.tenant_id=$1 AND r.course_id=$2 ORDER BY r.updated_at DESC LIMIT 100",
          [a.tenantId, courseId],
        )
      ).rows,
    };
  });
  app.post("/api/learn/notifications/read", async (req) => {
    const a = req.actor!;
    const { ids } = z
      .object({ ids: z.array(z.string().min(1).max(160)).max(500) })
      .parse(req.body);
    await db.transaction(async (tx) => {
      for (const item of ids)
        await tx.query(
          "INSERT INTO notification_reads(tenant_id,member_id,notification_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
          [a.tenantId, a.memberId, item],
        );
    });
    return { ok: true };
  });
  app.get("/api/learn/leaderboard", async (req) => {
    const a = req.actor!;
    const rows = (
      await db.query(
        `SELECT m.id,m.name,m.department,(SELECT count(*)::int FROM assignments x WHERE x.tenant_id=m.tenant_id AND x.member_id=m.id AND x.completed_at IS NOT NULL) AS tasks,(SELECT count(*)::int FROM learning_progress p WHERE p.tenant_id=m.tenant_id AND p.member_id=m.id) AS lessons,(SELECT count(*)::int FROM exam_attempts e WHERE e.tenant_id=m.tenant_id AND e.member_id=m.id AND e.passed=TRUE) AS exams FROM members m WHERE m.tenant_id=$1 AND m.active=TRUE ORDER BY tasks DESC,lessons DESC,exams DESC,m.name LIMIT 100`,
        [a.tenantId],
      )
    ).rows;
    return {
      items: rows.map((r, index) => ({
        ...r,
        rank: index + 1,
        isMe: r.id === a.memberId,
      })),
    };
  });
  app.get("/api/learn/knowledge/:id/download", async (req, reply) => {
    const a = req.actor!;
    const query = z
      .object({ courseId: id.optional(), version: z.coerce.number().int().positive().optional() })
      .refine(value=>(value.courseId===undefined)===(value.version===undefined),'课程与版本须同时提供')
      .parse(req.query);
    const knowledgeId = id.parse((req.params as any).id);
    const k = (
      await db.query("SELECT * FROM knowledge WHERE tenant_id=$1 AND id=$2", [
        a.tenantId,
        knowledgeId,
      ])
    ).rows[0];
    if (!k) throw missing();
    if(query.courseId!==undefined&&query.version!==undefined){const c=await accessible(db,a,query.courseId,query.version);if(!c.knowledgeIds.includes(knowledgeId))throw missing();}
    else if(k.status==='archived'||!await knowledgeVisible(db,a,{id:k.id,audience:k.audience}))throw missing();
    reply
      .header("cache-control", "no-store")
      .header("content-type", "application/octet-stream")
      .header(
        "content-disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(k.name)}`,
      );
    return reply.send(
      k.file_key
        ? await readFile(join(config.dataDir, "files", k.file_key))
        : Buffer.from(k.text_content || ""),
    );
  });
  app.get("/api/learn/assistant/sessions", async (req) => {
    const a = req.actor!;
    return {
      items: (
        await db.query(
          "SELECT id,app,title,created_at FROM assistant_sessions WHERE tenant_id=$1 AND member_id=$2 ORDER BY created_at DESC LIMIT 100",
          [a.tenantId, a.memberId],
        )
      ).rows,
    };
  });
  app.post("/api/learn/assistant/sessions", async (req) => {
    const a = req.actor!;
    const input = z
      .object({
        app: z.enum([
          "terminal",
          "sales",
          "faq",
          "product",
          "policy",
          "service",
          "cases",
        ]),
        title: z.string().trim().min(1).max(80),
      })
      .parse(req.body);
    const sessionId = randomUUID();
    await db.query(
      "INSERT INTO assistant_sessions(id,tenant_id,member_id,app,title) VALUES($1,$2,$3,$4,$5)",
      [sessionId, a.tenantId, a.memberId, input.app, input.title],
    );
    return { id: sessionId };
  });
  const ownSession = async (req: any) => {
    const a = req.actor!;
    const r = (
      await db.query(
        "SELECT * FROM assistant_sessions WHERE tenant_id=$1 AND member_id=$2 AND id=$3",
        [a.tenantId, a.memberId, id.parse(req.params.id)],
      )
    ).rows[0];
    if (!r) throw missing();
    return r;
  };
  app.get("/api/learn/assistant/sessions/:id",async req=>{
    const session=await ownSession(req);const rows=(await db.query('SELECT id,text,result,created_at FROM assistant_messages WHERE tenant_id=$1 AND session_id=$2 ORDER BY created_at,id',[req.actor!.tenantId,session.id])).rows;
    return {session,messages:await Promise.all(rows.map(async row=>({...row,result:await filterAssistantResult(db,req.actor!,row.result)})))};
  });
  app.post("/api/learn/assistant/sessions/:id/messages", async (req) => {
    const a = req.actor!;
    const input = z
      .object({ id, text: z.string().trim().min(1).max(2000) })
      .parse(req.body);
    return db.transaction(async (tx) => {
      const session = (
        await tx.query(
          "SELECT * FROM assistant_sessions WHERE tenant_id=$1 AND member_id=$2 AND id=$3 FOR UPDATE",
          [a.tenantId, a.memberId, id.parse((req.params as any).id)],
        )
      ).rows[0];
      if (!session) throw missing();
      const prior = (
        await tx.query(
          "SELECT text,result FROM assistant_messages WHERE tenant_id=$1 AND session_id=$2 AND id=$3",
          [a.tenantId, session.id, input.id],
        )
      ).rows[0];
      if (prior) {
        if (prior.text !== input.text) throw conflict("消息ID重复");
        return filterAssistantResult(tx,a,prior.result);
      }
      const learning = session.app === 'terminal' ? await personalLearningAnswer(tx,a,input.text) : null;
      if(learning){
        await tx.query('INSERT INTO assistant_messages(tenant_id,session_id,id,text,result) VALUES($1,$2,$3,$4,$5)',[a.tenantId,session.id,input.id,input.text,JSON.stringify(learning)]);
        return learning;
      }
      const tokens = [
        ...new Set(
          input.text
            .replace(/[，。？！、,.?!\s]/g, " ")
            .split(" ")
            .filter(Boolean)
            .flatMap((word) =>
              word.length > 2
                ? [
                    word,
                    ...Array.from(
                      { length: Math.min(word.length - 1, 30) },
                      (_, i) => word.slice(i, i + 2),
                    ),
                  ]
                : [word],
            ),
        ),
      ].slice(0, 35);
      const score = (text: string) =>
        tokens.reduce(
          (n, w) =>
            n + (text.toLowerCase().includes(w.toLowerCase()) ? w.length : 0),
          0,
        );
      const courses = (
        await tx.query(
          "SELECT id,title,data FROM courses WHERE tenant_id=$1 AND status='published'",
          [a.tenantId],
        )
      ).rows.filter(row=>courseVisible(a,row.data))
        .map((r) => ({
          type: "course",
          id: r.id,
          title: r.title,
          excerpt: r.data.summary,
          version: r.data.version,
          score: score(r.title + " " + r.data.summary),
        }))
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);
      const visibleDocuments=[];
      for(const row of (await tx.query("SELECT id,name,text_content,audience FROM knowledge WHERE tenant_id=$1 AND status='ready' AND text_content IS NOT NULL",[a.tenantId])).rows)if(await knowledgeVisible(tx,a,{id:row.id,audience:row.audience}))visibleDocuments.push(row);
      const documents=visibleDocuments.map(row=>({type:'knowledge',id:row.id,title:row.name,excerpt:String(row.text_content).slice(0,1500),score:score(row.name+' '+row.text_content)})).filter(row=>row.score>0).sort((a,b)=>b.score-a.score).slice(0,4);
      const result = {
        mode: "retrieval",
        message:
          courses.length + documents.length
            ? "已找到相关课程与知识原文，请结合原文使用。"
            : "未找到匹配内容，可以换一个关键词，或联系管理员补充资料。",
        sources: [...courses, ...documents].sort((a,b)=>b.score-a.score),
      };
      await tx.query(
        "INSERT INTO assistant_messages(tenant_id,session_id,id,text,result) VALUES($1,$2,$3,$4,$5)",
        [a.tenantId, session.id, input.id, input.text, JSON.stringify(result)],
      );
      return result;
    });
  });
}
