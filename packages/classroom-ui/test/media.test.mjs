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
  const focusTarget=React.createRef();
  await act(async () => root.render(h(MediaFeedback, {focusTarget}, h('div',{ref:focusTarget,tabIndex:-1,'aria-label':'课件画面'}),children)));
  return {
    container,
    focusTarget,
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
  const { container, close, focusTarget } = await setup([
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
    assert.equal(document.activeElement,focusTarget.current);
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


test("缺少资源地址不提供无效重试，媒体错误事件不会把缺失配置伪装成网络故障",async()=>{
 const {container,close}=await setup([
  h(ClassroomImage,{key:'i',element:{id:'missing-image'},src:'',content:h('img')}),
  h(ClassroomAudio,{key:'a',element:{id:'missing-audio',src:'',rotate:0}}),
  h(ClassroomVideo,{key:'v',element:{id:'missing-video',src:'',poster:'/poster.webp'}})
 ]);
 try{
  assert.equal(container.querySelectorAll('[role="alert"]').length,3);
  assert.match(container.textContent,/缺少可播放视频/);
  assert.equal([...container.querySelectorAll('button')].filter(b=>b.textContent.startsWith('重试')).length,0);
  await act(async()=>{for(const node of container.querySelectorAll('img,audio,video'))node.dispatchEvent(event('error'));});
  assert.equal(container.querySelectorAll('[role="alert"]').length,3);
  assert.equal([...container.querySelectorAll('button')].filter(b=>b.textContent.startsWith('重试')).length,0);
  assert.equal(container.querySelector('[aria-label="播放音频"]').disabled,true);
 }finally{await close();}
});

test("音频加载中保留键盘焦点并同步阻止重复播放，失败后仍可重试",async()=>{
 let plays=0,rejectPlay;
 dom.window.HTMLMediaElement.prototype.play=()=>{plays++;return new Promise((resolve,reject)=>{rejectPlay=reject;});};
 const {container,close}=await setup(h(ClassroomAudio,{element:{id:'pending-focus',src:'/audio.wav',rotate:0}}));
 try{
  const button=container.querySelector('[aria-label="播放音频"]');button.focus();
  await act(async()=>{button.click();button.click();});
  assert.equal(plays,1);assert.equal(document.activeElement,button);assert.equal(button.disabled,false);assert.equal(button.getAttribute('aria-disabled'),'true');
  await act(async()=>rejectPlay(new Error('模拟网络错误')));
  assert.equal(document.activeElement,button);assert.equal(button.getAttribute('aria-disabled'),'false');assert.match(container.textContent,/无法播放/);
 }finally{await close();}
});

test("超时后新播放成功，旧play迟到不能暂停正在播放的新尝试",async()=>{
 let resolveFirst,resolveSecond,plays=0,pauses=0,timeout;
 dom.window.HTMLMediaElement.prototype.play=()=>new Promise(resolve=>{if(++plays===1)resolveFirst=resolve;else resolveSecond=resolve;});
 dom.window.HTMLMediaElement.prototype.pause=()=>pauses++;
 const {container,close}=await setup(h(ClassroomAudio,{element:{id:'timeout-race',src:'/audio.wav',rotate:0}}));
 const originalSetTimeout=globalThis.setTimeout,originalClearTimeout=globalThis.clearTimeout;
 const fakeTimer={};globalThis.setTimeout=(callback,ms,...args)=>ms===15000?(timeout=callback,fakeTimer):originalSetTimeout(callback,ms,...args);globalThis.clearTimeout=timer=>{if(timer!==fakeTimer)originalClearTimeout(timer);};
 try{
  await act(async()=>container.querySelector('[aria-label="播放音频"]').click());
  await act(async()=>timeout());assert.match(container.textContent,/无法播放/);
  await act(async()=>container.querySelector('[aria-label="播放音频"]').click());
  await act(async()=>resolveSecond());assert.ok(container.querySelector('[aria-label="暂停音频"]'));
  const before=pauses;await act(async()=>resolveFirst());assert.equal(pauses,before,'旧播放结果不应暂停新的播放');
 }finally{globalThis.setTimeout=originalSetTimeout;globalThis.clearTimeout=originalClearTimeout;await close();}
});
