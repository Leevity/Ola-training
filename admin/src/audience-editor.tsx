import type { Audience } from '../../shared/audience.ts';
import { enterpriseAudience } from '../../shared/audience.ts';
import {useEffect,useState} from 'react';
import {contentDirectory} from './api';
import type { Member } from './domain';
export function AudienceEditor({value,onChange,departments,members,allowPrivate=false}:{value?:Audience;onChange:(value:Audience)=>void;departments:string[];members:Pick<Member,'id'|'name'|'department'|'active'>[];allowPrivate?:boolean}){
 const[directory,setDirectory]=useState(members),[error,setError]=useState('');
 const memberKey=JSON.stringify(members.map(m=>[m.id,m.name,m.department,m.active]));
 useEffect(()=>{if(members.length){setDirectory(members);return;}let active=true;contentDirectory().then(result=>{if(active)setDirectory(result.items);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[memberKey]);
 const audience=value||enterpriseAudience();
 return <div className="audience-editor"><label className="field"><span>内容可见范围</span><select value={audience.mode} onChange={e=>onChange({mode:e.target.value as Audience['mode'],memberIds:[],departments:[]})}><option value="enterprise">本企业全部成员</option><option value="departments">指定部门</option><option value="members">指定成员</option></select></label>
  {audience.mode==='departments'&&<div className="audience-options">{departments.map(department=><label key={department}><input type="checkbox" checked={audience.departments.includes(department)} onChange={e=>onChange({...audience,departments:e.target.checked?[...audience.departments,department]:audience.departments.filter(d=>d!==department)})}/>{department}</label>)}</div>}
  {error&&<p role="alert" className="error-message">{error}</p>}
  {audience.mode==='members'&&<div className="audience-options">{directory.filter(m=>m.active).map(member=><label key={member.id}><input type="checkbox" checked={audience.memberIds.includes(member.id)} onChange={e=>onChange({...audience,memberIds:e.target.checked?[...audience.memberIds,member.id]:audience.memberIds.filter(id=>id!==member.id)})}/>{member.name} · {member.department}</label>)}</div>}
  <p className="muted info-line">{allowPrivate?'不选成员时，仅管理端和有权访问关联课程的学员可使用资料。':'发布课程前需选定部门或成员；修改范围会影响已有课程版本的访问。'}</p>
 </div>;
}
