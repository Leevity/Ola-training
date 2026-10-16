# 课堂编辑与 PC 学习验收

> 最新范围决定：用户明确模型配置及真实模型页面测试延期，由用户后续完成；App集成也延期。当前验收聚焦PC管理端、PC学员端、H5业务闭环。下文历史“等待模型配置”的阻塞描述不再作为当前完成门槛；真实AI结果仍必须标记待实测。

2026-10-15，本地 PGlite 服务、管理端4180、PC学员端4181。

本轮使用明确标注的“课堂编辑与学习验收（手工测试课件）”，由 `backend/scripts/setup-classroom-demo.mjs` 创建。它不是 AI 输出，不能替代真实模型制课验收。脚本仅允许本地 PGlite，重复运行不覆盖已有课程。

已通过浏览器实际操作验证：

1. 管理端打开 AI课堂 页签，加载本地 OpenMAIC 编辑器；双击画布文字编辑，修改场景标题，预览后发布 v2。
2. PC 学员看到修改后的 v2 课件；下一段讲解后记录写入服务端，刷新恢复到第2段。
3. 选择并提交课内练习，显示解析；刷新后仍保留答案和提交状态。课内练习不写入正式考试成绩。
4. 互动 HTML 中的按钮可以运行，iframe 仅设置 `sandbox="allow-scripts"`，没有同源、弹窗或顶层导航权限；CSP 阻止联网及表单。
5. 学员完成 v2 不会替代任务冻结的 v1 进度。打开指定任务，仍显示 v1 与原课件标题。
6. 学员完成该任务 v1 的3个课时，任务完成记录更新；管理端成员报告显示林雨欣、v1、3/3课时、任务已完成与最后活动时间。

截图：

- `admin/evidence/classroom-editor-preview.png`：画布文字编辑后的预览。
- `learner/evidence/classroom-quiz-saved.png`：实际答题与保存状态。
- `learner/evidence/classroom-task-version1.png`：发布 v2 后原任务仍播放 v1。
- `admin/evidence/classroom-task-completion-report.png`：管理端成员完成结果。

自动化覆盖：后端课堂运行态的成员/企业隔离、事件幂等、修订冲突、任务冻结版本报告；已完成课程后分配任务时同步完成结果；共享UI的脚本/事件/危险URL/越界样式净化及沙箱CSP。当前后端18项、管理端6项、PC学员端3项、共享课堂UI3项，共30项测试。

当前边界：H5 尚未接真实业务；App 宿主未实测；内容 ACL 尚待完整实现；真实云模型未配置。PBL 目前可以编辑定义并保存学习反思，实时导师/评价和完整多角色课堂动作调度仍按后续计划接入。互动区域的内部状态尚未映射为共享运行记录。上述范围未验收，因此完整目标仍未完成。


## 追加验收：PC → H5 与考试（2026-10-15）

以下结果覆盖上文过期的“H5未接入”和“ACL待实现”描述。

1. 脚本 `backend/scripts/setup-cross-device-demo.mjs` 创建明确标注的手工测试课程 `ola-cross-device-ui-demo` 与指定林雨欣的任务 `ola-cross-device-ui-task`；不是 AI 生成。
2. PC 完成第1课时，H5 登录同一成员后接续第2课时；课内答题提交、互动页面按钮与三个课时完成均实际操作。
3. PC 刷新显示3/3课时、100%；管理端成员报告显示同一冻结v1、3/3课时、已完成及最后活动时间。
4. H5 真实退出/重新登录，历史记录保留；390px视口无横向溢出。底部导航和原蓝白视觉保留，输入字号16px、顶部操作触点44px。
5. H5 实际创建考试 `dfe65959-ebb8-4912-82df-2bd86226453c`，单选/多选/填空自动保存；刷新恢复答案与服务端剩余时间；提交后服务端记录100分、合格。此为本地种子测试账号验收记录。
6. H5 创建训练 `507668e8-fc7e-4cd9-a720-bd908dfb63f1`，保存明确标注的联调测试表达并结束，服务端状态为待评价，没有伪造AI分数。
7. 内容ACL已覆盖企业/部门/成员、任务接收者、文件和助手引用；自动化校验撤销权限后历史引用脱敏、非接收成员与跨企业访问拒绝、顺序任务目录不暴露正文、作者选择成员仅返回必要字段。

