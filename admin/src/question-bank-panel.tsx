import { randomId } from '../../shared/random-id.ts';
import { useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import * as api from "./api";
import { Field, Empty } from "./ui";
const labels = {
  single: "单选题",
  multiple: "多选题",
  boolean: "判断题",
  fill: "填空题",
  text: "问答题",
};
export function QuestionBankPanel({
  courseId,
  saved,
  onBusyChange,
  onDirtyChange,
}: {
  courseId: string;
  saved: boolean;
  onBusyChange: (busy: boolean) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [items, setItems] = useState<api.ExamQuestion[]>([]),
    [draft, setDraft] = useState<api.ExamQuestion | null>(null),
    [creating, setCreating] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const load = async () => {
    setBusy(true);
    setError("");
    try {
      await api.bootstrap();
      setItems(
        (await api.examQuestions()).items.filter(
          (q) => q.courseId === courseId,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (saved) void load();
  }, [courseId, saved]);
  useEffect(() => {
    onBusyChange(busy);
    return () => onBusyChange(false);
  }, [busy, onBusyChange]);
  useEffect(() => {
    onDirtyChange(Boolean(draft));
    return () => onDirtyChange(false);
  }, [draft, onDirtyChange]);
  const enabled = items.filter((q) => q.active !== false),
    total = enabled.reduce((sum, q) => sum + q.points, 0);
  const save = async () => {
    if (!draft || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.saveExamQuestion(draft, creating);
      setItems((current) =>
        [...current.filter((q) => q.id !== draft.id), draft].sort((a, b) =>
          a.id.localeCompare(b.id),
        ),
      );
      setDraft(null);
      setNotice("试题已保存到题库。发布课程后才进入新试卷，已有答卷不变。");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!saved)
    return <p className="notice">请先保存考试课程草稿，再打开题库添加试题。</p>;
  return (
    <section aria-label="考试题库">
      <div className="section-heading">
        <div>
          <h3>考试题库</h3>
          <p>
            启用 {enabled.length} 题 · 合计 {total}{" "}
            分；发布要求100分。合格分数在课程内容中设置。
          </p>
        </div>
        <div className="title-actions">
          <button
            className="button"
            disabled={busy || !!draft}
            onClick={() => void load()}
          >
            <RefreshCw size={16} />
            刷新题库
          </button>
          <button
            className="button primary"
            disabled={busy || !!draft}
            onClick={() => {
              setCreating(true);
              setError("");
              setDraft({
                id: randomId(),
                courseId,
                type: "single",
                title: "",
                options: [
                  { id: "A", text: "" },
                  { id: "B", text: "" },
                ],
                answers: ["A"],
                explanation: "",
                points: 20,
                active: true,
              });
            }}
          >
            <Plus size={16} />
            添加试题
          </button>
        </div>
      </div>
      {error && (
        <div role="alert" className="error-message">
          {error}
        </div>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {draft ? (
        <form
          aria-label="试题编辑"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <fieldset disabled={busy} className="question-fieldset">
            <div className="form-grid">
              <Field label="题型">
                <select
                  value={draft.type}
                  onChange={(e) => {
                    const type = e.target.value as api.ExamQuestion["type"];
                    setDraft({
                      ...draft,
                      type,
                      options:
                        type === "boolean"
                          ? [
                              { id: "A", text: "正确" },
                              { id: "B", text: "错误" },
                            ]
                          : ["single", "multiple"].includes(type)
                            ? [
                                { id: "A", text: "" },
                                { id: "B", text: "" },
                              ]
                            : [],
                      answers: ["single", "multiple", "boolean"].includes(type)
                        ? ["A"]
                        : [""],
                    });
                  }}
                >
                  {Object.entries(labels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="分值">
                <input
                  type="number"
                  required
                  min={1}
                  max={100}
                  value={draft.points}
                  onChange={(e) =>
                    setDraft({ ...draft, points: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="题干" wide>
                <textarea
                  required
                  rows={3}
                  maxLength={2000}
                  value={draft.title}
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.target.value })
                  }
                />
              </Field>
            </div>
            {["single", "multiple", "boolean"].includes(draft.type) ? (
              <section>
                <h4>选项与标准答案</h4>
                <p className="muted">勾选正确选项；多选题支持多个答案。</p>
                {draft.options.map((option) => (
                  <div className="question-option" key={option.id}>
                    <input
                      aria-label={`选项${option.id}为正确答案`}
                      type={draft.type === "multiple" ? "checkbox" : "radio"}
                      name="correct-answer"
                      checked={draft.answers.includes(option.id)}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          answers:
                            draft.type === "multiple"
                              ? e.target.checked
                                ? [...draft.answers, option.id]
                                : draft.answers.filter((id) => id !== option.id)
                              : [option.id],
                        })
                      }
                    />
                    <Field label={`选项 ${option.id}`}>
                      <input
                        required
                        maxLength={2000}
                        value={option.text}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            options: draft.options.map((o) =>
                              o.id === option.id
                                ? { ...o, text: e.target.value }
                                : o,
                            ),
                          })
                        }
                      />
                    </Field>
                    {draft.type !== "boolean" && (
                      <button
                        type="button"
                        className="button"
                        disabled={draft.options.length <= 2}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            options: draft.options.filter(
                              (o) => o.id !== option.id,
                            ),
                            answers: draft.answers.filter(
                              (id) => id !== option.id,
                            ),
                          })
                        }
                      >
                        移除{option.id}
                      </button>
                    )}
                  </div>
                ))}
                {draft.type !== "boolean" && (
                  <button
                    type="button"
                    className="button"
                    disabled={draft.options.length >= 12}
                    onClick={() => {
                      const id = "ABCDEFGHIJKL"
                        .split("")
                        .find((id) => !draft.options.some((o) => o.id === id))!;
                      setDraft({
                        ...draft,
                        options: [...draft.options, { id, text: "" }],
                      });
                    }}
                  >
                    添加选项
                  </button>
                )}
              </section>
            ) : (
              <Field
                label={
                  draft.type === "text" ? "参考答案 / 阅卷要点" : "标准答案"
                }
              >
                <textarea
                  required
                  maxLength={10000}
                  rows={3}
                  value={draft.answers[0] || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, answers: [e.target.value] })
                  }
                />
              </Field>
            )}
            <Field label="答案解析">
              <textarea
                rows={3}
                maxLength={10000}
                value={draft.explanation}
                onChange={(e) =>
                  setDraft({ ...draft, explanation: e.target.value })
                }
              />
            </Field>
            <label className="check-row">
              <input
                type="checkbox"
                checked={draft.active !== false}
                onChange={(e) =>
                  setDraft({ ...draft, active: e.target.checked })
                }
              />
              启用此题，计入下一次发布的试卷
            </label>
            {draft.type === "text" && (
              <p className="notice">
                问答题须人工阅卷，参考答案不会作为自动评分结果。
              </p>
            )}
            <div className="title-actions">
              <button
                type="button"
                className="button"
                onClick={() => setDraft(null)}
              >
                取消试题编辑
              </button>
              <button className="button primary" type="submit">
                {busy ? "正在保存…" : "保存试题"}
              </button>
            </div>
          </fieldset>
        </form>
      ) : items.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>题目</th>
                <th>题型</th>
                <th>分值</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((q) => (
                <tr key={q.id}>
                  <td>{q.title}</td>
                  <td>{labels[q.type]}</td>
                  <td>{q.points}</td>
                  <td>{q.active === false ? "停用" : "启用"}</td>
                  <td>
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => {
                        setCreating(false);
                        setError("");
                        setDraft(structuredClone(q));
                      }}
                    >
                      编辑试题
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="暂无试题" hint="添加试题并凑齐100分后发布考试课程。" />
      )}
    </section>
  );
}
