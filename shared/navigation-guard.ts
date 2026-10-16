const guards = new Set<() => boolean>();
export function protectUnsaved(isDirty:()=>boolean,message:string,flush:()=>void=()=>{}){
 const remove=registerLeaveGuard(()=>{if(!isDirty())return true;flush();return window.confirm(message);});
 const before=(event:BeforeUnloadEvent)=>{if(!isDirty())return;flush();event.preventDefault();event.returnValue='';};
 window.addEventListener('beforeunload',before);
 return()=>{remove();window.removeEventListener('beforeunload',before);};
}
let approvedHash: string | undefined,
  approvedBack = false;
export function registerLeaveGuard(guard: () => boolean) {
  guards.add(guard);
  return () => {
    guards.delete(guard);
  };
}
export function allowLeaving() {
  for (const guard of guards) if (!guard()) return false;
  return true;
}
export function navigateHash(path: string) {
  const hash = "#" + path.replace(/^#/, "");
  if (location.hash === hash) return true;
  if (!allowLeaving()) return false;
  approvedHash = hash;
  location.hash = hash;
  return true;
}
export function prepareHistoryBack(willNavigate = true) {
  if (!allowLeaving()) return false;
  approvedBack = willNavigate;
  return true;
}
/** Hash URLs may already change before hashchange. Reject before React unmounts the current page. */
export function watchHashRoute(onRoute: (route: string) => void) {
  let acceptedUrl = location.href,
    acceptedState = history.state;
  const captureState = () =>
    queueMicrotask(() => {
      if (location.href === acceptedUrl) acceptedState = history.state;
    });
  captureState();
  const sync = () => {
    const approved = approvedBack || approvedHash === location.hash;
    approvedBack = false;
    approvedHash = undefined;
    if (location.href === acceptedUrl) return;
    if (!approved && !allowLeaving()) {
      history.replaceState(acceptedState, "", acceptedUrl);
      return;
    }
    acceptedUrl = location.href;
    acceptedState = history.state;
    captureState();
    onRoute(location.hash.slice(1) || "/home");
  };
  window.addEventListener("hashchange", sync);
  return () => {
    window.removeEventListener("hashchange", sync);
    approvedHash = undefined;
    approvedBack = false;
  };
}