截图：`frontend/evidence/cross-device-quiz.jpg`、`frontend/evidence/cross-device-completed.jpg`、`frontend/evidence/exam-result-live.jpg`、`admin/evidence/cross-device-task-report.png`。

最终检查：根 `pnpm test` 36项通过（后端19、管理6、PC3、课堂安全3、H5 5）。后端、管理端和H5最后修改后重新构建通过；PC此前共享SDK变更后构建通过。日志在忽略目录 `.deploy/final-tests.log`、`.deploy/final-build.log`。

仍未验收：真实云模型制课（管理员选择稍后配置）、外部原生App宿主、Docker/生产PostgreSQL。App协议单元测试和浏览器移动视口不代表真实App验收。完整多角色动作、实时PBL导师、Widget内部状态恢复、训练自动评价与语音仍在后续计划。


### 管理端评价回写追加

真实浏览器在数据报告中打开新训练记录，查看冻结v1目标与学员表达，填写标注为联调测试的88分人工评价并通过。保存后待评列表移除，企业操作记录出现评价训练，H5刷新显示已评价、88分与意见。证据：`admin/evidence/training-manual-review.png`、`frontend/evidence/training-reviewed-live.jpg`。

新增主观题自动化测试验证待评→管理员确认→学员90分结果，以及越权/跨企业/超分/重复阅卷拒绝。后端20项通过，全部应用累计37项。真实AI训练评价仍未实现，本次不是AI评分验收。


## 追加：考试并发与会话可靠性（2026-10-15）

- migration007 为现有考试增加答案修订，不删除历史答案。保存/主动带答案交卷校验revision；陈旧写入返回ANSWER_CONFLICT。超时只提交已保存答案，重复交卷保持原结果；相同答案在保存响应丢失后可安全重试。
- 共用 `ExamAnswerWriter` 序列化写入，冲突后停止全部排队请求。PC和H5明确提供“放弃本地更改并加载服务端答卷”，加载前锁定编辑和提交。
- 真实浏览器考试 `3c0e479f-ae86-403b-8902-70cba271e9e3`：H5先保存→PC旧答卷写入被拒绝→PC主动加载后完成第二题→PC保存填空→H5旧答卷写入被拒绝→H5重新加载保留全部答案→提交100分。没有用mock模拟浏览器请求。
- 共用传输层带账号/企业/成员上下文；后台拒绝上下文变化后的旧页面请求。只有CSRF_REFUSED才读取me核对身份，同一身份恢复令牌并重试一次，其他身份不重放。浏览器验证H5退出/同身份重新登录后，已打开PC页无需刷新成功收藏；随后恢复测试前未收藏状态。
- 根 `pnpm test` 最终47项通过：后端22、管理6、PC3、课堂UI3、H5与SDK13。后端/PC/H5最新构建通过。日志 `.deploy/cross-device-final-tests.log`、`.deploy/cross-device-final-build.log`。
- 截图：`learner/evidence/exam-cross-device-conflict.png`、`frontend/evidence/exam-cross-device-conflict.jpg`、`frontend/evidence/exam-conflict-recovered-result.jpg`、`learner/evidence/session-csrf-recovered.png`。
- 证据文件审核纠正：除home-live-390.jpg外，本轮H5截图实际为桌面浏览器中的移动布局（1265×712），不是390px视口。已采用准确文件名和JPEG扩展；旧路径仅为历史聊天链接兼容副本。home-live-390.jpg为375px内容宽度的移动截图。当前视口覆盖未实际作用到目标标签，不据此宣称新增390px考试/训练断点验收；真实App仍未验证。


## 追加：文件详情、解析恢复与知识引用下载

2026-10-15 浏览器实际验收：

