# App 嵌入 H5 · 协议 v1

首期 App 使用同一套移动 H5。宿主加载部署后的 HTTPS 首页，例如 `https://mobile.example.com/#/home`，开启 JavaScript、DOM storage 和常规第一方 cookie。用户在 H5 登录，业务会话保存在 HttpOnly cookie 中，PC/H5 使用同一账号与后端。无需把账号密码、长期令牌或模型密钥通过 URL/JavaScript 传入页面。

## 宿主接口

Android 提供 `window.OlaTrainingHost.postMessage(jsonString)`；iOS 提供 `window.webkit.messageHandlers.olaTraining.postMessage(object)`。只向受信任的培训 H5 域名注入接口，外部链接交给系统浏览器，不把接口带入未知站点。

页面加载后发送：

```json
{"version":1,"type":"ready","payload":{"capabilities":["navigation","refresh","logout"],"authentication":"httpOnlyCookie"}}
```

页面发送 `navigation`（payload.path 为站内 hash 路由）、`session-expired`、`back-at-root` 和请求结果 `result`。协议不发送密码、cookie 或模型密钥。

宿主调用 `window.olaTrainingReceive(message)`，可传对象或 JSON 字符串：

```json
{"version":1,"requestId":"open_tasks_1","type":"navigate","payload":{"path":"/tasks"}}
```

| type | 行为 |
| --- | --- |
| navigate | 打开站内路由，拒绝外部 URL 和协议地址 |
| back | 回退 H5 内部历史；已到初始页时发送 back-at-root，由宿主决定退出 |
| refresh | 重新同步学习数据 |
| logout | 退出当前 H5 会话 |

结果：`{"version":1,"type":"result","requestId":"open_tasks_1","payload":{"ok":true}}`。不认识的版本/类型、无效 requestId 和非法路由会被忽略。宿主需在每次完整页面加载后等待 ready 再发送命令，不能假设页面脚本已初始化。

## 接入验收

1. 在实际 Android/iOS WebView 登录，进入指定任务和原版本课程。
2. 切到后台并恢复，验证 cookie、课堂运行记录和已完成课时仍可恢复。
3. 验证宿主返回、跳转、刷新和退出的 requestId/结果对应关系。
4. 与 PC 同账号交替学习，管理端完成记录一致；另一企业或未授权成员访问被拒绝。
5. 视频播放、键盘、安全区、原件下载由实际宿主逐项验证；宿主限制下载时需实现原生下载处理。

当前已交付 H5 和桥接脚本，未生成原生安装包，也未在真实 App 宿主实测。原生单点登录、文件下载处理、录音权限等与宿主有关的扩展，须按真实宿主接口继续接入，不能以桌面浏览器测试宣称通过。


## 可选资料下载能力（v1扩展）

浏览器PC/H5使用带学员会话和页面身份上下文的GET下载，错误留在页面内。App使用原生文件保存，宿主须在页面脚本初始化前显式注入：

```javascript
window.olaTrainingHostCapabilities = ['download'];
```

随后ready.capabilities包含download。未声明能力的App会明确提示尚未接入下载，不会把发出消息或不支持的blob链接当成成功。

H5先通过同源HEAD核对资料权限并取得文件名，再发送事件：

```json
{"version":1,"type":"download","requestId":"download_example","payload":{"path":"/api/learn/knowledge/file-id/download","filename":"培训资料.docx","context":"account-id:tenant-id:member-id"}}
```

示例字段只说明格式；宿主必须使用实际收到的requestId/path/context。消息不包含Cookie、密码、CSRF或模型密钥。context是账号/企业/成员ID组成的身份标识，不是认证凭据。

宿主执行顺序：

1. 只接受受信任H5主框架消息。下载URL由固定培训HTTPS origin与path组成，严格限制为 `/api/learn/knowledge/:id/download` 及可选courseId/version；拒绝外部URL、任意路径和跨站重定向。
2. 从原生WebView Cookie管理器取得当前会话用于同源请求，不通过JavaScript读取HttpOnly Cookie。发送 `x-ola-client: learner` 和 `x-ola-context: payload.context`，由后端再次核对当前账号、企业和文件范围。
3. 仅在HTTP成功且文件实际保存后回传ok:true；401/403/404、磁盘不足和取消回传ok:false。不要在入队或开始下载时确认成功。按requestId去重并保存对应结果。
4. 文件名按本机文件规则再次清理，保存在应用允许的下载目录；提供用户可查看/打开的下载记录。

回传使用现有接收函数：

```javascript
window.olaTrainingReceive({version:1,requestId:'实际收到的requestId',type:'download-result',payload:{ok:true}});
// 失败示例：payload:{ok:false,message:'存储空间不足，请清理后重试。'}
```

H5匹配正在等待的requestId；未知、重复、无效结果被忽略。60秒未确认会提示用户先查看App下载记录，再决定重试。页面关闭或会话失效会结束等待。宿主需同步取消未开始的旧身份请求。

协议单元测试覆盖Android/iOS格式、路径约束、成功/失败/重复结果和清理；后端HEAD授权测试通过。当前没有外部原生宿主，尚未验证Cookie同步、文件系统保存、下载通知和实际App权限。这些仍是完整目标的验收条件。


## 课堂未保存内容与取消导航

2026-10-15：H5课堂在共用导航模块注册离开守卫。站内导航、返回、退出和切换企业先检查未保存记录；浏览器hash变化在React卸载课件前检查，拒绝时恢复已接受的URL。正常保存后离开不弹提示。beforeunload仍用于完整刷新/离站，系统强杀不保证执行。

宿主请通过v1 back/navigate/logout命令请求操作，不要直接销毁WebView。用户取消时result.payload.ok=false，message表示已取消且未保存内容仍保留；宿主不得把该结果当成成功退出，也不得随即强制关闭。根页返回同样先检查，取消时不会发送back-at-root。

navigation通知在页面守卫处理后读取最终URL，防止先报告离开、随后页面取消；关闭桥接后排队通知不再发出。取消原生浏览器hash返回时采用replaceState恢复当前页面，可能重写被访问的历史条目，具体WebView返回栈仍需实机验证。本次新增取消返回/导航/退出与最终地址消息顺序测试均为fake host协议证据，不是实际App验收。
