# 学习与科研时间规划桌面软件：技术选型建议

## 结论

按当前 Windows 开发环境、单人本地使用、以后可能支持 macOS/Linux 的假设，建议采用：

| 层 | 方案 | 用途 |
|---|---|---|
| 桌面外壳 | Tauri 2 | 窗口、系统托盘、通知、打包 |
| 界面 | React + TypeScript + Vite | 任务列表、日历、计时器、复盘视图 |
| 组件与样式 | 自定义 CSS 与 React 组件 | 精确控制参考界面的尺寸、间距、颜色与交互状态 |
| 日历 | React 自绘 CSS Grid 时间网格 + Pointer Events | 精准还原日/周视图、拖动与缩放；FullCalendar 仅可作快速原型 |
| 本地存储 | SQLite + 应用数据版本迁移 | 离线保存任务、计划、实际记录 |
| 数据访问 | 独立的 TypeScript repository/service 层，底层调用 Tauri SQL 插件 | 避免组件直接依赖 SQL；复杂系统功能再用 Rust command |
| 导出与备份 | CSV 导出、JSON 备份与恢复 | 个人数据可迁移、可恢复 |

**永久排除**多人协作、客户计费、账户、云服务及其基础设施。无需 Next.js、独立 API 服务器或 PostgreSQL。第一版也不需要自动更新机制。

## 界面高保真复刻是正式目标

前端不只实现相似的功能。首版就把 Toggl Track 的个人时间规划界面作为高保真参考，覆盖双层侧边导航、日/周日历、顶部计时区、颜色与排版、浮层、悬停/拖拽/缩放等状态；任务列表及科研复盘模块在此基础上设计。先建立参考截图与交互清单，再做视觉样式表和组件，不以通用组件或 FullCalendar 的默认外观作为成品。

实施顺序：

1. 固定参考版本、窗口尺寸和缩放比例，收集主要页面及空态、编辑态、拖动态截图；记录尺寸、间距、字体、颜色和交互。
2. 制作静态界面与组件状态，优先还原日/周历、双层侧栏和计时区，完成视觉评审后再接数据库。
3. 接入任务排程、计时和复盘数据，核对拖拽、调整时长、弹窗与键盘操作。
4. 在固定视口用截图对比检查布局、间距、色彩和状态；在 Windows 实际安装包中复查。

已收到一张 2558 × 1398 的日历编辑态截图，具体拆解见 [frontend_analysis.md](frontend_analysis.md)。以该图为高保真目标时，优先自绘时间网格，避免日历组件内部结构限制布局与叠层。基础控件也需要按参考界面重新设定样式；其他页面与交互状态仍需各自的参考图或明确设计决定。

## 核心产品模型

1. `Project`：如「机器学习课程」「论文 A」「实验 B」。
2. `Task`：待完成的学习或科研工作，可有预计时长、截止日期、状态。
3. `PlanBlock`：计划何时做、预计做多久，关联任务；可移动或缩放。
4. `FocusSession`：实际开始和结束时间，可关联任务和计划块；即使临时工作也能独立记录。

**计划和实际分别保存。** 改动计划不覆盖历史记录；专注时间超出或偏离计划也能如实展示。界面可在同一周历中显示两者，并按任务/项目汇总偏差。

## 第一版范围

1. 建立项目和任务，填写预估时间与截止日期。
2. 从待办列表拖入日/周历，形成、移动和缩放计划时间块。
3. 从任务或时间块启动/暂停/结束计时，允许补录和修改实际时段。
4. 提供每日/每周复盘：计划时长、实际时长、完成任务、偏差。
5. 本地数据库迁移、数据导出与备份。

后续根据使用反馈再加入循环计划、里程碑、离线日历文件导入、Zotero/Obsidian 本地链接和更细的研究统计。提醒可以在第一版后段加入；若要求关闭应用时仍可靠触发提醒，需要另行设计常驻后台行为。这些扩展仍不得引入账户或云服务。

## 实现原则

- 计时器持久化开始时间，界面的秒数由当前时间计算；避免刷新窗口造成计时丢失。
- 当前实现把单份版本化应用状态原子写入 SQLite 单行；读取旧版本时在应用层迁移。JSON 是用户可恢复的备份格式。
- 数据库访问集中在 repository 层；组件只调用领域服务。
- 自绘网格使用统一的时间到像素转换，分别渲染计划与实际；同一数据模型也可支持以后更换日历实现。
- 先发 Windows 安装包。Tauri 在 Windows 使用 WebView2，开发机需要 Rust 和 C++ Build Tools。

## 取舍

| 选择 | 何时更适合 |
|---|---|
| Tauri 2（推荐） | 希望本地轻量、保持跨平台可能性，能够接受少量 Rust/桌面配置。 |
| Electron | 开发者只想用 JavaScript/TypeScript，愿意接受其自带 Chromium 和 Node.js 的分发模式。 |
| C# + WPF/WinUI | 已明确长期只支持 Windows，并且主要开发者熟悉 .NET。 |

## 官方资料

- [Toggl 日历规划](https://toggl.com/features/online-calendar-planner)
- [Tauri Windows 前提条件](https://v2.tauri.app/start/prerequisites/)、[SQLite 插件](https://v2.tauri.app/plugin/sql/)
- [SQLite 特性](https://www.sqlite.org/about.html)
- [FullCalendar React](https://fullcalendar.io/docs/react)、[拖动与缩放](https://fullcalendar.io/docs/event-dragging-resizing)、[许可范围](https://fullcalendar.io/pricing)
- [Electron 官方介绍](https://www.electronjs.org/docs/latest/)、[WPF 官方介绍](https://learn.microsoft.com/en-us/dotnet/desktop/wpf/overview)
