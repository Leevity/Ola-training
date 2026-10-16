import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import React, { act } from "react";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.HTMLMediaElement.prototype.pause = function () {};
const { createRoot } = await import("react-dom/client");
const { MediaFeedback, ClassroomAudio, ClassroomImage, ClassroomVideo } =
  await import("../src/media.tsx");
const h = React.createElement;
async function setup(children) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(h(MediaFeedback, null, children)));
  return {
    container,
    close: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}
const event = (type) => new dom.window.Event(type, { bubbles: false });
test("音频播放失败显示中文原因，重试成功并在卸载时停止播放", async () => {
  let plays = 0,
    pauses = 0;
  dom.window.HTMLMediaElement.prototype.pause = function () {
    pauses++;
  };
  dom.window.HTMLMediaElement.prototype.play = async function () {
    if (++plays === 1) throw new Error("failed");
  };
  const { container, close } = await setup(
    h(ClassroomAudio, {
      element: {
        id: "audio1",
        src: "/api/learn/course-assets/example",
        rotate: 0,
        loop: false,
      },
    }),
  );
  try {
    await act(async () =>
      container.querySelector('[aria-label="播放音频"]').click(),
    );
    assert.match(
      container.querySelector('[role="alert"]').textContent,
      /无法播放/,
    );
    assert.equal(container.querySelector('[aria-pressed="true"]'), null);
    await act(async () =>
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent === "重试音频")
        .click(),
    );
    await act(async () =>
      container.querySelector('[aria-label="播放音频"]').click(),
    );
    assert.equal(plays, 2);
    assert.equal(
      container
        .querySelector('[aria-label="暂停音频"]')
        .getAttribute("aria-pressed"),
      "true",
    );
    assert.equal(container.querySelector('[role="alert"]'), null);
    await act(async () =>
      container.querySelector("audio").dispatchEvent(event("error")),
    );
    assert.match(container.textContent, /无法播放/);
    assert.equal(container.querySelector('[aria-pressed="true"]'), null);
  } finally {
    await close();
  }
  assert.ok(pauses > 0);
});
test("未获播放许可提示授权，卸载后迟到的play结果不能继续播放", async () => {
  dom.window.HTMLMediaElement.prototype.play = async () => {
    throw new dom.window.DOMException("blocked", "NotAllowedError");
  };
  let view = await setup(
    h(ClassroomAudio, {
      element: { id: "blocked", src: "/audio.wav", rotate: 0 },
    }),
  );
  await act(async () => view.container.querySelector("button").click());
  assert.match(view.container.textContent, /暂未允许播放/);
  await view.close();
  let resolvePlay,
    pauses = 0;
  dom.window.HTMLMediaElement.prototype.pause = function () {
    pauses++;
  };
  dom.window.HTMLMediaElement.prototype.play = () =>
    new Promise((resolve) => {
      resolvePlay = resolve;
    });
  view = await setup(
    h(ClassroomAudio, {
      element: { id: "late", src: "/audio.wav", rotate: 0 },
    }),
  );
  await act(async () => view.container.querySelector("button").click());
  assert.ok(view.container.querySelector('[aria-label="正在加载音频"]'));
  await view.close();
  await act(async () => resolvePlay());
  assert.ok(pauses >= 2);
});
test("图片和视频错误分别显示、重试重新挂载资源、加载成功清除提示", async () => {
  const { container, close } = await setup([
    h(ClassroomImage, {
      key: "i",
      element: { id: "image1" },
      src: "/image.webp",
      content: h("img", { src: "/image.webp", style: { filter: "blur(1px)" } }),
    }),
    h(ClassroomVideo, {
      key: "v",
      element: { id: "video1", src: "/video.mp4", poster: "/poster.webp" },
    }),
  ]);
  try {
    const image = container.querySelector("img"),
      video = container.querySelector("video");
    await act(async () => {
      image.dispatchEvent(event("error"));
      video.dispatchEvent(event("error"));
    });
    assert.equal(container.querySelectorAll('[role="alert"]').length, 2);
    await act(async () =>
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent === "重试图片")
        .click(),
    );
    assert.notEqual(container.querySelector("img"), image);
    assert.equal(container.querySelector("img").style.filter, "blur(1px)");
    assert.equal(container.querySelectorAll('[role="alert"]').length, 1);
    await act(async () =>
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent === "重试视频")
        .click(),
    );
    assert.notEqual(container.querySelector("video"), video);
    assert.ok(container.querySelector("video").hasAttribute("playsinline"));
    assert.equal(container.querySelectorAll('[role="alert"]').length, 0);
    await act(async () =>
      container.querySelector("img").dispatchEvent(event("error")),
    );
    await act(async () =>
      container.querySelector("img").dispatchEvent(event("load")),
    );
    assert.equal(container.querySelector('[role="alert"]'), null);
  } finally {
    await close();
  }
});
