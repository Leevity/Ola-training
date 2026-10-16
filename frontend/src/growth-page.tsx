import { ConfirmationDialog } from "./confirmation-dialog";
import { useEffect,useState } from "react";
import {routeChoice,choiceRoute} from '../../shared/learner-navigation';
import {keepListScroll} from '../../shared/learner-list-scroll';
import {dateTime} from './domain';
import { CheckCircle2, ChevronRight } from "lucide-react";
import type { Course } from "@ola/learner-client/types";
import { Page, Topbar, Empty, SectionTitle } from "./ui";
import { usePortal } from "./portal";
import { Reviews } from "./pages";
type Nav = { go: (path: string) => void; back: () => void };
export function GrowthPage({ go, back }: Nav) {
  const { data,session } = usePortal();
  useEffect(()=>keepListScroll(session.user.tenantId+':'+session.user.memberId),[]);
  const [tab, setTab] = useState(()=>routeChoice(location.hash,'tab',['ability','reviews'],'ability')),
    [selected, setSelected] = useState<Course | null>(null);
  const evaluated = data.training.filter(
    (t) => ["completed", "failed"].includes(t.status) && t.score !== null,
  );
  const completed = data.courses.filter((c) =>
    data.completed.includes(`${c.id}:${c.version}`),
  );
  return (
    <Page go={go} className="detail-page">
      <Topbar title="成长评价" back={back} />
      <div className="light-hero">
        <span className="eyebrow">能力与课程的成长记录</span>
        <h1>每一次学习都有回响</h1>
        <p>从训练反馈到课程评价，了解自己的进步。</p>
      </div>
      <div className="detail-tabs">
        <button
          className={tab === "ability" ? "selected" : ""}
          onClick={() => {setTab('ability');go(choiceRoute(location.hash,{tab:'ability'}));}}
        >
          训练综合评价
        </button>
        <button
          className={tab === "reviews" ? "selected" : ""}
          onClick={() => {setTab('reviews');go(choiceRoute(location.hash,{tab:'reviews'}));}}
        >
          课程评价
        </button>
      </div>
      <main className="page-gutter">
        {tab === "ability" ? (
          <>
            {evaluated.length ? (
              <>
                <div className="ability-score">
                  <span>已评价训练平均分</span>
                  <strong>
                    {Math.round(
                      evaluated.reduce((sum, t) => sum + (t.score || 0), 0) /
                        evaluated.length,
                    )}
                    <small>/100</small>
                  </strong>
                  <p>来自 {evaluated.length} 次已完成评价的训练</p>
                </div>
                <SectionTitle title="训练反馈" />
                {evaluated.map((t) => (
                  <button
                    className="history-row"
                    key={t.id}
                    onClick={() => go(`/recap/${t.id}`)}
                  >
                    <span className="history-icon">
                      <CheckCircle2 size={20} />
                    </span>
                    <span>
                      <strong>{t.title}</strong>
                      <small>v{t.version} · {dateTime(t.createdAt)}</small>
                      <small>
                        {t.evaluation?.feedback || "查看评价与复盘"}
                      </small>
                    </span>
                    <b>{t.score} 分</b>
                    <ChevronRight size={16} />
                  </button>
                ))}
              </>
            ) : (
              <Empty
                title="暂无训练评价"
                hint="训练结束并由管理员评价后，会展示真实反馈"
                action="查看训练记录"
                onAction={() => go("/my/history")}
              />
            )}
          </>
        ) : (
          <>
            <SectionTitle title="已完成课程" />
            {completed.length ? (
              completed.map((c) => (
                <div className="rating-row" key={`${c.id}:${c.version}`}>
                  <img src={c.cover} alt="" />
                  <div>
                    <strong>{c.title}</strong>
                    <small>
                      v{c.version} ·{" "}
                      {(() => {
                        const rating = data.reviews.find(
                          (r) => r.courseId === c.id && r.version === c.version,
                        )?.rating;
                        return rating ? `${rating} 星 · 已评分` : "尚未评分";
                      })()}
                    </small>
                  </div>
                  <button onClick={() => setSelected(c)}>
                    评价课程
                    <ChevronRight size={15} />
                  </button>
                </div>
              ))
            ) : (
              <Empty
                title="还没有已完成课程"
                hint="完成课程后，可以在这里分享学习感受"
              />
            )}
          </>
        )}
      </main>
      {selected && (
        <ConfirmationDialog title="评价课程" onClose={() => setSelected(null)}>
          <section className="growth-review-dialog">
            <div className="sheet-head">
              <strong>{selected.title}</strong>
              <button className="text-action" onClick={() => setSelected(null)}>
                关闭
              </button>
            </div>
            <Reviews
              key={`${selected.id}:${selected.version}`}
              course={selected}
            />
          </section>
        </ConfirmationDialog>
      )}
    </Page>
  );
}
