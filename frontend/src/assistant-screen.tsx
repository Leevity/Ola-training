import {
  Camera,
  ChevronRight,
  Clock3,
  FileText,
  MessageCircle,
  Mic,
  Send,
  X,
} from "lucide-react";
import { LearnerAssistant } from "@ola/classroom-ui/assistant";
import { Page } from "./ui";
import { usePortal } from "./portal";
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
export function AssistantScreen({
  go,
  id,
}: {
  go: (path: string) => void;
  id?: string;
}) {
  const { data, session, notify } = usePortal();
  const app =
    new URLSearchParams(location.hash.split("?")[1]).get("app") || "terminal";
  return (
    <Page tab="whale" go={go} className="assistant-mobile-page">
      <LearnerAssistant
        key={id || app}
        data={data}
        user={session.user}
        go={go}
        notify={notify}
        icons={icons}
        sessionId={id}
        initialApp={app}
      />
    </Page>
  );
}