1. 上传 `backend/tests/fixtures/knowledge-browser-qa.docx`（明确标注手工测试内容），显示待解析。
2. 在文件详情点击解析正文，显示1页、124字符及实际段落；可直接重新解析和刷新状态。
3. 将知识范围设为指定成员林雨欣，保存后重新打开详情仍保留选中项。此前范围组件仅被导入、未实际挂载的遗漏已修复；旧状态记录对该UI的描述不能替代本次证据。
4. H5工作知识检索发送“蓝鲸客户沟通验收资料”，返回该Word原文并排在相关结果前；PC打开同一个会话也能查看引用和下载入口。修复terminal入口漏检知识文件的问题。
5. H5通过引用链接下载 `C:/Users/80663/Downloads/knowledge-browser-qa.docx`，与上传fixture SHA-256一致：F61F8E5676D308602A0959D4121838AFE319F0CF46669E50739629F6A09AD164。
6. 管理端撤销该成员范围后，原下载链接返回NOT_FOUND，H5刷新历史会话隐藏该Word正文与入口，提示部分参考权限已调整。随后已恢复该测试成员授权。

新增保护：知识范围保存要求expectedAudience，陈旧窗口不能覆盖已修改范围；内容作者可设置本企业范围，非内容角色/跨企业和无效成员被拒绝。原件既可通过授权课程版本下载，也可通过知识自身范围下载，两种方式均重新授权。

解析中断恢复：mapKnowledge按3分钟租约判断是否仍在解析；过期任务显示“上次解析未完成，可重新解析”。自动化模拟中断后真实重新解析，清除错误并恢复正文页数。

证据：`admin/evidence/knowledge-parsed-preview.jpg`、`admin/evidence/knowledge-parsed-audience.jpg`、`frontend/evidence/knowledge-reference-download.jpg`。截图为当前桌面浏览器尺寸下的PC/H5页面，不冒充移动设备断点测试。

最终后端23项通过，新增范围/引用/下载/并发校验并扩充解析恢复覆盖。加此前其他模块25项，累计48项通过；后端、管理端、PC、H5构建通过。最新日志 `.deploy/material-recovery-tests.log`、`.deploy/material-recovery-build.log`、`.deploy/knowledge-final-build.log`、`.deploy/knowledge-pc-final-build.log`。

仍需真实供应商和外部App才能验收完整制课学习闭环。本次手工Word与原文检索不是AI生成或AI问答验收。下载权限失效时当前直接文件链接显示API错误页，后续可改为页面内错误提示；实际App下载处理仍待宿主验证。


## 追加：下载失败留在当前页面与App下载协议

2026-10-15：PC与H5的课程附件、知识引用改为共享SDK鉴权下载，成功后浏览器保存二进制原件；错误在原页面显示并允许重新点击，不再跳转至接口JSON页。

浏览器实际操作：

1. H5正常下载Word资料，保持原chat路由。
2. 管理端临时撤销测试成员权限；PC/H5点击已加载引用的下载按钮，显示“记录不存在或不可访问”，仍处于同一个会话页面。
3. 管理端恢复原授权；PC/H5原页面再次点击即成功下载，错误清除。下载 `knowledge-browser-qa (2).docx` / `(3).docx` 与上传fixture SHA-256均为 F61F8E5676D308602A0959D4121838AFE319F0CF46669E50739629F6A09AD164。
4. 最终错误样式核对：颜色rgb(199,56,56)，按钮下方单独分行；截图 `learner/evidence/download-permission-error-inline.jpg`、`frontend/evidence/download-permission-error-inline.jpg`。

原件文件名支持UTF-8并清理目录/控制字符；损坏编码安全回退。共享传输层支持未消费的二进制Response，错误继续按统一身份/权限规则处理。HEAD预检携带成员企业上下文，后端测试确认有权限时返回文件名与空正文。

App新增显式启用的download协议：H5先HEAD授权，发送固定资料路径/文件名/身份上下文，由原生宿主使用自己的WebView Cookie下载并在实际保存后回传download-result。协议不传Cookie、密码或CSRF；无能力、失败、超时和关闭给出真实状态。协议测试覆盖Android/iOS、路径限制、结果匹配、失败和清理；不是实际App文件保存验收。详见frontend/APP_EMBEDDING.md。

本轮后端23项和H5/SDK18项通过（41项），加未变更的其他12项累计53项。PC/H5最新构建通过；日志 `.deploy/download-ui-tests.log`、`.deploy/download-final-build.log`。本轮后端仅增加HEAD测试，没有运行代码变更，服务仍为session60793 / PID25704。

仍待：真实模型生成的完整课程闭环、外部App实际Cookie/文件保存/返回/后台恢复、编辑器素材管理及生产部署恢复检查。目标继续进行，未把协议单测或手工资料当成这些条件的通过证据。


