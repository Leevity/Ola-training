import type { Audience } from '../../shared/audience.ts';
import { enterpriseAudience } from '../../shared/audience.ts';
import {useEffect,useRef,useState} from 'react';
import {contentDirectory} from './api';
import type { Member } from './domain';
import {SelectionPagination,selectionPage,selectionPageSize} from './selection-pagination';
export function AudienceEditor({value,onChange,departments,members,allowPrivate=false}:{value?:Audience;onChange:(value:Audience)=>void;departments:string[];members:Pick<Member,'id'|'name'|'department'|'active'>[];allowPrivate?:boolean}){
 const[directory,setDirectory]=useState(members),[error,setError]=useState(''),[loading,setLoading]=useState(false),[attempt,setAttempt]=useState(0),[query,setQuery]=useState(''),[page,setPage]=useState(1);
 const searchRef=useRef<HTMLInputElement>(null),retryFocus=useRef(false);
 useEffect(()=>{if(!loading&&retryFocus.current){retryFocus.current=false;searchRef.current?.focus({preventScroll:true});}},[loading]);
 const audience=value||enterpriseAudience();
 const memberKey=JSON.stringify(members.map(m=>[m.id,m.name,m.department,m.active]));
 useEffect(()=>{setError('');if(members.length){setDirectory(members);setLoading(false);return;}if(audience.mode!=='members'){setLoading(false);return;}let active=true;setDirectory([]);setLoading(true);contentDirectory().then(result=>{if(active)setDirectory(result.items);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'成员名单加载失败');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[memberKey,audience.mode,attempt]);
 const search=query.trim().toLowerCase();
 const options=audience.mode==='departments'?departments.map(name=>({id:name,label:name})):directory.filter(m=>m.active).map(m=>({id:m.id,label:`${m.name} · ${m.department}`}));
 const filtered=options.filter(option=>option.label.toLowerCase().includes(search));
 const currentPage=selectionPage(page,filtered.length);
 const selected=audience.mode==='departments'?audience.departments:audience.memberIds;
 const unavailable=audience.mode==='members'&&(loading||Boolean(error));
 return <div className="audience-editor"><label className="field"><span>内容可见范围</span><select value={audience.mode} onChange={e=>{setQuery('');setPage(1);onChange({mode:e.target.value as Audience['mode'],memberIds:[],departments:[]});}}><option value="enterprise">本企业全部成员</option><option value="departments">指定部门</option><option value="members">指定成员</option></select></label>
  {audience.mode!=='enterprise'&&<>
   <label className="field audience-search"><span>{audience.mode==='members'?'搜索成员或部门':'搜索部门'}</span><input ref={searchRef} type="search" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} placeholder={audience.mode==='members'?'输入姓名或部门名称':'输入部门名称'}/></label>
   <p className="muted info-line" role="status">已选 {selected.length} {audience.mode==='members'?'名成员':'个部门'}，筛选和翻页不会清除选择。</p>
   {loading&&audience.mode==='members'&&<p role="status">正在加载成员名单…</p>}
   {error&&audience.mode==='members'&&<div role="alert" className="error-message"><p>{error}</p><button type="button" className="button" onClick={()=>{retryFocus.current=true;setAttempt(n=>n+1);}}>重新加载成员</button></div>}
   {!unavailable&&<><SelectionPagination label="可见范围" total={filtered.length} page={currentPage} onPage={setPage}/><div className="audience-options" key={`${audience.mode}:${query}:${currentPage}`}>{filtered.slice((currentPage-1)*selectionPageSize,currentPage*selectionPageSize).map(option=><label key={option.id}><input type="checkbox" checked={selected.includes(option.id)} onChange={e=>{const next=e.target.checked?[...selected,option.id]:selected.filter(id=>id!==option.id);onChange({...audience,[audience.mode==='departments'?'departments':'memberIds']:next});}}/>{option.label}</label>)}</div>{!filtered.length&&<p className="notice">{query?'没有匹配结果，请调整搜索条件。':audience.mode==='members'?'暂无可选的已启用成员。':'暂无可选部门。'}</p>}</>}
  </>}
  <p className="muted info-line">{allowPrivate?'不选成员时，仅管理端和有权访问关联课程的学员可使用资料。':'发布课程前需选定部门或成员；修改范围会影响已有课程版本的访问。'}</p>
 </div>;
}
