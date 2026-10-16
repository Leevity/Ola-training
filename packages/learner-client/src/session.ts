import { LearnerTransport } from "./transport";
/** Keep identity and CSRF in a stable module when API functions hot reload. */
export const transport: LearnerTransport = import.meta.hot?.data.transport || new LearnerTransport({
  onExpired: () => window.dispatchEvent(new Event("ola:expired")),
});
if(import.meta.hot)import.meta.hot.data.transport=transport;
import.meta.hot?.dispose(data=>{data.transport=transport;});
