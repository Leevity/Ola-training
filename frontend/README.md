# 移动 H5 / App 用户端

React + TypeScript + Vite 移动学习应用，保留首页、课程、ola、任务、我的五栏导航与 [视觉标准](STYLE-GUIDE.md)。当前页面通过共享 `@ola/learner-client` 访问业务后端，使用 HttpOnly 登录会话；原前端演示保留在 `prototype/`，不参与运行。

在仓库根目录执行：

```powershell
pnpm install --frozen-lockfile
pnpm build:maic
pnpm --filter ola-training-backend build
pnpm --filter ola-training-backend start
# 另一个终端
pnpm --filter ola-training dev
```

访问 http://127.0.0.1:4173，Vite 将 `/api` 代理到本地 4190；后端须已配置并启动。生产使用 `frontend/Dockerfile` 和根 compose 的 mobile 服务，页面与 API 通过同源代理访问。详见 [工作区说明](../WORKSPACE.md)。

## 已接入的业务

- 登录、退出、多企业切换；真实课程筛选、收藏和评价。
- 任务阶段、冻结课程版本、先后顺序与完成情况。
- 文本/视频/本地 OpenMAIC 课堂、答题和讲解位置保存，与 PC 共用学习记录。
- 服务端考试会话、自动保存、刷新恢复、计时、客观题评分和主观题待评。
- 训练表达保存、结束待评价、历史记录；知识原文检索与会话记录。

考试跨设备同时修改已通过修订保护：遇到冲突停止保存，主动加载服务端答卷后继续。训练自动评分、语音对练及助手的生成式回答尚未接入。OpenMAIC 的完整多角色动作、实时 PBL 导师和 Widget 内部状态恢复仍是后续工作。

## App 嵌入

宿主使用同一套 H5 页面，协议与验收清单见 [APP_EMBEDDING.md](APP_EMBEDDING.md)。已实现 Android/iOS 消息桥、内部导航、根页返回、会话失效与退出，以及显式启用的原生下载协议；协议单元测试通过。原生下载须宿主按协议实现，未接入会明确提示。仓库没有原生 App 壳，真实宿主的登录、返回、下载和网络恢复须在外部 App 中继续验收。

浏览器实测与截图见 [CLASSROOM_QA.md](../CLASSROOM_QA.md)。真实 AI 制课须管理员稍后填写模型配置，手工课件不代表真实模型验收。
