import { Camera, ChevronRight, Clock3, FileText, MessageCircle, Mic, Send, X } from 'lucide-react';
import { LearnerAssistant } from '@ola/classroom-ui/assistant';
import { usePortal } from './context';
const icons = {
  history: <Clock3 />,
  chat: <MessageCircle />,
  document: <FileText />,
  camera: <Camera />,
  mic: <Mic />,
  send: <Send />,
  arrow: <ChevronRight />,
  close: <X />,
};
export function AssistantPage({ app, sessionId }: { app?: string; sessionId?: string }) {
  const { data, user, go, notify } = usePortal();
  const initialApp = app || new URLSearchParams(location.hash.split('?')[1]).get('app') || 'terminal';
  return (
    <LearnerAssistant
      key={sessionId || initialApp}
      desktop
      data={data}
      user={user}
      go={go}
      notify={notify}
      icons={icons}
      sessionId={sessionId}
      initialApp={initialApp}
    />
  );
}
export function WhaleHome() {
  return <AssistantPage />;
}