## 追加：课程图片与提示音实际上传、发布及跨端学习

2026-10-15浏览器通过管理端实际操作：先保存课程草稿，再进入课堂编辑器创建场景，上传course-communication.webp和asset-tone-qa.wav，插入图片与音频。画布文字改为“课程素材：图片与提示音”，管理预览图片实际解码为760×400，点击试听进入暂停状态。上传期间编辑/关闭/发布受阻，结束后恢复。

课程“课程素材验收（手工测试课件）”ID fd7b8d35-9df3-4a64-b0ea-9bf8524d3f50 发布v1。PC/H5均从学员鉴权素材入口加载WebP，音频点击播放后显示Pause audio（成功启动播放）；PC完成1/1课时，H5刷新后目录✓、课堂记录已同步。随后管理员分配v1给林雨欣，报告“课程素材学习验收任务”展开明细显示该成员已完成、v1、1/1课时。分配前已完成的同版本进度被正确计入任务。

证据：admin/evidence/course-assets-preview.jpg、frontend/evidence/course-assets-learning.jpg、admin/evidence/course-assets-task-report.jpg。本轮为桌面浏览器中的PC/H5页面，不声称真实移动设备或原生App通过。音频为确定性1秒440Hz低音量测试音，所有课件明确是手工验收，不能替代真实AI制课验收。

统一pnpm test 55项通过；最终生产构建通过。日志.deploy/assets-final-tests.log、.deploy/assets-final-build.log。后端加载迁移008、session64406 / PID9036 / 4190。测试另覆盖冻结旧版本任务继续读取旧素材、未分配新版本素材拒绝、撤权后旧URL拒绝等。

尚未实测真实视频解码、App音视频权限/后台恢复、真实模型制课和生产备份恢复。音频控件仍有上游英文ARIA标签，列入后续UI语言与可访问性完善。


## 追加：媒体失败、中文音频控件与原页重试

2026-10-15：课堂播放器通过宿主扩展提供音频播放/暂停/加载中的中文名称和44px按钮；图片/音频/视频分别显示实际加载失败与重试。错误区位于画布外，避免小音频元素尺寸裁切提示。浏览器禁止播放与一般网络/格式失败区别提示；离开页面暂停音频，迟到的play结果不得恢复播放。图片继续使用上游排版/滤镜/裁切内容。

浏览器实际验收：仅将手工QA课程的WebP和WAV文件临时移到同目录备用名称，PC/H5刷新并点击播放，实际接口503导致两端显示图片和音频失败及重试按钮；随后文件已移回原路径，无覆盖/删除。两端在原页面点击重试后图片解码760×400，音频进入“暂停音频”pressed状态，错误消失，1/1完成目录保持。素材最终hash：WebP 348742F2112CD684BA875C019B566D11ECB81CA7D0B33604B07F5EC6E45E2373，WAV D39C56E1F27B1207D67A746D81EBD0E168062CEF2D037808CD0B5560A9A82320。

截图：learner/evidence/media-missing-inline.jpg、frontend/evidence/media-missing-inline.jpg、frontend/evidence/media-retry-restored.jpg。仍为桌面浏览器中的PC/H5页面，不代表真实移动设备/原生App验证。

共享课堂UI8项通过，其中新增媒体故障/卸载/图片视频重试3项及上游音频slot契约2项；其余模块本轮未变更未重跑，结合前轮累计61项。renderer与三端生产构建通过。日志.deploy/media-final-tests.log及media-*-build.log。上游独立Vitest命令缺失，本轮未运行其完整套件，使用实际构建包的宿主契约测试和浏览器联调作证。

真实视频解码、实际App权限和后台恢复、真实供应商制课仍待验收，目标继续进行。三端dev已重新优化依赖：管理session69963、PC9010、H539612，后端74842未改动。


## 追加：任务成员明细实际导出

2026-10-15：管理端报告新增所选任务学习明细CSV，原总览导出明确命名为任务汇总。通过实际浏览器点击下载“课程素材学习验收任务”的明细，文件保存至Downloads/任务学习明细-c2b90856-6cdc-4b47-9b4d-ed91ca891c38.csv；用Python csv.DictReader读取核对共1行、林雨欣、课程ID fd7b8d35-9df3-4a64-b0ea-9bf8524d3f50、冻结v1、1/1课时、课程及任务已完成，与展开页面相符。

