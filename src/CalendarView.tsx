import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Play,
  Plus,
  X,
} from "lucide-react";
import {
  addDays,
  dateAtMinutes,
  dayKey,
  durationMinutes,
  focusDurationMinutes,
  formatClock,
  formatDuration,
  minutesOfDay,
  snapMinutes,
  startOfWeek,
  weekLabel,
} from "./date";
import { uid, type AppData, type PlanBlock } from "./model";

const hourHeight = 90;
const pxPerMinute = hourHeight / 60;
const dayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

type Props = {
  data: AppData;
  anchor: Date;
  onAnchorChange: (date: Date) => void;
  onPreferenceChange: (patch: Partial<AppData["preferences"]>) => void;
  onCreate: (block: PlanBlock) => void;
  onUpdate: (block: PlanBlock) => void;
  onDelete: (id: string) => void;
  onStartTimer: (block: PlanBlock) => void;
  onCreateProject: () => void;
};

type Editor = { block: PlanBlock; isNew: boolean; x: number; y: number };
type CreateGesture = { date: Date; start: number; current: number };
type EditGesture = {
  block: PlanBlock;
  mode: "move" | "resize";
  x: number;
  y: number;
  dayIndex: number;
  currentX: number;
  currentY: number;
};

function getEventTitle(block: PlanBlock): string {
  return block.title || "计划时间";
}

function parseTime24(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  return hour < 24 ? { hour, minute: Number(match[2]) } : null;
}

