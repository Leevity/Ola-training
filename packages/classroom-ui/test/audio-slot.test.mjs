import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SlideCanvas,SlideRendererProvider} from '@openmaic/renderer';
const h=React.createElement;
const audio={id:'host-audio',type:'audio',left:20,top:40,width:100,height:60,rotate:0,fixedRatio:true,color:'#1677ff',loop:false,autoplay:false,src:'/media.wav'};
const slide={id:'host-slide',viewportSize:1000,viewportRatio:.5625,elements:[audio]};
test('上游音频扩展保持定位、支持宿主内容及旧默认行为',()=>{
 let supplied;const renderAudio=element=>{supplied=element;return h('button',null,'宿主音频');};
 const html=renderToStaticMarkup(h(SlideCanvas,{slide,scale:1,renderAudio}));
 assert.equal(supplied,audio);assert.match(html,/宿主音频/);assert.match(html,/data-audio-element/);assert.match(html,/left:20px/);assert.doesNotMatch(html,/Play audio/);
 assert.match(renderToStaticMarkup(h(SlideCanvas,{slide,scale:1})),/Play audio/);
});
test('音频扩展支持Provider配置、直接参数优先及空输出',()=>{
 const fallback=()=>h('button',null,'Provider音频');
 assert.match(renderToStaticMarkup(h(SlideRendererProvider,{slide,renderAudio:fallback},h(SlideCanvas,{scale:1}))),/Provider音频/);
 const html=renderToStaticMarkup(h(SlideRendererProvider,{slide,renderAudio:fallback},h(SlideCanvas,{scale:1,renderAudio:()=>null})));
 assert.match(html,/data-audio-element/);assert.doesNotMatch(html,/Provider音频|Play audio/);
});