证据：admin/evidence/task-learning-report.csv、admin/evidence/task-report-export.jpg。此次只是手工验收课程记录，不是云模型制课输出。

新增后端集成测试构造32成员，页面30人而导出含全部32人；部门管理员仅31人且不含其他部门，学员/内容作者403，其他企业404。带公式前缀的成员姓名安全转义。报告与导出使用repeatable-read只读事务；导出超过1万成员/10万行拒绝。最新后端27项通过、后端及管理构建通过；其余未变更模块未重跑，累计63项。

日志.deploy/report-backend-tests.log、report-backend-build.log、report-admin-build.log。后端session54249 / PID26804已加载当前构建；原模型配置窗口保留，其他三端服务不变。完整真实模型/App闭环和生产部署仍未验收。


## 追加：课堂保存断网重试与跨端冲突

2026-10-15：共用ClassroomSession改用SceneWriter串行保存，网络/5xx失败保留失败请求的eventId、revision和状态，重试复用同一个事件，以覆盖“服务端已提交但响应丢失”的情况。失败期间的最新排队状态保留，恢复后再用新revision写入；400/401/403/409不自动重试。错误时普通重试与重新加载分开，重新加载前提示未保存内容替换；反思文字可在只读框选中复制。

同步未确认时，PC/H5完成课时和课程目录/上一课时禁用。新增pagehide/visibilitychange尝试刷新防抖队列和beforeunload提示；迟到的初始读取通过序号忽略。页面内存不是持久离线库，系统强杀WebView不能保证最后请求完成；当前普通浏览器历史返回、全局导航和App宿主导航仍需补齐统一离开拦截与实机验收，不声称完全防丢。

浏览器实际步骤：

1. PC打开既有手工课程ola-cross-device-ui-demo v1（此前已完成3/3课时）。正常停止业务服务后点击下一段讲解，页面保持2/3并显示未保存及保留当前内容重试；目录和完成按钮禁用。
2. 启动同一业务服务后，点击原页重试，状态变为课堂记录已保存，位置仍2/3；H5打开同课程恢复2/3。
3. PC推进到3/3并保存；H5旧页面回到1/3，服务端409拒绝。H5显示另一设备已更新，没有普通重试按钮，目录/完成禁用。
4. H5主动重新加载后恢复服务端3/3，错误清除，目录/完成恢复可用。未覆盖PC记录；课程完成数一直3/3。

证据：learner/evidence/classroom-save-retry-error.jpg、frontend/evidence/classroom-runtime-conflict.jpg、frontend/evidence/classroom-runtime-recovered.jpg。浏览器证据针对讲解位置；反思内容快照/排队保留由新增测试覆盖，未把单测称为真实App反思验收。

共享课堂UI12项通过（新增SceneWriter4项），PC/H5最终构建通过；其他模块未改未重跑，累计67项。日志.deploy/scene-writer-final-tests.log、scene-pc-final-build.log、scene-h5-final-build.log。业务后端本轮无代码变化，故障演练后已恢复session63664 / PID14748 / 4190；健康检查成功。


## 追加：共用课堂离开守卫

2026-10-15：shared/navigation-guard.ts与ClassroomSession接入。未保存状态离开时先flush防抖队列并提示；PC/H5站内导航、退出、切换企业和H5返回走同一检查。原始hash链接或浏览器hash历史变化在React更新路由前检查，取消时restore已接受URL/state；同一次已确认导航不重复询问。卸载清理守卫，已保存课堂不拦截。根App返回取消不报告back-at-root，导航消息延迟到守卫处理完成，避免宿主看到被拒绝的新地址。

自动化：UI14项通过（新增导航2项），H5/SDK21项通过（新增App取消与消息顺序2项）；PC/H5构建通过。取消保留URL/history.state、Provider写入深度保留、确认只检查一次、注销清理均有测试。完整WebView返回栈仍待实际宿主验收，replaceState取消浏览器返回会重写被访问条目，不承诺浏览器历史栈完全不变。

