import assert from 'node:assert/strict';
import {test} from 'node:test';
import {widgetHeight} from '../src/widget-height.ts';
test('互动高度协议只接受有限数值且限制最小最大空间',()=>{
 for(const data of [null,[],{},'height',{type:'score',height:600},{type:'ola-widget-height',height:'600'},{type:'ola-widget-height',height:Infinity},{type:'ola-widget-height',height:NaN},{type:'ola-widget-height',height:-1}])assert.equal(widgetHeight(data),undefined);
 assert.equal(widgetHeight({type:'ola-widget-height',height:1}),240);
 assert.equal(widgetHeight({type:'ola-widget-height',height:517.4}),520);
 assert.equal(widgetHeight({type:'ola-widget-height',height:99999999}),2000);
});
