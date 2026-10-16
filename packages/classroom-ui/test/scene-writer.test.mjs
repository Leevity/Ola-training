import { test } from "node:test";
import assert from "node:assert/strict";
import { SceneWriter } from "../src/scene-writer.ts";
const state = (text) => ({
  actionIndex: 0,
  answers: {},
  submitted: false,
  notes: { reflection: text },
});
test("课堂保存响应丢失后复用同一事件、修订和快照，不覆盖已提交数据", async () => {
  const calls = [];
  let committed;
  const writer = new SceneWriter(
    { revision: 0, state: state("") },
    async (attempt) => {
      calls.push(structuredClone(attempt));
      if (!committed) {
        committed = structuredClone(attempt);
        throw new TypeError("offline after commit");
      }
      assert.deepEqual(attempt, committed);
      return { revision: 1, state: attempt.state };
    },
  );
  const value = state("未保存反思");
  assert.equal(await writer.save(value), false);
  value.notes.reflection = "外部修改不能改变失败快照";
  assert.equal(writer.status.canRetry, true);
  assert.equal(writer.status.synchronized, false);
  assert.equal(await writer.retry(), true);
  assert.equal(writer.status.synchronized, true);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(calls[1].state.notes.reflection, "未保存反思");
});
test("串行发送并保留失败期间的最新编辑，成功后使用新修订", async () => {
  let finish;
  const calls = [];
  const writer = new SceneWriter(
    { revision: 4, state: state("") },
    async (attempt) => {
      calls.push(structuredClone(attempt));
      if (calls.length === 1)
        await new Promise((resolve) => {
          finish = resolve;
        });
      if (calls.length === 1) throw new Error("network");
      return { revision: attempt.revision + 1, state: attempt.state };
    },
  );
  const pending = writer.save(state("第一笔"));
  void writer.save(state("第二笔"));
  void writer.save(state("最新一笔"));
  finish();
  assert.equal(await pending, false);
  assert.equal(await writer.retry(), true);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].eventId, calls[1].eventId);
  assert.equal(calls[1].revision, 4);
  assert.equal(calls[2].revision, 5);
  assert.equal(calls[2].state.notes.reflection, "最新一笔");
  assert.notEqual(calls[1].eventId, calls[2].eventId);
});
test("跨设备冲突或身份权限失败锁定写入，不通过自动重试覆盖远端", async () => {
  for (const status of [400, 401, 403, 409]) {
    let calls = 0;
    const writer = new SceneWriter(
      { revision: 0, state: state("") },
      async () => {
        calls++;
        throw Object.assign(new Error("changed"), { status });
      },
    );
    await writer.save(state("本地内容"));
    assert.equal(writer.status.canRetry, false);
    assert.equal(await writer.retry(), false);
    await writer.save(state("后续内容"));
    assert.equal(calls, 1);
    assert.equal(writer.status.synchronized, false);
  }
});
test("所有排队保存完成后才报告同步成功，取消订阅后不再通知", async () => {
  let finish,
    notifications = 0;
  const writer = new SceneWriter(
    { revision: 0, state: state("") },
    async (attempt) => {
      await new Promise((resolve) => {
        finish = resolve;
      });
      return { revision: 1, state: attempt.state };
    },
  );
  const unsubscribe = writer.subscribe(() => notifications++);
  const pending = writer.save(state("反思"));
  assert.equal(writer.status.synchronized, false);
  unsubscribe();
  const before = notifications;
  finish();
  await pending;
  assert.equal(writer.status.synchronized, true);
  assert.equal(notifications, before);
});
