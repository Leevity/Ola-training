import { knowledgeDownloadPath, filenameFromDisposition } from "./download";
import type {
  Attempt,
  Chat,
  Course,
  Overview,
  Tenant,
  Training,
  User,
} from "./types";
// API functions may reload independently of the authenticated session instance.
import { transport } from "./session";
export { ApiError } from "./transport";
export const request = <T>(path: string, method = "GET", body?: unknown) =>
  transport.request<T>(path, method, body);
export async function me() {
  const r = await request<{ user: User; tenants: Tenant[]; csrf: string }>(
    "/auth/me",
  );
  transport.setSession(r.user, r.csrf);
  return r;
}
export async function login(email: string, password: string) {
  const r = await request<{ csrf: string }>("/auth/login", "POST", {
    email,
    password,
  });
  transport.clear();
  transport.csrf = r.csrf;
}
export const logout = async () => {
  await request("/auth/logout", "POST", {});
  transport.clear();
};
export const overview = () => request<Overview>("/learn/overview");
export const course = (id: string, version: number) =>
  request<Course>(
    `/learn/courses/${encodeURIComponent(id)}/versions/${version}`,
  );
export const complete = (c: Course, lessonId: string, eventId: string) =>
  request("/learn/progress", "POST", {
    courseId: c.id,
    version: c.version,
    lessonId,
    eventId,
  });
export const startExam = (c: Course) =>
  request<Attempt>(`/learn/exams/${c.id}/attempts`, "POST", {
    version: c.version,
  });
export const attempt = (id: string) =>
  request<Attempt>(`/learn/attempts/${id}`);
export const saveAnswers = (
  id: string,
  answers: Attempt["answers"],
  revision: number,
) =>
  request<{ revision: number }>(`/learn/attempts/${id}/answers`, "PUT", {
    answers,
    revision,
  });
export const submitExam = (
  id: string,
  answers?: Attempt["answers"],
  revision?: number,
) =>
  request<Attempt>(
    `/learn/attempts/${id}/submit`,
    "POST",
    answers ? { answers, revision } : {},
  );
export const startTraining = (c: Pick<Course, "id" | "version">) =>
  request<{ id: string }>("/learn/training", "POST", {
    courseId: c.id,
    version: c.version,
  });
export const training = (id: string) =>
  request<Training>(`/learn/training/${id}`);
export const sendTraining = (id: string, text: string, messageId: string) =>
  request(`/learn/training/${id}/messages`, "POST", { id: messageId, text });
export const finishTraining = (
  id: string,
  draft?: { id: string; text: string },
) => request(`/learn/training/${id}/finish`, "POST", draft ? { draft } : {});
export const favorite = (id: string, value: boolean) =>
  request(`/learn/favorites/${id}`, "PUT", { favorite: value });
export const review = (
  id: string,
  version: number,
  rating: number,
  comment: string,
) =>
  request(`/learn/courses/${id}/review`, "PUT", { version, rating, comment });
export const reviews = (id: string) =>
  request<{
    items: {
      rating: number;
      comment: string;
      name: string;
      version: number;
      updated_at: string;
    }[];
  }>(`/learn/courses/${id}/reviews`);
export const readNotices = (ids: string[]) =>
  request("/learn/notifications/read", "POST", { ids });
export const sessions = () =>
  request<{
    items: { id: string; app: string; title: string; created_at: string }[];
  }>("/learn/assistant/sessions");
export const createChat = (app: string, title: string) =>
  request<{ id: string }>("/learn/assistant/sessions", "POST", { app, title });
export const chat = (id: string) =>
  request<Chat>(`/learn/assistant/sessions/${id}`);
export const sendChat = (id: string, text: string, messageId: string) =>
  request(`/learn/assistant/sessions/${id}/messages`, "POST", {
    id: messageId,
    text,
  });
export type SceneRuntime = {
  revision: number;
  state: import("../../../shared/classroom.ts").SceneState;
};
const runtimePath = (courseId: string, version: number, sceneId: string) =>
  `/learn/courses/${courseId}/versions/${version}/classroom/scenes/${sceneId}/runtime`;
export const sceneRuntime = (
  courseId: string,
  version: number,
  sceneId: string,
) => request<SceneRuntime>(runtimePath(courseId, version, sceneId));
export const saveSceneRuntime = (
  courseId: string,
  version: number,
  sceneId: string,
  revision: number,
  state: SceneRuntime["state"],
  eventId: string,
) =>
  request<SceneRuntime>(runtimePath(courseId, version, sceneId), "PUT", {
    revision,
    state,
    eventId,
  });

export const switchTenant = (tenantId: string) =>
  request("/auth/switch-tenant", "POST", { tenantId });
export const leaderboard = () =>
  request<{
    items: {
      id: string;
      name: string;
      department: string;
      rank: number;
      tasks: number;
      lessons: number;
      exams: number;
      isMe: boolean;
    }[];
  }>("/learn/leaderboard");

export { ExamAnswerWriter } from "./answer-writer";

export async function prepareKnowledgeDownload(
  id: string,
  course?: { courseId: string; version: number },
) {
  const path = knowledgeDownloadPath(id, course),
    context = transport.context;
  const response = await transport.request<Response>(
    path,
    "HEAD",
    undefined,
    "response",
  );
  return {
    path: "/api" + path,
    filename: filenameFromDisposition(
      response.headers.get("content-disposition"),
    ),
    context,
  };
}
export async function downloadKnowledge(
  id: string,
  course?: { courseId: string; version: number },
) {
  const response = await transport.request<Response>(
    knowledgeDownloadPath(id, course),
    "GET",
    undefined,
    "response",
  );
  return {
    filename: filenameFromDisposition(
      response.headers.get("content-disposition"),
    ),
    blob: await response.blob(),
  };
}
export { triggerBrowserDownload } from "./download";
