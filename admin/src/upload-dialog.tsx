import {useRef,useState} from 'react';
import {Loader2,RefreshCw,Upload} from 'lucide-react';
import {Field,Modal} from './ui';

export function UploadDialog({onUpload,onRefresh,onClose}:{tenantId:string;onUpload:(file:File,category:string)=>Promise<{ok:boolean;error?:string}>;onRefresh?:()=>Promise<void>;onClose:()=>void}) {
 const[file,setFile]=useState<File|null>(null),[category,setCategory]=useState('业务资料'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[uploaded,setUploaded]=useState(false);
 const pending=useRef(false),confirmed=useRef(false);
 const close=()=>{if(!pending.current)onClose();};
 const save=async()=>{
  if(pending.current||!file)return;
  if(!confirmed.current&&file.size>10*1024*1024){setError('文件不能超过 10 MB');return;}
  if(!confirmed.current&&!/\.(pdf|docx|pptx|txt|md)$/i.test(file.name)){setError('请选择 PDF、DOCX、PPTX、TXT 或 MD 文件');return;}
  pending.current=true;setBusy(true);setError('');
  try{
   if(!confirmed.current){const result=await onUpload(file,category);if(!result.ok){setError(result.error||'文件保存失败，所选文件和分类已保留，请重试。');return;}confirmed.current=true;setUploaded(true);}
   await onRefresh?.();onClose();
  }
  catch(e){const message=e instanceof Error?e.message:'服务暂时不可用，请重试。';setError(confirmed.current?`文件已保存，但列表刷新失败。请重试刷新，无需再次上传。${message}`:message);}
  finally{pending.current=false;setBusy(false);}
 };
 return <Modal title="上传知识文件" description="原文件上传到服务端保存，最大 10 MB。" onClose={close} closeDisabled={busy} footer={<><button className="button" disabled={busy} onClick={close}>{uploaded?'关闭':'取消'}</button><button className="button primary" disabled={!file||busy} onClick={()=>void save()}>{busy?<Loader2 className="spin" size={16}/>:uploaded?<RefreshCw size={16}/>:<Upload size={16}/>} {busy?(uploaded?'正在刷新…':'正在上传…'):(uploaded?'重试刷新':'保存文件')}</button></>}>
  {busy&&<p role="status" className="notice upload-status">{uploaded?'正在刷新文件列表，请稍候。不会重复上传文件。':'正在上传文件，请稍候。所选文件和分类保持不变。'}</p>}
  {uploaded&&!busy&&<p role="status" className="notice upload-status">文件已上传成功，刷新列表后即可查看。</p>}
  <fieldset className="editor-save-fields upload-fields" disabled={busy||uploaded} aria-busy={busy}>
   <label className="upload-zone"><Upload size={30}/><strong>{file?file.name:'选择知识文件'}</strong><span>PDF、Word、PPT、TXT、Markdown</span><input aria-label="选择知识文件" disabled={busy||uploaded} type="file" accept=".pdf,.docx,.pptx,.txt,.md" onChange={e=>{setFile(e.target.files?.[0]||null);setError('');}}/></label>
   <Field label="文件分类"><select disabled={busy||uploaded} value={category} onChange={e=>setCategory(e.target.value)}>{['业务资料','产品知识','服务规范','业务政策','岗位案例'].map(c=><option key={c}>{c}</option>)}</select></Field>
  </fieldset>
  {error&&<div role="alert" className="error-message upload-error">{error}</div>}
  <p className="muted info-line">TXT / MD 可直接预览；其他格式保存原文件并标记为待解析。</p>
 </Modal>;
}