浏览器实际验证已保存课堂从PC全局“我的任务”正常离开，任务仍保留课程素材任务/跨端任务等完成状态。截图learner/evidence/classroom-leave-saved.jpg。本轮未把原生confirm取消称为实际App验证；取消逻辑证据来自受控测试。

日志.deploy/navigation-ui-tests.log、navigation-h5-final-tests.log、navigation-pc-build.log、navigation-h5-build.log。结合未改动模块累计71项，后端无需变更仍session63664 / PID14748。真实模型、实际App和生产环境待验收。


## 追加：考试/训练未保存守卫与训练原子结束

2026-10-15：PC/H5考试未保存答案接入统一路由/退出/App离开检查，提示离开后考试计时继续，并尝试发送待保存答案。训练输入草稿接入同一守卫及beforeunload；发送/结束时禁用输入框，PC角色选择同步禁用。系统强杀和真实WebView返回仍未验证。

结束训练新增可选draft，单事务保存当前表达+转待评价；重复请求不多存消息，已评价记录重试不改回待评。后端测试覆盖原表达ID冲突回滚、原子保存、重复结束、结束后拒绝新表达、跨企业拒绝及评分保留。后端28项、共用UI15项通过，后端/PC/H5构建通过；其他模块本轮未改未重跑，累计73项。

实际浏览器H5新开训练af9c972b-728e-46ca-83f5-9a8685a75669，课程fujian-c2 v1，输入“【手工验收】先询问客户使用场景和预算，再复述确认；这段表达未单独点击保存，将随结束训练一起提交。”后直接点击结束训练，未点击保存表达。进入复盘显示待评价和该原文。PC打开同一记录话术复盘显示1条原表达；管理端21:24:47记录详情也显示该原文。管理员只查看后取消，没有提交评分，记录仍待人工评价。

证据：frontend/evidence/training-finish-draft.jpg、learner/evidence/training-finish-draft-recap.jpg、admin/evidence/training-finish-draft-review.jpg。浏览器实际验证为H5提交、PC和管理查看，不扩大为PC结束按钮/App原生取消已实测。PC结束路径有构建和同一后端接口契约证据，后续继续浏览器验收。

最新业务后端session20162 / PID14824 / 4190；故障与迁移无变动。日志.deploy/training-atomic-tests.log、training-guard-tests.log、training-backend-build.log、training-pc-build.log、training-h5-build.log。PC新记录复盘在概览缓存未更新时显示通用“训练复盘”标题，课程标题恢复体验待完善。


## 追加：PC独立结束训练、复盘标题与既有记录版本

2026-10-15：学员训练GET新增经授权的冻结course元数据，PC训练/复盘和H5复盘显示正确课程名与版本，解决直接打开新记录时概览缓存无条目导致通用标题。PC训练“记录自动保存”改为“点击保存表达 · 结束时一并保存当前输入”，不误导为逐字离线自动保存；角色变化为新表达更新消息ID，发送时禁止切换角色。

测试发现另一个实际权限逻辑遗漏：无任务的自主记录在课程发布新版后会被旧版本课程入口规则拒绝。新增本人既有recordCourse路径，当前ACL继续检查，冻结版本只供本人考试/训练记录继续/查看；原课程正文和旧版本新建仍受限制，前置锁定不绕过。测试实际发布新版后，原训练可发消息/结束，旧答卷可保存/提交；撤权后两者拒绝，他人答卷拒绝，旧题目不泄露标准答案。

浏览器PC独立新开训练e91a50d0-666b-4d70-9b89-42c4c2710b59，输入“【PC手工验收】先确认客户预算与使用人数，再说明推荐理由。这段内容直接随结束操作保存。”，不点保存，点击结束训练并确认。PC复盘显示1条带[顾问]前缀的表达、正确课程名和v1；H5打开同记录显示同一原文、课程名/v1/待评价；管理端21:32:16详情原文一致。只查看并取消评价，没有提交评分。

截图learner/evidence/pc-training-draft-finished.jpg、frontend/evidence/pc-training-draft-shared.jpg、admin/evidence/pc-training-draft-review.jpg。跨版本授权是临时库HTTP集成测试，实际业务库没有为测试修改原课程版本。