function clockText(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export default function CalendarView({
  data,
  anchor,
  onAnchorChange,
  onPreferenceChange,
  onCreate,
  onUpdate,
  onDelete,
  onStartTimer,
  onCreateProject,
}: Props) {
  const { preferences, planBlocks, focusSessions, projects } = data;
  const weekStart = startOfWeek(anchor, preferences.weekStartsOn);
  const days = Array.from({ length: preferences.visibleDays }, (_, index) =>
    addDays(weekStart, index),
  );
  const [editor, setEditor] = useState<Editor | null>(null);
  const [timeDraft, setTimeDraft] = useState({ start: "", end: "" });
  const [createGesture, setCreateGesture] = useState<CreateGesture | null>(
    null,
  );
  const [editGesture, setEditGesture] = useState<EditGesture | null>(null);
  const [now, setNow] = useState(Date.now());
  const daysRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<EditGesture | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = Math.max(
        0,
        (9 - preferences.startHour) * hourHeight - 40,
      );
  }, [preferences.startHour]);

  useEffect(() => {
    if (!editor) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEditor(null);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [editor]);

  const calendarStart = preferences.startHour * 60;
  const calendarEnd = preferences.endHour * 60;
  const height = (calendarEnd - calendarStart) * pxPerMinute;
  const selectedDates = new Set(days.map(dayKey));
  const visibleBlocks = planBlocks.filter((block) =>
    selectedDates.has(dayKey(block.startAt)),
  );
  const weeklyPlanned = visibleBlocks.reduce(
    (sum, block) => sum + durationMinutes(block.startAt, block.endAt),
    0,
  );
  const weeklyActual = focusSessions
    .filter((session) => selectedDates.has(dayKey(session.startAt)))
    .reduce((sum, session) => sum + focusDurationMinutes(session), 0);
  const todayKey = dayKey(new Date(now));
  const startTime = editor ? parseTime24(timeDraft.start) : null;
  const endTime = editor ? parseTime24(timeDraft.end) : null;
  const timeError = editor
    ? !startTime || !endTime
      ? "请输入 24 小时制时间，例如 13:30、15:00"
      : new Date(editor.block.endAt) <= new Date(editor.block.startAt)
        ? "结束时间须晚于开始时间；下午 3 点请输入 15:00"
        : ""
    : "";
  const projectError = editor && !projects.some((project) => project.id === editor.block.projectId)
    ? "请先选择一个项目"
    : "";

  function showEditor(next: Editor) {
    setTimeDraft({
      start: formatClock(next.block.startAt),
      end: formatClock(next.block.endAt),
    });
    setEditor(next);
  }

  function minuteFromPointer(
    event: ReactPointerEvent,
    column: HTMLElement,
  ): number {
    const rect = column.getBoundingClientRect();
    return Math.min(
      calendarEnd - preferences.snapMinutes,
      Math.max(
        calendarStart,
        snapMinutes(
          calendarStart + (event.clientY - rect.top) / pxPerMinute,
          preferences.snapMinutes,
        ),
      ),
    );
  }

  function openDraft(
    date: Date,
    start: number,
    end: number,
    x: number,
    y: number,
  ) {
    const block: PlanBlock = {
      id: uid(),
      projectId: projects.find((project) => !project.archived)?.id || "",
      title: "",
      startAt: dateAtMinutes(date, start).toISOString(),
      endAt: dateAtMinutes(date, end).toISOString(),
      notes: "",
      createdAt: new Date().toISOString(),
    };
    showEditor({ block, isNew: true, x, y });
  }

  function handleCreateDown(
    event: ReactPointerEvent<HTMLDivElement>,
    date: Date,
  ) {
    if (
      event.button !== 0 ||
      (event.target as HTMLElement).closest(".calendar-event")
    )
      return;
    const start = minuteFromPointer(event, event.currentTarget);
    event.currentTarget.setPointerCapture(event.pointerId);
    setEditor(null);
    setCreateGesture({ date, start, current: start });
  }

  function handleCreateMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!createGesture) return;
    setCreateGesture({
      ...createGesture,
      current: minuteFromPointer(event, event.currentTarget),
    });
  }

  function handleCreateUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!createGesture) return;
    const current = minuteFromPointer(event, event.currentTarget);
    const start = Math.min(createGesture.start, current);
    const end = Math.min(
      calendarEnd,
      Math.max(
        start + preferences.snapMinutes,
        Math.max(createGesture.start, current),
      ),
    );
    openDraft(createGesture.date, start, end, event.clientX, event.clientY);
    setCreateGesture(null);
  }

  function dayIndexFromX(x: number): number {
    const rect = daysRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(
      0,
      Math.min(
        days.length - 1,
        Math.floor((x - rect.left) / (rect.width / days.length)),
      ),
    );
  }

  function handleBlockDown(
    event: ReactPointerEvent<HTMLDivElement>,
    block: PlanBlock,
    mode: "move" | "resize",
    dayIndex: number,
  ) {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const gesture: EditGesture = {
      block,
      mode,
      x: event.clientX,
      y: event.clientY,
      dayIndex,
      currentX: event.clientX,
      currentY: event.clientY,
    };
    gestureRef.current = gesture;
    setEditGesture(gesture);
  }

  function handleBlockMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!gestureRef.current) return;
    const gesture = {
      ...gestureRef.current,
      currentX: event.clientX,
      currentY: event.clientY,
    };
    gestureRef.current = gesture;
    setEditGesture(gesture);
  }

  function shiftedBlock(gesture: EditGesture): PlanBlock {
    const shift = snapMinutes(
      (gesture.currentY - gesture.y) / pxPerMinute,
      preferences.snapMinutes,
    );
    const start = new Date(gesture.block.startAt);
    const end = new Date(gesture.block.endAt);
    if (gesture.mode === "move") {
      const dayShift = dayIndexFromX(gesture.currentX) - gesture.dayIndex;
      start.setDate(start.getDate() + dayShift);
      end.setDate(end.getDate() + dayShift);
      start.setMinutes(start.getMinutes() + shift);
      end.setMinutes(end.getMinutes() + shift);
    } else {
      end.setMinutes(end.getMinutes() + shift);
      if (end.getTime() <= start.getTime())
        end.setTime(start.getTime() + preferences.snapMinutes * 60_000);
    }
    return {
      ...gesture.block,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
    };
  }

  function handleBlockUp(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    if (!gesture) return;
    event.stopPropagation();
    gestureRef.current = null;
    setEditGesture(null);
    if (
      Math.abs(gesture.currentX - gesture.x) < 4 &&
      Math.abs(gesture.currentY - gesture.y) < 4
    ) {
      showEditor({
        block: gesture.block,
        isNew: false,
        x: event.clientX,
        y: event.clientY,
      });
    } else {
      onUpdate(shiftedBlock(gesture));
    }
  }

  const editorStyle = editor
    ? {
        left: Math.min(
          Math.max(16, editor.x + 12),
          Math.max(16, window.innerWidth - 590),
        ),
        top: Math.min(
          Math.max(120, editor.y - 20),
          Math.max(120, window.innerHeight - 390),
        ),
      }
    : undefined;

  return (
    <div className="planner-screen">
      <div className="calendar-toolbar">
        <div className="week-selector">
          <button
            aria-label="上一周"
            onClick={() => onAnchorChange(addDays(anchor, -7))}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            className="week-label"
            onClick={() => onAnchorChange(new Date())}
          >
            <CalendarDays size={19} />
            {weekLabel(weekStart, preferences.visibleDays)}
          </button>
          <button
            aria-label="下一周"
            onClick={() => onAnchorChange(addDays(anchor, 7))}
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="toolbar-right">
          <button
            className="outline-button"
            onClick={onCreateProject}
          >
            <Plus size={17} /> 新建项目
          </button>
          <div className="view-select">
            <select
              aria-label="显示天数"
              value={preferences.visibleDays}
              onChange={(event) =>
                onPreferenceChange({
                  visibleDays: Number(event.target.value) as 3 | 5 | 7,
                })
              }
            >
              <option value={3}>3 天</option>
              <option value={5}>5 天</option>
              <option value={7}>7 天</option>
            </select>
            <ChevronDown size={16} />
          </div>
          <div className="calendar-mode">
            <CalendarDays size={20} />
            <span>日历</span>
          </div>
        </div>
      </div>

      <div className="weekly-summary">
        <span>计划</span>
        <div className="summary-track">
          <div
            style={{
              width: `${Math.min(100, weeklyPlanned ? (weeklyActual / weeklyPlanned) * 100 : 0)}%`,
            }}
          />
        </div>
        <strong>{formatDuration(weeklyPlanned)}</strong>
        <span className="summary-actual">
          实际 {formatDuration(weeklyActual)}
        </span>
      </div>

      <div className="calendar-header">
        <div className="calendar-header-controls">
          <button
            aria-label="缩小日历"
            onClick={() =>
              onPreferenceChange({
                startHour: Math.max(0, preferences.startHour - 1),
              })
            }
          >
            −
          </button>
          <button
            aria-label="扩大日历"
            onClick={() =>
              onPreferenceChange({
                startHour: Math.min(
                  preferences.endHour - 4,
                  preferences.startHour + 1,
                ),
              })
            }
          >
            ＋
          </button>
        </div>
        <div className="calendar-date-headings">
          {days.map((date) => (
            <div key={dayKey(date)} className="day-heading">
              <span className={dayKey(date) === todayKey ? "today-badge" : ""}>
                {date.getDate()}
              </span>
              <div>
                {dayNames[date.getDay()]}
                <i />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="all-day-row">
        <div />
        {days.map((day) => (
          <div key={dayKey(day)} />
        ))}
      </div>

      <div className="calendar-scroll" ref={scrollRef}>
        <div className="calendar-content" style={{ height }}>
          <div className="time-ruler">
            {Array.from(
              { length: preferences.endHour - preferences.startHour + 1 },
              (_, index) => (
                <div
                  className="hour-label"
                  key={index}
                  style={{ top: index * hourHeight }}
                >
                  {String(((preferences.startHour + index - 1 + 24) % 12) + 1)}
                  :00 {preferences.startHour + index < 12 ? "AM" : "PM"}
                </div>
              ),
            )}
          </div>
          <div className="calendar-days" ref={daysRef}>
            {days.map((date, dayIndex) => {
              const dateKey = dayKey(date);
              const dayBlocks = visibleBlocks.filter(
                (block) => dayKey(block.startAt) === dateKey,
              );
              const daySessions = preferences.showActual
                ? focusSessions.filter(
                    (session) =>
                      dayKey(session.startAt) === dateKey && !!session.endAt,
                  )
                : [];
              return (
                <div
                  className="day-column"
                  key={dateKey}
                  data-day-key={dateKey}
                  onPointerDown={(event) => handleCreateDown(event, date)}
                  onPointerMove={handleCreateMove}
                  onPointerUp={handleCreateUp}
                >
                  {dayBlocks.map((block) => {
                    const preview =
                      editGesture?.block.id === block.id
                        ? shiftedBlock(editGesture)
                        : block;
                    const top =
                      (minutesOfDay(preview.startAt) - calendarStart) *
                      pxPerMinute;
                    const blockHeight = Math.max(
                      28,
                      durationMinutes(preview.startAt, preview.endAt) *
                        pxPerMinute,
                    );
                    const project = projects.find(
                      (item) => item.id === block.projectId,
                    );
                    return (
                      <div
                        key={block.id}
                        className={`calendar-event plan-event${editor?.block.id === block.id ? " selected" : ""}`}
                        style={
                          {
                            top,
                            height: blockHeight,
                            "--event-color": project?.color || "#a84c9d",
                          } as React.CSSProperties
                        }
                        onPointerDown={(event) =>
                          handleBlockDown(event, block, "move", dayIndex)
                        }
                        onPointerMove={handleBlockMove}
                        onPointerUp={handleBlockUp}
                      >
                        <div className="event-title">
                          {getEventTitle(block)}
                        </div>
                        <div className="event-meta">
                          <Clock3 size={13} />
                          {formatDuration(
                            durationMinutes(block.startAt, block.endAt),
                          )}
                        </div>
                        <button
                          className="event-play"
                          aria-label="开始计时"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            onStartTimer(block);
                          }}
                        >
                          <Play size={12} fill="currentColor" />
                        </button>
                        <div
                          className="resize-handle"
                          onPointerDown={(event) =>
                            handleBlockDown(event, block, "resize", dayIndex)
                          }
                        />
                      </div>
                    );
                  })}
                  {daySessions.map((session) => (
                    <div
                      key={session.id}
                      className="calendar-event actual-event"
                      style={{
                        top:
                          (minutesOfDay(session.startAt) - calendarStart) *
                          pxPerMinute,
                        height: Math.max(
                          6,
                          durationMinutes(session.startAt, session.endAt) *
                            pxPerMinute,
                        ),
                      }}
                      title={`${session.title} · 实际 ${formatDuration(focusDurationMinutes(session))}`}
                    >
                      <span>实际 · {session.title}</span>
                    </div>
                  ))}
                  {createGesture && dayKey(createGesture.date) === dateKey && (
                    <div
                      className="calendar-event draft-event"
                      style={{
                        top:
                          (Math.min(
                            createGesture.start,
                            createGesture.current,
                          ) -
                            calendarStart) *
                          pxPerMinute,
                        height: Math.max(
                          22,
                          (Math.abs(
                            createGesture.current - createGesture.start,
                          ) +
                            preferences.snapMinutes) *
                            pxPerMinute,
                        ),
                      }}
                    >
                      计划时间
                    </div>
                  )}
                  {editor?.isNew &&
                    dayKey(editor.block.startAt) === dateKey && (
                      <div
                        className="calendar-event draft-event"
                        style={{
                          top:
                            (minutesOfDay(editor.block.startAt) -
                              calendarStart) *
                            pxPerMinute,
                          height: Math.max(
                            28,
                            durationMinutes(
                              editor.block.startAt,
                              editor.block.endAt,
                            ) * pxPerMinute,
                          ),
                        }}
                      >
                        {getEventTitle(editor.block)}
                      </div>
                    )}
                  {dateKey === todayKey && (
                    <div
                      className="now-line"
                      style={{
                        top:
                          (minutesOfDay(new Date(now)) - calendarStart) *
                          pxPerMinute,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {editor && (
        <div className="popover-backdrop" onPointerDown={() => setEditor(null)}>
          <div
            className="plan-popover"
            style={editorStyle}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="popover-heading">
              <strong>{editor.isNew ? "计划时间" : "编辑计划"}</strong>
              <button aria-label="关闭" onClick={() => setEditor(null)}>
                <X size={19} />
              </button>
            </div>
            <input
              className="popover-title-input"
              autoFocus
              placeholder="添加描述"
              value={editor.block.title}
              onChange={(event) =>
                setEditor({
                  ...editor,
                  block: { ...editor.block, title: event.target.value },
                })
              }
            />
            <div className="popover-fields">
              <label>
                <span>项目</span>
                <select
                  value={editor.block.projectId}
                  onChange={(event) => {
                    setEditor({
                      ...editor,
                      block: {
                        ...editor.block,
                        projectId: event.target.value,
                      },
                    });
                  }}
                >
                  <option value="">选择项目</option>
                  {projects
                    .filter((project) => !project.archived || project.id === editor.block.projectId)
                    .map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                </select>
              </label>
              <button className="popover-project-add" onClick={onCreateProject}>
                <Plus size={15} /> 新建项目
              </button>
            </div>
            <div className="popover-time-fields">
              <label>
                日期
                <input
                  type="date"
                  value={dayKey(editor.block.startAt)}
                  onChange={(event) => {
                    const start = new Date(editor.block.startAt);
                    const end = new Date(editor.block.endAt);
                    const date = new Date(`${event.target.value}T00:00:00`);
                    start.setFullYear(
                      date.getFullYear(),
                      date.getMonth(),
                      date.getDate(),
                    );
                    end.setFullYear(
                      date.getFullYear(),
                      date.getMonth(),
                      date.getDate(),
                    );
                    setEditor({
                      ...editor,
                      block: {
                        ...editor.block,
                        startAt: start.toISOString(),
                        endAt: end.toISOString(),
                      },
                    });
                  }}
                />
              </label>
              <label>
                开始（24 小时制）
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="13:30"
                  value={timeDraft.start}
                  onFocus={(event) => event.currentTarget.select()}
                  onChange={(event) => {
                    const value = event.target.value;
                    setTimeDraft((current) => ({ ...current, start: value }));
                    const parsed = parseTime24(value);
                    if (!parsed) return;
                    const start = new Date(editor.block.startAt);
                    start.setHours(parsed.hour, parsed.minute, 0, 0);
                    const end = new Date(
                      start.getTime() +
                        Math.max(
                          preferences.snapMinutes,
                          durationMinutes(
                            editor.block.startAt,
                            editor.block.endAt,
                          ),
                        ) *
                          60_000,
                    );
                    setTimeDraft({
                      start: value,
                      end: formatClock(end),
                    });
                    setEditor({
                      ...editor,
                      block: {
                        ...editor.block,
                        startAt: start.toISOString(),
                        endAt: end.toISOString(),
                      },
                    });
                  }}
                />
              </label>
              <label>
                结束（24 小时制）
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="15:00"
                  value={timeDraft.end}
                  onFocus={(event) => event.currentTarget.select()}
                  onChange={(event) => {
                    const value = event.target.value;
                    const parsed = parseTime24(value);
                    setTimeDraft((current) => ({ ...current, end: value }));
                    if (!parsed) return;
                    const start = new Date(editor.block.startAt);
                    let hour = parsed.hour;
                    if (
                      start.getHours() >= 12 &&
                      hour < 12 &&
                      hour * 60 + parsed.minute <=
                        start.getHours() * 60 + start.getMinutes() &&
                      (hour + 12) * 60 + parsed.minute >
                        start.getHours() * 60 + start.getMinutes()
                    ) {
                      hour += 12;
                      setTimeDraft((current) => ({
                        ...current,
                        end: clockText(hour, parsed.minute),
                      }));
                    }
                    const end = new Date(editor.block.startAt);
                    end.setHours(hour, parsed.minute, 0, 0);
                    setEditor({
                      ...editor,
                      block: { ...editor.block, endAt: end.toISOString() },
                    });
                  }}
                />
              </label>
            </div>
            {(timeError || projectError) && (
              <p className="time-error">{timeError || projectError}</p>
            )}
            <div className="popover-footer">
              <span>
                <Clock3 size={15} />{" "}
                {timeError
                  ? "—"
                  : formatDuration(
                      durationMinutes(editor.block.startAt, editor.block.endAt),
                    )}
              </span>
              <div>
                {!editor.isNew && (
                  <button
                    className="text-danger"
                    onClick={() => {
                      onDelete(editor.block.id);
                      setEditor(null);
                    }}
                  >
                    删除
                  </button>
                )}
                <button
                  className="primary-button"
                  disabled={!!timeError || !!projectError}
                  onClick={() => {
                    if (editor.isNew) onCreate(editor.block);
                    else onUpdate(editor.block);
                    setEditor(null);
                  }}
                >
                  {editor.isNew ? "计划时间" : "保存更改"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
