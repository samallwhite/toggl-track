import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Download,
  FolderClosed,
  Pause,
  Play,
  Plus,
  Settings2,
  Square,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import CalendarView from "./CalendarView";
import {
  addDays,
  dayKey,
  durationMinutes,
  focusDurationMinutes,
  formatDuration,
  formatTimer,
  startOfWeek,
} from "./date";
import {
  csvExport,
  exportText,
  importText,
  loadData,
  saveData,
} from "./storage";
import {
  normalizeData,
  uid,
  type AppData,
  type FocusSession,
  type PlanBlock,
  type Project,
} from "./model";

type Screen = "calendar" | "projects" | "reports" | "settings";
type ProjectDraft = {
  id?: string;
  name: string;
  color: string;
  description: string;
};

const projectColors = [
  "#a84c9d",
  "#4c91a8",
  "#d89453",
  "#6d8b61",
  "#7a72b8",
  "#cd6b7b",
];
const navItems: { screen: Screen; label: string; icon: typeof CalendarDays }[] =
  [
    { screen: "calendar", label: "时间规划", icon: CalendarDays },
    { screen: "projects", label: "项目", icon: FolderClosed },
    { screen: "reports", label: "复盘", icon: BarChart3 },
    { screen: "settings", label: "设置", icon: Settings2 },
  ];

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-heading">
          <h2>{title}</h2>
          <button aria-label="关闭" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ProjectEditor({
  initial,
  onSave,
  onArchive,
  onClose,
}: {
  initial?: Project;
  onSave: (draft: ProjectDraft) => void;
  onArchive: (project: Project) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<ProjectDraft>({
    id: initial?.id,
    name: initial?.name || "",
    color: initial?.color || projectColors[0],
    description: initial?.description || "",
  });
  return (
    <Modal title={initial ? "编辑项目" : "新建项目"} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.name.trim()) onSave(draft);
        }}
        className="editor-form"
      >
        <label>
          项目名称
          <input
            autoFocus
            value={draft.name}
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
            placeholder="例如：论文阅读、实验复现"
            required
          />
        </label>
        <label>
          项目说明
          <textarea
            value={draft.description}
            onChange={(event) =>
              setDraft({ ...draft, description: event.target.value })
            }
            placeholder="这个项目要完成什么？"
            rows={3}
          />
        </label>
        <div className="field-label">颜色</div>
        <div className="color-options">
          {projectColors.map((color) => (
            <button
              type="button"
              key={color}
              aria-label={`选择颜色 ${color}`}
              className={draft.color === color ? "selected" : ""}
              style={{ background: color }}
              onClick={() => setDraft({ ...draft, color })}
            >
              {draft.color === color && <Check size={15} />}
            </button>
          ))}
        </div>
        <div className="modal-actions">
          {initial && (
            <button
              type="button"
              className="text-danger archive-button"
              onClick={() => onArchive(initial)}
            >
              {initial.archived ? "恢复项目" : "归档项目"}
            </button>
          )}
          <button type="button" className="ghost-button" onClick={onClose}>
            取消
          </button>
          <button className="primary-button">保存项目</button>
        </div>
      </form>
    </Modal>
  );
}