后端29项通过，后端/PC/H5最终构建通过；其他未变更模块未重跑，累计74项。日志.deploy/record-versions-tests.log、record-versions-build.log、record-pc-final-build.log、training-metadata-h5-build.log。当前后端session12572 / PID27036 / 4190健康；原模型配置窗口保留。


## 追加：管理端题库、100分发布与PC/H5成绩

2026-10-15：管理端考试编辑新增题库，支持五种题型、选项/标准参考答案/解析/分值及停用恢复。使用既有蓝白组件与令牌；截图检查发现编辑按钮原生样式，已改用统一button样式。未保存试题阻止课程发布，切换页签保留编辑，保存期间禁止关闭/发布。

服务端新增active（默认true兼容旧题），只冻结启用题目；发布考试必须非空且合计100，失败回滚。新增测试覆盖空/停用/非100分拒绝、失败保留草稿或原v1、恢复后v2发布、旧v1答案A及新v2答案B各按冻结答案得100，学员题库拒绝与标准答案不泄露。原29项加1项，后端30项通过、后端/管理端构建通过；其他未改模块未重跑，累计75项。

浏览器管理端新建“题库编辑验收（手工测试试卷）”，课程ID b5560113-9bd9-4f4e-b889-28f11925fd99，保存草稿后添加100分单选“【手工验收】推荐方案前，应该先做什么？”，答案A确认场景与预算。实际停用→0题0分→发布拒绝，恢复→100分→发布v1成功。没有修改既有业务考试题目。

PC从课程中心启动该试卷，答卷bf0e2a76-5c6a-4389-ab3c-b5cc4241ae01，选择A并确认交卷，服务端100分通过；H5打开同答卷也显示100分。此为手工试卷，不是AI题目生成验收，未新建对应任务。

证据：admin/evidence/question-bank-inactive-blocked.jpg、question-bank-ready.jpg、question-bank-published.jpg；learner/evidence/question-bank-exam-result.jpg、frontend/evidence/question-bank-exam-result.jpg。本轮真实UI针对单选及启停发布，其他题型具备实现与既有接口覆盖，未声称五类页面均已逐项浏览器验收。

本轮开发热更新后管理端首次草稿保存遇CSRF失败，未写入；刷新该测试tab后同内容保存成功。原模型配置tab2未刷新/改动。此开发会话恢复问题仍需后续修复，不能声称自动恢复已实现。

日志.deploy/questions-final-tests.log、questions-final-backend-build.log、questions-final-admin-build.log。后端session69907 / PID23952 / 4190已加载新校验。真实供应商、实际App和生产验收继续待完成。


### 管理端会话恢复验证（2026-10-15）
- 管理端受控transport测试：同身份恢复、账号/企业/成员变化拒绝、网络错误不重放、权限/版本/服务器错误不重放、恢复期间本地切换会话、FormData与Blob兼容、恢复次数上限、身份缺失阻止发出请求。
- 后端临时数据库真实Fastify认证钩子：陈旧CSRF调用切企业→403→me→同身份重试成功；随后旧context再发切企业请求→SESSION_CHANGED且企业保持不变，最终恢复测试企业。
- 结果：admin19、backend31，日志 .deploy/admin-session-tests.log、.deploy/admin-session-backend-tests.log；管理端构建 .deploy/admin-session-build.log。
- 此证据是可执行传输/服务端集成测试，不是浏览器cookie轮换实测。原模型配置页保留输入，未强制刷新。此次没有修改正式业务记录或真实模型配置。


### 2026-10-15 H5交卷确认可访问性
替换无焦点管理的遮罩为原生模态dialog，补齐Tab双向循环、Escape取消、滚动锁和焦点返回。真实浏览器390×844验证取消保留答案、确认后服务端100分；答卷d000f21a-30d1-4fa6-bff4-f9e9d9df1c6e属于手工测试试卷第二次作答。截图frontend/evidence/exam-confirmation-390.jpg与exam-confirmation-result-390.jpg；构建.deploy/h5-dialog-build.log通过，存在已有大chunk提示。本轮未重跑后端/其他前端测试，实际App及真实AI验收仍未完成。原模型配置页保留，未刷新输入。


