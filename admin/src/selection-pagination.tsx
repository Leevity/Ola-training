export const selectionPageSize = 10;
export function selectionPage(page: number, total: number) {
  return Math.max(1, Math.min(page, Math.ceil(total / selectionPageSize)));
}
export function SelectionPagination({label,total,page,onPage}:{label:string;total:number;page:number;onPage:(page:number)=>void}) {
  if(total<=selectionPageSize)return null;
  const pages=Math.ceil(total/selectionPageSize);
  return <nav className="pagination selection-pagination" aria-label={`${label}分页`}>
    <span role="status">共 {total} 条 · 第 {page} / {pages} 页 · 每页 {selectionPageSize} 条</span>
    <div><button type="button" disabled={page<=1} onClick={()=>onPage(page-1)}>上一页</button><button type="button" disabled={page>=pages} onClick={()=>onPage(page+1)}>下一页</button></div>
  </nav>;
}