function SessionEditor({
  initial,
  projects,
  onSave,
  onClose,
}: {
  initial?: FocusSession;
  projects: Project[];
  onSave: (session: FocusSession) => void;
  onClose: () => void;
}) {
  const current = new Date();
  const defaultStart = new Date(current.getTime() - 60 * 60_000);
  const [title, setTitle] = useState(initial?.title || "");
  const [projectId, setProjectId] = useState(initial?.projectId || "");
  const [startDate, setStartDate] = useState(
    dayKey(initial?.startAt || defaultStart),
  );
  const [startTime, setStartTime] = useState(
    (initial ? new Date(initial.startAt) : defaultStart)
      .toTimeString()
      .slice(0, 5),
  );
  const [endDate, setEndDate] = useState(dayKey(initial?.endAt || current));
  const [endTime, setEndTime] = useState(
    (initial?.endAt ? new Date(initial.endAt) : current)
      .toTimeString()
      .slice(0, 5),
  );
  const [validation, setValidation] = useState("");
  return (
    <Modal title={initial ? "编辑实际记录" : "补录专注时间"} onClose={onClose}>
      <form
        className="editor-form"
        onSubmit={(event) => {
          event.preventDefault();
          const startAt = new Date(`${startDate}T${startTime}:00`);
          const endAt = new Date(`${endDate}T${endTime}:00`);
          if (!(endAt > startAt)) {
            setValidation("结束时间必须晚于开始时间");
            return;
          }
          onSave({
            id: initial?.id || uid(),
            projectId: projectId || null,
            planBlockId: initial?.planBlockId || null,
            title: title.trim() || "专注时间",
            startAt: startAt.toISOString(),
            endAt: endAt.toISOString(),
            pausedAt: null,
            pausedMs: initial?.pausedMs || 0,
            createdAt: initial?.createdAt || new Date().toISOString(),
          });
        }}
      >
        <label>
          做了什么
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例如：阅读论文并整理笔记"
          />
        </label>
        <label>
          关联项目
          <select
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
          >
            <option value="">无关联项目</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <div className="form-grid">
          <label>
            开始日期
            <input
              type="date"
              required
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
          <label>
            开始时间
            <input
              type="time"
              required
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
            />
          </label>
        </div>
        <div className="form-grid">
          <label>
            结束日期
            <input
              type="date"
              required
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
          <label>
            结束时间
            <input
              type="time"
              required
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
            />
          </label>
        </div>
        {validation && <p className="form-error">{validation}</p>}
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            取消
          </button>
          <button className="primary-button">保存记录</button>
        </div>
      </form>
    </Modal>
  );
}

