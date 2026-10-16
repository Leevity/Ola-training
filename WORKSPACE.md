# 工作区运行与构建

环境：Node.js 22.19+，pnpm 10.26.2。根目录执行 `pnpm install --frozen-lockfile`，然后 `pnpm build`。`pnpm test` 运行业务后端、管理端、PC学员端、共享课堂安全及H5/共享SDK的回归测试。

根 `pnpm-lock.yaml` 是当前业务项目依赖的唯一锁文件；四个应用旧 npm 锁文件已移除。OpenMAIC 自身的独立锁文件仍保留用于其上游开发，不用于本项目构建。不要在子应用运行 `npm install` 或 `npm ci`，因为后端本地依赖使用 `workspace:*`。

开发时分别运行：

```text
pnpm --filter ola-training-backend dev
pnpm --filter ola-training-admin dev
pnpm --filter ola-training-learner dev
pnpm --filter ola-training dev
```

首次使用或上游包变更后先执行 `pnpm build:maic`，生成本地 DSL、generation、renderer、editor 的构建产物。后端4190，管理端4180，PC学员端4181，H5默认4173。浏览器访问各前端的 `/api` 代理；不要让浏览器直接访问受限端口4190。

Dockerfile 已改用根工作区依赖和 pnpm；后端使用 deploy 打包本地 generation 的提示词资源和 DSL。实际容器构建与外部 PostgreSQL 仍待有 Docker 的环境验收。

OpenMAIC 基线见 `shared/openmaic-baseline.json`。本轮本地适配没有改写生成器或 DSL 逻辑。renderer 构建脚本依据锁定 KaTeX 版本重新生成了 `src/snapshot/katex-fonts-embed.ts`；这是生成产物差异。原有头像、脚本和桥接修改保留。


## 上游媒体扩展与升级检查

本地renderer新增可选renderAudio扩展，沿SlideCanvas / SlideRendererProvider → SlideElement → BaseAudioElement传递；省略时保留上游默认控件。宿主课堂UI负责中文控件、播放许可/网络失败提示和重试，不将业务逻辑写入生成器或DSL。图片和视频继续使用已有renderImage/renderVideo扩展，图片保留上游裁切、滤镜和遮罩内容。

升级OpenMAIC时须核对这四个源文件的renderAudio签名及传递，并先构建renderer再运行`pnpm --filter @ola/classroom-ui test`。该测试包含宿主/Provider覆盖、空输出和默认行为契约。上游包重建后开发服务器可能缓存旧依赖，必要时重启三端dev并加--force；只刷新浏览器不能证明新包已加载。上游renderer独立Vitest套件本轮未运行（包没有链接vitest命令），不要把共享UI测试称为全部上游测试通过。
