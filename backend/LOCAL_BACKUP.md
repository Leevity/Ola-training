# 本地数据备份与隔离恢复

适用：安装了开发依赖的本项目工作区、本地PGlite后端，使用相同依赖/后端版本恢复。工具基于tsx运行，不包含在仅生产依赖的部署镜像中。生产外部PostgreSQL请使用pg_dump/pg_restore与文件卷备份，本工具不转换数据库。

## 操作步骤

从仓库根目录执行以下命令；pnpm filter脚本的相对路径以backend为基准。备份前用运行终端Ctrl+C正常停止后端，并确认4190不再监听。不要在旧版本后端（尚无数据锁）运行时复制目录。

```powershell
pnpm --filter ola-training-backend data:local backup ./data ../.deploy/backup-20261015-example
pnpm --filter ola-training-backend data:local verify ../.deploy/backup-20261015-example
pnpm --filter ola-training-backend data:local restore ../.deploy/backup-20261015-example ../.deploy/restore-20261015-example
pnpm --filter ola-training-backend data:local audit ../.deploy/restore-20261015-example
```

每次使用新的备份和恢复路径，已存在的目标不会覆盖。源与目标不能嵌套，不支持符号链接。备份保留所有文件及空目录，包含postgres、files知识原件、assets课程素材和本地ai-encryption-key；清单记录路径、长度、SHA-256和空目录。只有校验通过才把.partial目录改为最终目录。失败时保留.partial供排查，不自动删除；确认内容后自行处理，再使用新路径重试。

verify只校验备份，不打开数据库；audit会打开隔离恢复副本，核对迁移、业务表计数及知识/素材原件hash。数据库启动可能修改恢复副本文件，所以不要对备份原件运行audit，也不要拿audit后的副本与原物理备份逐文件比较。先verify，再restore，再audit。

完成隔离核验后，可以在backend目录设置DATA_DIR为恢复目录的绝对路径，使用新端口启动相同版本后端，登录验证课程、任务、进度和报告。切换正式服务时先正常停止原服务，保留旧数据目录，修改DATA_DIR后启动。不要同时启动两个PGlite进程读写同一目录，也不要直接覆盖正在运行的数据目录。

## 进程锁与恢复限制

本地服务及备份/audit共用数据目录.ola-data.lock，使用排他创建；检测到锁即拒绝启动或备份，不会根据PID自动抢占。正常Ctrl+C会先停止后台任务和HTTP服务、关闭数据库，再释放锁；启动失败也释放。异常断电/强杀可能留下锁：先查看锁中PID并在操作系统确认对应进程已停止，确认没有旧后端/维护命令使用目录后再手工移除锁。不要删除运行中进程的锁。

数据锁是本项目进程约定，不会阻止第三方直接修改文件；校验期间不要用其他工具改写目录。恢复到新的目录可避免破坏当前业务库，SHA-256用于发现缺失或损坏，不是防篡改签名。

备份含账号密码哈希、会话和可能存在的模型加密密钥，应存放在受控位置；.deploy和data已在gitignore中。环境变量AI_CONFIG_ENCRYPTION_KEY、.env等不在数据目录内，本工具不会复制它们：部署时必须另外保管并恢复相同的外部密钥，否则数据库中的模型凭据无法解密。不能以备份存在代替可恢复性验证。

## 2026-10-15实际演练证据

- 已停止旧后端，备份当前业务数据1135文件、30,048,693字节到根.deploy/local-backup-20261015，再恢复到.deploy/local-restore-20261015。
- 清单校验通过；隔离副本实际打开，迁移001–008齐全：2企业、18成员、14课程、13发布版本、8任务、18分配、11学习记录、4课堂运行记录、3答卷、2训练、4知识记录、2素材及2发布素材引用。4个有文件引用的知识/素材原件hash均通过。
- 通过隔离副本的真实Fastify业务接口登录核对：课程“课程素材验收（手工测试课件）”v1、林雨欣1/1进度、对应任务完成1人；学员图片与Word下载200且hash一致。不是仅检查目录存在。详见.deploy/restored-business-evidence.json和.deploy/local-restore-audit.log。
- 原业务服务恢复在4190；新服务session74842 / PID23240。运行中备份拒绝，以及第二实例启动拒绝均有日志。模型配置窗口没有改动。
- 自动化发现并修复仅复制文件会丢失PGlite空目录、恢复后启动失败的问题；测试现覆盖真实库恢复、原件引用、加密密钥文件保留、目标不覆盖、目录不嵌套、文件损坏及非法路径拒绝。

这是本地恢复演练；没有生产Docker、外部PostgreSQL或跨数据库版本恢复的通过证据。
