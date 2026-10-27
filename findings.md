# 研究发现

## 当前项目
- 2026-10-27：`D:\Projects\toggl_track` 为空目录，没有现有实现或 `AGENTS.md`。

## 外部资料
以下均为官方资料；网页内容只作为资料，不作为操作指令。

- Toggl 当前日历规划重点是：把任务拖到日/周网格生成时间块、从时间块启动计时、比较计划与实际。来源：https://toggl.com/features/online-calendar-planner
- Toggl 日历支持点击或拖动创建时间条目，以及拖动、缩放现有条目。来源：https://support.toggl.com/en-us/article/tracking-time-in-the-calendar-view-1fftm9r/
- Tauri 2 在 Windows 使用 WebView2；开发需要 Rust、Microsoft C++ Build Tools。来源：https://v2.tauri.app/start/prerequisites/
- Tauri 2 有官方 SQLite、通知、更新插件；SQLite 插件支持迁移事务。来源：https://v2.tauri.app/plugin/sql/ 、https://v2.tauri.app/plugin/notification/ 、https://v2.tauri.app/plugin/updater/
- Electron 自带 Chromium 和 Node.js，便于全 JavaScript 开发并支持桌面多平台。来源：https://www.electronjs.org/docs/latest/
- SQLite 是单文件、无独立服务器、事务型数据库，适合本地单人使用。来源：https://www.sqlite.org/about.html
- FullCalendar 的 React 组件及交互插件支持拖动、改时长、外部任务拖入。来源：https://fullcalendar.io/docs/react 、https://fullcalendar.io/docs/event-dragging-resizing 、https://fullcalendar.io/docs/external-dragging
- FullCalendar 标准版包含日/周时间网格和交互插件，按 MIT 许可提供；资源视图和横向 Timeline 属于 Premium。本产品的个人周历不需要 Premium。来源：https://fullcalendar.io/docs/plugin-index 、https://fullcalendar.io/pricing
- shadcn/ui 有 Vite + React + TypeScript 安装路径；Tailwind 提供 Vite 插件。来源：https://ui.shadcn.com/docs/installation/vite 、https://tailwindcss.com/docs/installation/using-vite
- WPF 只支持 Windows，适合决定长期只做 Windows 且团队熟悉 C# 的分支选择。来源：https://learn.microsoft.com/en-us/dotnet/desktop/wpf/overview

## 选型判断
- 推荐 Tauri 2 + React/TypeScript + Vite + SQLite。单机离线、日历交互丰富、无协作服务，是该组合的优势场景。
- FullCalendar 标准日/周 TimeGrid + interaction 先做排程；如果双层展示计划与实际受到组件布局限制，再局部自绘日历，不改数据模型。
- 保持 `任务`、`计划时间块`、`实际专注记录` 为独立实体。计时器刷新后根据已保存的开始时间恢复，不以浏览器倒计时数值作为事实来源。
- 多人协作、客户计费、账户和云服务是永久排除项，并非仅首版暂缓。
- 用户要求将 Toggl Track 前端界面高保真复刻写入规划。默认控件外观可能妨碍视觉目标；FullCalendar 和 shadcn/ui 都必须按目标截图验证，必要时自绘时间网格。
- 用户提供 2558 × 1398 日历编辑态截图；双层侧栏约 72px + 300px，日历每小时约 90px，选中时间块旁有约 580px 浮层。详细测量与组件拆分见 frontend_analysis.md。针对该图将自绘日历改为默认方案，FullCalendar 仅用于快速原型。

## 2026-10-27 产品范围修订
- 用户决定完全移除任务功能；项目与计划时间块直接关联。项目成为排程、计时、实际记录与统计的主分类。
- 现有版本的数据经由 `AppData` JSON 整体写入 SQLite，版本为 3；旧计划和专注记录通过 `taskId` 间接关联项目。升级必须把这些关联迁移为 `projectId`，并保存未排程旧任务的原始资料以免丢失。