### 2026-10-15 制课大纲未保存保护
代码审核发现审阅大纲时切换任务、关闭AI课堂服务窗口会直接丢弃编辑。本次补充未保存提示：切换/重载任务、取消任务、关闭窗口需确认放弃；浏览器刷新/关闭使用beforeunload保护。任务加载失败时仍保留原大纲和选中任务，保存成功后才清理dirty标记。
同时为加载增加请求序号，操作开始使旧轮询失效；操作期间暂停定时轮询，以免旧结果覆盖新任务/保存结果；互斥标记阻止同一帧重复操作。只影响管理端，后端任务状态机和发布语义不变。
验证：管理端TypeScript及生产构建通过（.deploy/authoring-draft-guard-build.log，已有chunk体积提示仍在）。本轮未配置模型或生成新的真实大纲，未声称已通过真实大纲浏览器交互验收；以上离开确认和网络竞态仍需在可用制课任务中验证。原模型配置页未刷新，输入保留。


### 2026-10-15 企业试用指南
管理端“使用指南”已按现有按钮与流程扩展为8步，覆盖账号、解析、模型验证、大纲审核、草稿编辑发布、指定成员任务、跨端保存、报告核验，并提供失败恢复及考训能力说明。修正backend/README.md过时npm ci与PDF/Office未解析描述，统一根pnpm工作区。管理Modal焦点列表补入链接及summary，避免新折叠项逃出焦点循环。
验证：管理端构建通过（.deploy/usage-guide-build.log）；真实浏览器展开故障处理说明、截图admin/evidence/usage-guide.jpg；完整重载测试页后，末尾summary按Tab回到关闭按钮，关闭按钮Shift+Tab回到末尾summary。热更新前旧事件闭包未反映新选择器，已通过重载测试页复验；用户原模型配置页未刷新。未运行实际云模型、原生App或生产部署；操作指引不等同于这些验收已完成。


### 最新工作区回归及App范围决定
根pnpm test实际执行并退出0，五个套件31+19+3+15+21=89全部通过；日志.deploy/workspace-regression-latest.log。用户明确本轮不做App，后续H5集成，因此原生App验收不再作为当前目标门槛。真实供应商完整生成链仍缺验收证据。未运行生产Docker/PostgreSQL测试；仅确认本机PATH无docker/psql命令。


### 当前范围收尾：课程与任务未保存保护
按用户决定，真实模型测试与App集成延期。修复课程编辑仅保护试题却未保护正文/课堂修改的问题，课程和任务编辑均加入关闭确认、beforeunload提醒，任务保存中禁止关闭。课程比较初始快照，撤销回原内容后不再提示。
验证：管理端构建成功（.deploy/editor-unsaved-build.log）；真实浏览器在已有手工测试课程中修改标题，关闭产生confirm，dismiss后新标题仍在；恢复原标题后可直接关闭。未保存或发布任何业务变更。截图admin/evidence/course-unsaved-retained.jpg。任务关闭/刷新路径本轮仅代码及类型检查，未声称完成所有浏览器路径。最近全工作区89项通过发生在此次UI修改之前。


### 2026-10-15 最终对账与页面内关闭确认
重新通过真实管理页面读取“PC 到 H5 跨端验收任务”：林雨欣，跨端学习验收（手工测试课件）v1，3/3课时，任务已完成，最后活动2026/10/15 21:11:49。证据admin/evidence/final-cross-device-report.jpg。
任务原生confirm自动化出现阻塞，不能据此声称已通过。课程/任务改成页面内“继续编辑/放弃修改并关闭”确认，刷新警告仍用beforeunload。真实浏览器修改既有任务草稿标题后点击关闭，继续编辑保留修改；再次关闭并放弃，列表仍为原任务标题，未保存业务改动。证据admin/evidence/task-unsaved-confirmation.jpg。管理端构建通过(.deploy/editor-unsaved-build.log)。本轮没有重跑整个89项套件，不冒充全场景UI验证。


### 最终复查
最终根pnpm build退出0。PC重新加载ola-cross-device-ui-demo显示v1、100%；H5任务列表ola-cross-device-ui-task已完成100%；管理端同一成员v1、3/3已完成。截图learner/evidence/final-course-progress.jpg、frontend/evidence/final-task-progress.jpg、admin/evidence/final-cross-device-report.jpg。当前范围按用户决定不含真实模型与App验收；完整本轮结论见IMPLEMENTATION_STATUS.md首节。
