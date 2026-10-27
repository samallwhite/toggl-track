export type Id = string;

export type Project = {
  id: Id;
  name: string;
  color: string;
  description: string;
  archived: boolean;
  createdAt: string;
};

// Kept only to preserve data created before tasks were removed in version 4.
export type LegacyTask = {
  id: Id;
  projectId: Id | null;
  title: string;
  notes: string;
  estimateMinutes: number;
  dueDate: string | null;
  status: "todo" | "done";
  completedAt: string | null;
  createdAt: string;
};

export type PlanBlock = {
  id: Id;
  projectId: Id;
  title: string;
  startAt: string;
  endAt: string;
  notes: string;
  createdAt: string;
};

export type FocusSession = {
  id: Id;
  projectId: Id | null;
  planBlockId: Id | null;
  title: string;
  startAt: string;
  endAt: string | null;
  pausedAt: string | null;
  pausedMs: number;
  createdAt: string;
};

export type Preferences = {
  weekStartsOn: 0 | 1;
  visibleDays: 3 | 5 | 7;
  startHour: number;
  endHour: number;
  snapMinutes: 5 | 15 | 30;
  showActual: boolean;
};

export type AppData = {
  schemaVersion: 4;
  projects: Project[];
  legacyTasks: LegacyTask[];
  planBlocks: PlanBlock[];
  focusSessions: FocusSession[];
  preferences: Preferences;
};

export const uid = () => crypto.randomUUID();

export const defaultPreferences: Preferences = {
  weekStartsOn: 1,
  visibleDays: 5,
  startHour: 7,
  endHour: 22,
  snapMinutes: 15,
  showActual: true,
};

export function emptyData(): AppData {
  return {
    schemaVersion: 4,
    projects: [],
    legacyTasks: [],
    planBlocks: [],
    focusSessions: [],
    preferences: { ...defaultPreferences },
  };
}

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string";
const nullableText = (value: unknown): value is string | null =>
  value === null || text(value);
const timestamp = (value: unknown): value is string =>
  text(value) && Number.isFinite(Date.parse(value));

const isProject = (item: unknown): item is Project =>
  record(item) &&
  text(item.id) &&
  text(item.name) &&
  text(item.color) &&
  text(item.description) &&
  typeof item.archived === "boolean" &&
  timestamp(item.createdAt);

const isLegacyTask = (item: unknown): item is LegacyTask =>
  record(item) &&
  text(item.id) &&
  nullableText(item.projectId) &&
  text(item.title) &&
  text(item.notes) &&
  typeof item.estimateMinutes === "number" &&
  Number.isFinite(item.estimateMinutes) &&
  item.estimateMinutes >= 0 &&
  (item.dueDate === null ||
    (text(item.dueDate) && /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate))) &&
  (item.status === "todo" || item.status === "done") &&
  timestamp(item.createdAt);

const isBlock = (item: unknown, legacy: boolean): boolean =>
  record(item) &&
  text(item.id) &&
  (legacy ? nullableText(item.taskId) : text(item.projectId)) &&
  text(item.title) &&
  timestamp(item.startAt) &&
  timestamp(item.endAt) &&
  Date.parse(item.endAt) > Date.parse(item.startAt) &&
  text(item.notes) &&
  timestamp(item.createdAt);

const isSession = (item: unknown, legacy: boolean): boolean =>
  record(item) &&
  (legacy ? nullableText(item.taskId) : nullableText(item.projectId)) &&
  nullableText(item.planBlockId) &&
  text(item.title) &&
  timestamp(item.startAt) &&
  (item.endAt === null ||
    (timestamp(item.endAt) && Date.parse(item.endAt) > Date.parse(item.startAt))) &&
  timestamp(item.createdAt);

function preferencesFrom(value: unknown): Preferences {
  const source = record(value) ? value : {};
  const preferences: Preferences = {
    weekStartsOn: source.weekStartsOn === 0 ? 0 : 1,
    visibleDays:
      source.visibleDays === 3 || source.visibleDays === 7
        ? source.visibleDays
        : 5,
    startHour:
      typeof source.startHour === "number" &&
      source.startHour >= 0 &&
      source.startHour <= 19
        ? source.startHour
        : defaultPreferences.startHour,
    endHour:
      typeof source.endHour === "number" &&
      source.endHour >= 4 &&
      source.endHour <= 24
        ? source.endHour
        : defaultPreferences.endHour,
    snapMinutes:
      source.snapMinutes === 5 || source.snapMinutes === 30
        ? source.snapMinutes
        : 15,
    showActual:
      typeof source.showActual === "boolean" ? source.showActual : true,
  };
  if (preferences.endHour - preferences.startHour < 4)
    preferences.endHour = Math.min(24, preferences.startHour + 4);
  return preferences;
}