function pageTitle(screen: Screen): string {
  return {
    calendar: "时间规划",
    projects: "项目",
    reports: "每周复盘",
    settings: "设置",
  }[screen];
}

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [screen, setScreen] = useState<Screen>("calendar");
  const [anchor, setAnchor] = useState(new Date());
  const [projectEditor, setProjectEditor] = useState<Project | true | null>(
    null,
  );
  const [sessionEditor, setSessionEditor] = useState<
    FocusSession | true | null
  >(null);
  const [timerProjectId, setTimerProjectId] = useState("");
  const [timerTitle, setTimerTitle] = useState("");
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    loadData()
      .then(setData)
      .catch((cause) => setError(`读取本地数据失败：${String(cause)}`));
  }, []);
  useEffect(() => {
    if (data)
      saveData(data).catch((cause) =>
        setError(`保存本地数据失败：${String(cause)}`),
      );
  }, [data]);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const activeSession = data?.focusSessions.find(
    (session) => session.endAt === null,
  );
  const timerSeconds = activeSession
    ? Math.max(
        0,
        ((activeSession.pausedAt ? Date.parse(activeSession.pausedAt) : now) -
          Date.parse(activeSession.startAt) -
          activeSession.pausedMs) /
          1000,
      )
    : 0;
  const activeProject = data?.projects.find(
    (project) => project.id === activeSession?.projectId,
  );

  function update(transform: (current: AppData) => AppData) {
    setData((current) => (current ? transform(current) : current));
  }

  function saveProject(draft: ProjectDraft) {
    const name = draft.name.trim();
    if (!name) return;
    update((current) => {
      if (draft.id)
        return {
          ...current,
          projects: current.projects.map((project) =>
            project.id === draft.id
              ? {
                  ...project,
                  name,
                  color: draft.color,
                  description: draft.description,
                }
              : project,
          ),
        };
      return {
        ...current,
        projects: [
          ...current.projects,
          {
            id: uid(),
            name,
            color: draft.color,
            description: draft.description,
            archived: false,
            createdAt: new Date().toISOString(),
          },
        ],
      };
    });
    setProjectEditor(null);
    setToast("项目已保存");
  }

  function toggleProjectArchive(project: Project) {
    update((current) => ({
      ...current,
      projects: current.projects.map((item) =>
        item.id === project.id ? { ...item, archived: !item.archived } : item,
      ),
    }));
    setProjectEditor(null);
    setToast(project.archived ? "项目已恢复" : "项目已归档，计划与记录均保留");
  }

  function startTimer(
    projectId: string | null,
    title: string,
    planBlockId: string | null = null,
  ) {
    if (activeSession) {
      setToast("请先结束当前专注计时");
      return;
    }
    const session: FocusSession = {
      id: uid(),
      projectId,
      planBlockId,
      title: title.trim() || "专注时间",
      startAt: new Date().toISOString(),
      endAt: null,
      pausedAt: null,
      pausedMs: 0,
      createdAt: new Date().toISOString(),
    };
    update((current) => ({
      ...current,
      focusSessions: [...current.focusSessions, session],
    }));
    setTimerTitle("");
    setToast("专注计时已开始");
  }

  function stopTimer() {
    if (!activeSession) return;
    const endAt = new Date().toISOString();
    update((current) => ({
      ...current,
      focusSessions: current.focusSessions.map((session) =>
        session.id === activeSession.id
          ? {
              ...session,
              endAt,
              pausedMs:
                session.pausedMs +
                (session.pausedAt
                  ? Date.parse(endAt) - Date.parse(session.pausedAt)
                  : 0),
              pausedAt: null,
            }
          : session,
      ),
    }));
    setToast("本次专注已记录");
  }

  function pauseTimer() {
    if (!activeSession || activeSession.pausedAt) return;
    const pausedAt = new Date().toISOString();
    update((current) => ({
      ...current,
      focusSessions: current.focusSessions.map((session) =>
        session.id === activeSession.id ? { ...session, pausedAt } : session,
      ),
    }));
    setToast("计时已暂停");
  }

  function resumeTimer() {
    if (!activeSession?.pausedAt) return;
    const resumedAt = Date.now();
    update((current) => ({
      ...current,
      focusSessions: current.focusSessions.map((session) =>
        session.id === activeSession.id
          ? {
              ...session,
              pausedAt: null,
              pausedMs:
                session.pausedMs + resumedAt - Date.parse(session.pausedAt!),
            }
          : session,
      ),
    }));
    setToast("继续专注计时");
  }

  function createPlan(block: PlanBlock) {
    update((current) => ({
      ...current,
      planBlocks: [...current.planBlocks, block],
    }));
    setToast("计划已创建");
  }
  function updatePlan(block: PlanBlock) {
    update((current) => ({
      ...current,
      planBlocks: current.planBlocks.map((item) =>
        item.id === block.id ? block : item,
      ),
    }));
    setToast("计划已更新");
  }
  function deletePlan(id: string) {
    update((current) => ({
      ...current,
      planBlocks: current.planBlocks.filter((item) => item.id !== id),
      focusSessions: current.focusSessions.map((session) =>
        session.planBlockId === id
          ? { ...session, planBlockId: null }
          : session,
      ),
    }));
    setToast("计划已删除");
  }

  function saveSession(session: FocusSession) {
    update((current) => ({
      ...current,
      focusSessions: current.focusSessions.some(
        (item) => item.id === session.id,
      )
        ? current.focusSessions.map((item) =>
            item.id === session.id ? session : item,
          )
        : [...current.focusSessions, session],
    }));
    setSessionEditor(null);
    setToast("实际记录已保存");
  }

  async function exportBackup() {
    if (!data) return;
    try {
      await exportText(
        `yanshi-backup-${dayKey(new Date())}.json`,
        JSON.stringify(data, null, 2),
      );
      setToast("备份已导出");
    } catch (cause) {
      setError(`导出失败：${String(cause)}`);
    }
  }
  async function exportCsv() {
    if (!data) return;
    try {
      await exportText(
        `yanshi-records-${dayKey(new Date())}.csv`,
        csvExport(data),
      );
      setToast("记录已导出");
    } catch (cause) {
      setError(`导出失败：${String(cause)}`);
    }
  }
  async function importBackup() {
    try {
      const text = await importText();
      if (!text) return;
      const imported = normalizeData(JSON.parse(text));
      if (
        !window.confirm(
          "导入将替换当前所有本地数据。建议先导出备份。确定继续吗？",
        )
      )
        return;
      setData(imported);
      setToast("备份已导入");
    } catch (cause) {
      setError(`导入失败：${String(cause)}`);
    }
  }

  const statistics = useMemo(() => {
    if (!data) return null;
    const weekStart = startOfWeek(anchor, data.preferences.weekStartsOn);
    const days = Array.from({ length: 7 }, (_, index) =>
      addDays(weekStart, index),
    );
    const dates = new Set(days.map(dayKey));
    const blocks = data.planBlocks.filter((block) =>
      dates.has(dayKey(block.startAt)),
    );
    const sessions = data.focusSessions.filter(
      (session) => dates.has(dayKey(session.startAt)) && session.endAt,
    );
    const planned = blocks.reduce(
      (sum, block) => sum + durationMinutes(block.startAt, block.endAt),
      0,
    );
    const actual = sessions.reduce(
      (sum, session) => sum + focusDurationMinutes(session),
      0,
    );
    const byDay = days.map((day) => ({
      day,
      planned: blocks
        .filter((block) => dayKey(block.startAt) === dayKey(day))
        .reduce(
          (sum, block) => sum + durationMinutes(block.startAt, block.endAt),
          0,
        ),
      actual: sessions
        .filter((session) => dayKey(session.startAt) === dayKey(day))
        .reduce((sum, session) => sum + focusDurationMinutes(session), 0),
    }));
    const byProject = data.projects
      .map((project) => ({
        project,
        actual: sessions
          .filter((session) => session.projectId === project.id)
          .reduce((sum, session) => sum + focusDurationMinutes(session), 0),
      }))
      .filter((entry) => entry.actual > 0)
      .sort((a, b) => b.actual - a.actual);
    return {
      days,
      planned,
      actual,
      byDay,
      byProject,
      sessions,
      blocks,
    };
  }, [data, anchor]);

  if (error && !data)
    return (
      <div className="fatal-error">
        <h1>无法打开本地数据</h1>
        <p>{error}</p>
        <button onClick={() => location.reload()}>重试</button>
      </div>
    );
  if (!data)
    return (
      <div className="loading-screen">
        <div className="brand-mark">研</div>
        <p>正在打开你的时间规划…</p>
      </div>
    );

  return (
    <div className="app-shell">
      <aside className="icon-rail">
        <div className="brand-mark" title="研时">
          研
        </div>
        <nav className="rail-nav" aria-label="主导航">
          {navItems.map(({ screen: target, label, icon: Icon }) => (
            <button
              className={screen === target ? "active" : ""}
              key={target}
              aria-label={label}
              title={label}
              onClick={() => setScreen(target)}
            >
              <Icon size={20} />
            </button>
          ))}
        </nav>
        <div className="rail-spacer" />
        <button
          aria-label="帮助"
          onClick={() => setToast("提示：在日历空白处拖动即可安排时间")}
        >
          <CircleHelp size={19} />
        </button>
      </aside>
      <aside className="side-nav">
        <div className="workspace-title">
          <div>
            <span className="workspace-caption">PERSONAL WORKSPACE</span>
            <strong>我的研究工作台</strong>
          </div>
          <ChevronDown size={17} />
        </div>
        <div className="nav-group-label">规划</div>
        <nav>
          {navItems.slice(0, 2).map(({ screen: target, label, icon: Icon }) => (
            <button
              className={`nav-item${screen === target ? " active" : ""}`}
              key={target}
              onClick={() => setScreen(target)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <div className="nav-group-label">分析</div>
        <nav>
          {navItems.slice(2, 3).map(({ screen: target, label, icon: Icon }) => (
            <button
              className={`nav-item${screen === target ? " active" : ""}`}
              key={target}
              onClick={() => setScreen(target)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <div className="side-nav-bottom">
          <div className="side-tip">
            <div className="tip-icon">
              <BookOpen size={18} />
            </div>
            <strong>专注于重要的事</strong>
            <p>把研究计划安排到日历，再记录实际投入。</p>
          </div>
          <button
            className={`nav-item${screen === "settings" ? " active" : ""}`}
            onClick={() => setScreen("settings")}
          >
            <Settings2 size={18} />
            设置
          </button>
        </div>
      </aside>
      <main className="main-area">
        {screen === "calendar" ? (
          <>
            <div className="timer-bar">
              <div className="timer-input-wrap">
                <input
                  aria-label="正在做什么"
                  placeholder="你正在做什么？"
                  value={activeSession ? activeSession.title : timerTitle}
                  disabled={!!activeSession}
                  onChange={(event) => setTimerTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !activeSession)
                      startTimer(timerProjectId || null, timerTitle || "专注时间");
                  }}
                />
              </div>
              <div className="timer-controls">
                <div className="timer-project-select">
                  <select
                    aria-label="关联项目"
                    value={activeSession ? activeProject?.id || "" : timerProjectId}
                    disabled={!!activeSession}
                    onChange={(event) => setTimerProjectId(event.target.value)}
                  >
                    <option value="">＋ 选择项目</option>
                    {data.projects
                      .filter((project) => !project.archived || project.id === activeProject?.id)
                      .map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                  </select>
                </div>
                <span className="timer-clock">{formatTimer(timerSeconds)}</span>
                <button
                  className={`timer-button${activeSession ? " running" : ""}`}
                  aria-label={
                    activeSession
                      ? activeSession.pausedAt
                        ? "继续计时"
                        : "暂停计时"
                      : "开始计时"
                  }
                  onClick={() =>
                    activeSession
                      ? activeSession.pausedAt
                        ? resumeTimer()
                        : pauseTimer()
                      : startTimer(timerProjectId || null, timerTitle || "专注时间")
                  }
                >
                  {activeSession ? (
                    activeSession.pausedAt ? (
                      <Play size={22} fill="currentColor" />
                    ) : (
                      <Pause size={20} fill="currentColor" />
                    )
                  ) : (
                    <Play size={22} fill="currentColor" />
                  )}
                </button>
                {activeSession && (
                  <button
                    className="timer-stop"
                    aria-label="结束计时"
                    title="结束并记录"
                    onClick={stopTimer}
                  >
                    <Square size={16} fill="currentColor" />
                  </button>
                )}
              </div>
            </div>
            <CalendarView
              data={data}
              anchor={anchor}
              onAnchorChange={setAnchor}
              onPreferenceChange={(patch) =>
                update((current) => ({
                  ...current,
                  preferences: { ...current.preferences, ...patch },
                }))
              }
              onCreate={createPlan}
              onUpdate={updatePlan}
              onDelete={deletePlan}
              onStartTimer={(block) =>
                startTimer(block.projectId, block.title || "专注时间", block.id)
              }
              onCreateProject={() => setProjectEditor(true)}
            />
          </>
        ) : (
          <div className="page-screen">
            <header className="page-header">
              <div>
                <div className="eyebrow">研时 / {pageTitle(screen)}</div>
                <h1>{pageTitle(screen)}</h1>
              </div>
              {screen === "projects" && (
                <button
                  className="primary-button"
                  onClick={() => setProjectEditor(true)}
                >
                  <Plus size={17} />
                  新建项目
                </button>
              )}
              {screen === "reports" && (
                <button
                  className="primary-button"
                  onClick={() => setSessionEditor(true)}
                >
                  <Plus size={17} />
                  补录时间
                </button>
              )}
            </header>
            {screen === "projects" && (
              <section className="project-grid">
                {data.projects
                  .filter((project) => !project.archived)
                  .map((project) => {
                    const projectBlocks = data.planBlocks.filter(
                      (block) => block.projectId === project.id,
                    );
                    return (
                      <article
                        className="project-card"
                        key={project.id}
                        style={
                          {
                            "--project-color": project.color,
                          } as React.CSSProperties
                        }
                      >
                        <div className="project-card-top">
                          <div className="project-icon">
                            <FolderClosed size={24} />
                          </div>
                          <button
                            className="icon-button"
                            title="编辑项目"
                            onClick={() => setProjectEditor(project)}
                          >
                            <Settings2 size={17} />
                          </button>
                        </div>
                        <h2>{project.name}</h2>
                        <p>
                          {project.description ||
                            "把相关计划与专注时间集中在这里。"}
                        </p>
                        <div className="project-card-footer">
                          <span>
                            {projectBlocks.length} 个计划块 · {formatDuration(projectBlocks.reduce(
                              (sum, block) => sum + durationMinutes(block.startAt, block.endAt),
                              0,
                            ))}
                          </span>
                          <button
                            onClick={() => {
                              setScreen("calendar");
                            }}
                          >
                            查看日历 →
                          </button>
                        </div>
                      </article>
                    );
                  })}
                <button
                  className="new-project-card"
                  onClick={() => setProjectEditor(true)}
                >
                  <Plus size={26} />
                  <span>新建项目</span>
                </button>
                {data.projects.some((project) => project.archived) && (
                  <div className="archived-projects">
                    <strong>已归档项目</strong>
                    {data.projects
                      .filter((project) => project.archived)
                      .map((project) => (
                        <button
                          key={project.id}
                          onClick={() => setProjectEditor(project)}
                        >
                          <span style={{ background: project.color }} />
                          {project.name} · 查看与恢复
                        </button>
                      ))}
                  </div>
                )}
              </section>
            )}
            {screen === "reports" && statistics && (
              <div className="reports-layout">
                <div className="report-period">
                  <button onClick={() => setAnchor(addDays(anchor, -7))}>
                    ‹
                  </button>
                  <span>
                    {statistics.days[0].toLocaleDateString("zh-CN", {
                      month: "long",
                      day: "numeric",
                    })}{" "}
                    —{" "}
                    {statistics.days[6].toLocaleDateString("zh-CN", {
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                  <button onClick={() => setAnchor(addDays(anchor, 7))}>
                    ›
                  </button>
                </div>
                <div className="metric-grid">
                  <div className="metric-card">
                    <span>计划投入</span>
                    <strong>{formatDuration(statistics.planned)}</strong>
                    <small>本周安排的学习与科研时间</small>
                  </div>
                  <div className="metric-card">
                    <span>实际专注</span>
                    <strong>{formatDuration(statistics.actual)}</strong>
                    <small>计时与补录的实际记录</small>
                  </div>
                  <div className="metric-card">
                    <span>计划差值</span>
                    <strong>
                      {statistics.actual >= statistics.planned ? "+" : "−"}
                      {formatDuration(
                        Math.abs(statistics.actual - statistics.planned),
                      )}
                    </strong>
                    <small>实际投入与计划时长的差</small>
                  </div>
                  <div className="metric-card">
                    <span>计划时段</span>
                    <strong>{statistics.blocks.length}</strong>
                    <small>本周安排的时间块</small>
                  </div>
                </div>
                <div className="report-card">
                  <div className="report-card-heading">
                    <h2>每日投入</h2>
                    <div className="chart-legend">
                      <span>
                        <i className="legend-plan" />
                        计划
                      </span>
                      <span>
                        <i className="legend-actual" />
                        实际
                      </span>
                    </div>
                  </div>
                  <div className="weekly-chart">
                    {statistics.byDay.map(({ day, planned, actual }) => {
                      const max = Math.max(
                        60,
                        ...statistics.byDay.flatMap((item) => [
                          item.planned,
                          item.actual,
                        ]),
                      );
                      return (
                        <div className="chart-day" key={dayKey(day)}>
                          <div className="chart-bars">
                            <div
                              className="chart-bar plan"
                              style={{ height: `${(planned / max) * 100}%` }}
                              title={`计划 ${formatDuration(planned)}`}
                            />
                            <div
                              className="chart-bar actual"
                              style={{ height: `${(actual / max) * 100}%` }}
                              title={`实际 ${formatDuration(actual)}`}
                            />
                          </div>
                          <span>
                            {day.toLocaleDateString("zh-CN", {
                              weekday: "short",
                            })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="report-card">
                  <h2>项目投入</h2>
                  {statistics.byProject.length ? (
                    statistics.byProject.map(({ project, actual }) => (
                      <div className="project-stat" key={project.id}>
                        <span>
                          <i style={{ background: project.color }} />
                          {project.name}
                        </span>
                        <div>
                          <span
                            style={{
                              width: `${Math.max(4, (actual / statistics.actual) * 100)}%`,
                              background: project.color,
                            }}
                          />
                        </div>
                        <strong>{formatDuration(actual)}</strong>
                      </div>
                    ))
                  ) : (
                    <p className="muted">本周还没有专注记录。</p>
                  )}
                </div>
                <div className="report-card">
                  <div className="report-card-heading">
                    <h2>实际记录</h2>
                    <span className="muted">
                      {statistics.sessions.length} 条
                    </span>
                  </div>
                  {statistics.sessions.length ? (
                    <div className="session-list">
                      {[...statistics.sessions]
                        .sort(
                          (a, b) =>
                            Date.parse(b.startAt) - Date.parse(a.startAt),
                        )
                        .map((session) => (
                          <div className="session-row" key={session.id}>
                            <div className="session-icon">
                              <Clock3 size={18} />
                            </div>
                            <div className="session-main">
                              <strong>{session.title}</strong>
                              <span>
                                {new Date(session.startAt).toLocaleString(
                                  "zh-CN",
                                  {
                                    month: "numeric",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}{" "}
                                ·{" "}
                                {formatDuration(focusDurationMinutes(session))}
                              </span>
                            </div>
                            <button
                              className="outline-button"
                              onClick={() => setSessionEditor(session)}
                            >
                              编辑
                            </button>
                            <button
                              className="icon-button danger"
                              title="删除记录"
                              onClick={() => {
                                if (!window.confirm("删除这条实际记录？"))
                                  return;
                                update((current) => ({
                                  ...current,
                                  focusSessions: current.focusSessions.filter(
                                    (item) => item.id !== session.id,
                                  ),
                                }));
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="muted">
                      本周还没有记录，可从日历计时或手动补录。
                    </p>
                  )}
                </div>
              </div>
            )}
            {screen === "settings" && (
              <div className="settings-layout">
                <section className="settings-card">
                  <h2>日历偏好</h2>
                  <div className="settings-row">
                    <div>
                      <strong>每周开始日</strong>
                      <p>设置周视图的第一天</p>
                    </div>
                    <select
                      value={data.preferences.weekStartsOn}
                      onChange={(event) =>
                        update((current) => ({
                          ...current,
                          preferences: {
                            ...current.preferences,
                            weekStartsOn: Number(event.target.value) as 0 | 1,
                          },
                        }))
                      }
                    >
                      <option value={1}>周一</option>
                      <option value={0}>周日</option>
                    </select>
                  </div>
                  <div className="settings-row">
                    <div>
                      <strong>时间吸附</strong>
                      <p>拖动日历时按此步长对齐</p>
                    </div>
                    <select
                      value={data.preferences.snapMinutes}
                      onChange={(event) =>
                        update((current) => ({
                          ...current,
                          preferences: {
                            ...current.preferences,
                            snapMinutes: Number(event.target.value) as
                              5 | 15 | 30,
                          },
                        }))
                      }
                    >
                      <option value={5}>5 分钟</option>
                      <option value={15}>15 分钟</option>
                      <option value={30}>30 分钟</option>
                    </select>
                  </div>
                  <div className="settings-row">
                    <div>
                      <strong>显示实际记录</strong>
                      <p>在日历中叠加已完成的专注时间</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={data.preferences.showActual}
                      onChange={(event) =>
                        update((current) => ({
                          ...current,
                          preferences: {
                            ...current.preferences,
                            showActual: event.target.checked,
                          },
                        }))
                      }
                    />
                  </div>
                </section>
                <section className="settings-card">
                  <h2>本地数据</h2>
                  <p className="settings-intro">
                    数据只保存在这台电脑。定期导出备份，方便迁移或恢复。
                  </p>
                  <div className="data-actions">
                    <button className="outline-button" onClick={exportBackup}>
                      <Download size={17} />
                      导出 JSON 备份
                    </button>
                    <button className="outline-button" onClick={exportCsv}>
                      <Download size={17} />
                      导出 CSV 记录
                    </button>
                    <button className="outline-button" onClick={importBackup}>
                      <Upload size={17} />
                      导入 JSON 备份
                    </button>
                  </div>
                  <div className="data-summary">
                    {data.projects.length} 个项目 · {data.planBlocks.length} 个计划块 ·{" "}
                    {data.focusSessions.length} 条专注记录
                  </div>
                  {data.legacyTasks.length > 0 && (
                    <p className="settings-intro">
                      旧版的 {data.legacyTasks.length} 项任务资料已保留在 JSON 备份中。
                    </p>
                  )}
                </section>
              </div>
            )}
          </div>
        )}
      </main>
      {projectEditor && (
        <ProjectEditor
          initial={projectEditor === true ? undefined : projectEditor}
          onSave={saveProject}
          onArchive={toggleProjectArchive}
          onClose={() => setProjectEditor(null)}
        />
      )}
      {sessionEditor && (
        <SessionEditor
          initial={sessionEditor === true ? undefined : sessionEditor}
          projects={data.projects}
          onSave={saveSession}
          onClose={() => setSessionEditor(null)}
        />
      )}
      {toast && (
        <div className="toast">
          <Check size={16} />
          {toast}
        </div>
      )}
      {error && (
        <div className="error-toast">
          {error}
          <button onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
