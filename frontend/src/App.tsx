import { PortalProvider, usePortal } from "./portal";
import { Page, Topbar, Empty, useRoute } from "./ui";
import { CourseDetail, Records, Messages, RankPage } from "./pages";
import {
  HomePage,
  CourseCenter,
  TaskCenter,
  TaskDetail,
  MyPage,
  AccountPage,
} from "./restored-pages";
import {GrowthPage} from "./growth-page";
import { AssistantScreen } from "./assistant-screen";
import { StudyPage, ExamRules, ExamPage, TrainingPage } from "./workflows";
function Routes() {
  const { path, params, go, back } = useRoute(),
    { data } = usePortal();
  const seg = path.split("/").filter(Boolean),
    nav = { go, back },
    id = seg[1] || "",
    version =
      Number(params.get("v")) ||
      data.courses.find((c) => c.id === id)?.version ||
      1;
  if (path === "/" || path === "/home") return <HomePage {...nav} />;
  if (path === "/courses") return <CourseCenter key={path} {...nav} />;
  if (path === "/tasks") return <TaskCenter {...nav} />;
  if (path === "/whale") return <AssistantScreen {...nav} />;
  if (path === "/my") return <MyPage {...nav} />;
  if (path === "/my/settings") return <AccountPage {...nav} />;
  if (path === "/my/tasks") return <TaskCenter {...nav} />;
  if (path === "/growth" || path === "/my/growth")
    return <GrowthPage key={location.hash} {...nav} />;
  if (path === "/search") return <CourseCenter key={path} {...nav} searchOnly />;
  if (path === "/messages") return <Messages key={location.hash} {...nav} />;
  if (path === "/my/favorites") return <CourseCenter key={path} {...nav} favoritesOnly />;
  if (path === "/my/rank") return <RankPage {...nav} />;
  if (path === "/my/history" || path === "/history")
    return <Records key={location.hash} {...nav} mode="history" />;
  if (path === "/my/courses") return <Records key={location.hash} {...nav} mode="courses" />;
  if (seg[0] === "task") return <TaskDetail key={id} id={id} {...nav} />;
  if (seg[0] === "course")
    return (
      <CourseDetail
        key={`${id}:${version}`}
        id={id}
        version={version}
        {...nav}
      />
    );
  if (seg[0] === "content")
    return (
      <StudyPage
        key={`${id}:${version}`}
        id={id}
        version={version}
        lessonParameter={params.get("lesson")}
        {...nav}
      />
    );
  if (seg[0] === "exam" && id === "rules") {
    const courseId = seg[2];
    return (
      <ExamRules
        key={courseId}
        id={courseId}
        version={
          Number(params.get("v")) ||
          data.courses.find((c) => c.id === courseId)?.version ||
          1
        }
        {...nav}
      />
    );
  }
  if (seg[0] === "exam") return <ExamPage key={id} id={id} {...nav} />;
  if (seg[0] === "training" || seg[0] === "recap")
    return (
      <TrainingPage
        key={`${seg[0]}:${id}`}
        id={id}
        recap={seg[0] === "recap"}
        {...nav}
      />
    );
  if (seg[0] === "chat") return <AssistantScreen key={id} id={id} {...nav} />;
  return (
    <Page go={go}>
      <Topbar title="页面未找到" back={back} />
      <Empty
        title="页面暂不可用"
        hint="请从首页重新进入"
        action="返回首页"
        onAction={() => go("/home")}
      />
    </Page>
  );
}
export default function App() {
  return (
    <PortalProvider>
      <Routes />
    </PortalProvider>
  );
}