export function normalizeData(value: unknown): AppData {
  if (!record(value)) throw new Error("无效的数据文件");
  const version = value.schemaVersion;
  const legacy = version === 1 || version === 2 || version === 3;
  if (
    (!legacy && version !== 4) ||
    !Array.isArray(value.projects) ||
    !Array.isArray(value.planBlocks) ||
    !Array.isArray(value.focusSessions) ||
    !Array.isArray(legacy ? value.tasks : value.legacyTasks)
  )
    throw new Error("数据格式或版本不受支持");
  const projects = value.projects as unknown[];
  const blocks = value.planBlocks as unknown[];
  const sessions = value.focusSessions as unknown[];
  const oldTasks = (legacy ? value.tasks : value.legacyTasks) as unknown[];
  if (
    !projects.every(isProject) ||
    !oldTasks.every(isLegacyTask) ||
    !blocks.every((item) => isBlock(item, legacy)) ||
    !sessions.every((item) => isSession(item, legacy))
  )
    throw new Error("备份中存在不完整或无效的记录");

  const typedProjects = projects as Project[];
  const projectIds = new Set(typedProjects.map((project) => project.id));
  const legacyTasks: LegacyTask[] = (oldTasks as LegacyTask[]).map((task) => ({
    ...task,
    completedAt: timestamp(task.completedAt) ? task.completedAt : null,
  }));
  const taskById = new Map(legacyTasks.map((task) => [task.id, task]));
  const fallbackId = "legacy-unassigned-project";
  const migratedBlocks: PlanBlock[] = (blocks as Record<string, unknown>[]).map(
    (block) => {
      const task = taskById.get(String(block.taskId || ""));
      const projectId = legacy
        ? task?.projectId || fallbackId
        : String(block.projectId);
      return {
        id: String(block.id),
        projectId,
        title: String(block.title || task?.title || ""),
        startAt: String(block.startAt),
        endAt: String(block.endAt),
        notes: String(block.notes),
        createdAt: String(block.createdAt),
      };
    },
  );
  if (legacy && migratedBlocks.some((block) => block.projectId === fallbackId)) {
    if (!projectIds.has(fallbackId)) {
      typedProjects.push({
        id: fallbackId,
        name: "未分类",
        color: "#a84c9d",
        description: "旧版未指定项目的计划时间",
        archived: false,
        createdAt: new Date().toISOString(),
      });
      projectIds.add(fallbackId);
    }
  }
  if (migratedBlocks.some((block) => !projectIds.has(block.projectId)))
    throw new Error("备份中的计划关联了不存在的项目");
  const blockById = new Map(migratedBlocks.map((block) => [block.id, block]));
  const migratedSessions: FocusSession[] = (
    sessions as Record<string, unknown>[]
  ).map((session) => {
    const task = taskById.get(String(session.taskId || ""));
    const linkedBlock = blockById.get(String(session.planBlockId || ""));
    const projectId = legacy
      ? task?.projectId || linkedBlock?.projectId || null
      : (session.projectId as string | null);
    return {
      id: String(session.id),
      projectId: projectId && projectIds.has(projectId) ? projectId : null,
      planBlockId: session.planBlockId as string | null,
      title: String(session.title || task?.title || ""),
      startAt: String(session.startAt),
      endAt: session.endAt as string | null,
      pausedAt: timestamp(session.pausedAt) ? session.pausedAt : null,
      pausedMs:
        typeof session.pausedMs === "number" &&
        Number.isFinite(session.pausedMs) &&
        session.pausedMs >= 0
          ? session.pausedMs
          : 0,
      createdAt: String(session.createdAt),
    };
  });
  return {
    schemaVersion: 4,
    projects: typedProjects,
    legacyTasks,
    planBlocks: migratedBlocks,
    focusSessions: migratedSessions,
    preferences: preferencesFrom(value.preferences),
  };
}
