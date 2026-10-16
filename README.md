# ola-training

企业培训平台：`admin/` 为 PC 管理端，`learner/` 为 PC 学员端，`backend/` 为独立业务后端，`frontend/` 为现有移动 H5（后续嵌入 App），`OpenMAIC/` 为独立 AI 课堂引擎，`shared/` 为共享业务类型。

管理端、PC 学员端与移动 H5 已调用同一个真实后端，课程、任务、知识文件、学习进度、考试、训练、收藏评价、检索会话等存入数据库。管理端本地 4180，PC 学员端 4181，H5 4173，内部业务 API 4190。原浏览器演示数据不会自动导入。

启动见 [PC 学员端说明](learner/README.md)、[管理端说明](admin/README.md)。技术选择与接口、备份见 [后端说明](backend/README.md)。`AI_ANALYSIS.md`、`admin/ADMIN_PLAN.md` 是早期分析，实际状态以当前 README 和代码为准。

三端和 OpenMAIC 的代码审核、能力边界、分阶段开发及验收条件见 [集成实施计划](INTEGRATION_PLAN.md)。管理端“AI 课堂能力”已加入企业模型配置与连接验证、资料解析、大纲审阅和本地制课任务；说明见 [模型配置](backend/AI_CONFIGURATION.md) 和 [本地制课](backend/AUTHORING.md)。本地 OpenMAIC 编辑器、播放器、发布快照和课堂运行记录已接入管理端/PC/H5。PC→H5 接续学习和管理报告已浏览器实测，见 [验收记录](CLASSROOM_QA.md)。企业/部门/成员内容权限统一覆盖详情、文件与助手引用。真实云模型待管理员稍后配置；外部 App 宿主未实测，见 [嵌入协议](frontend/APP_EMBEDDING.md)。手工课件和本地测试模型不能替代真实 AI 验收。训练自动评分、语音、完整多角色与实时 PBL 导师仍在后续计划中。三端共享视觉令牌位于 `shared/design-tokens.css`。

当前统一使用根 pnpm 工作区安装、构建及测试，见 [工作区说明](WORKSPACE.md)。

## 本地与 Tailscale 访问

使用 `pnpm install` 安装工作区依赖，`pnpm build` 构建，`pnpm test` 验证。后端在 `backend/` 下通过 `pnpm start` 启动；三个前端分别在 `admin/`、`learner/`、`frontend/` 下运行 `pnpm dev`。

三个前端监听全部网卡，端口为 4180、4181、4173；API 通过各前端的 `/api` 代理连接本机 4190。通过内网 IP 访问时，在 `backend/.env.local` 中配置 `EXTRA_ALLOWED_ORIGINS`，以逗号分隔三个前端的完整来源地址，例如 `http://100.64.0.6:4173,http://100.64.0.6:4180,http://100.64.0.6:4181`。重启后端后生效。

平台品牌为 `ola-training`，学习助手为 `ola`。数据库、账号密码、模型密钥、`.env.local`、依赖、构建文件和本地审查截图不纳入版本控制。首次启动会生成本地账号，详见后端说明。

## OpenMAIC 来源

`OpenMAIC/` 保存上游项目及本项目集成修改的源码快照，随主仓库提交，克隆后无需初始化子模块。上游为 [THU-MAIC/OpenMAIC](https://github.com/THU-MAIC/OpenMAIC)，原始许可证及版权声明保留在 [OpenMAIC/LICENSE](OpenMAIC/LICENSE)，其代码遵循该目录的许可证。
