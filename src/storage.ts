import { isTauri } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";
import { emptyData, normalizeData, type AppData } from "./model";
import { focusDurationMinutes } from "./date";

const browserKey = "yanshi.app-data.v1";
let databasePromise: Promise<Database> | null = null;
let writeChain: Promise<void> = Promise.resolve();

async function database(): Promise<Database> {
  if (!databasePromise) {
    databasePromise = Database.load("sqlite:yanshi.db").then(async (db) => {
      await db.execute(
        "CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL, updated_at TEXT NOT NULL)",
      );
      return db;
    });
  }
  return databasePromise;
}

export async function loadData(): Promise<AppData> {
  if (isTauri()) {
    const db = await database();
    const rows = await db.select<Array<{ payload: string }>>(
      "SELECT payload FROM app_state WHERE id = 1",
    );
    return rows.length
      ? normalizeData(JSON.parse(rows[0].payload))
      : emptyData();
  }
  const raw = localStorage.getItem(browserKey);
  return raw ? normalizeData(JSON.parse(raw)) : emptyData();
}

export async function saveData(data: AppData): Promise<void> {
  const payload = JSON.stringify(data);
  writeChain = writeChain
    .catch(() => {})
    .then(async () => {
      if (isTauri()) {
        const db = await database();
        await db.execute(
          "INSERT INTO app_state (id, payload, updated_at) VALUES (1, $1, $2) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at",
          [payload, new Date().toISOString()],
        );
      } else {
        localStorage.setItem(browserKey, payload);
      }
    });
  return writeChain;
}

export async function exportText(
  filename: string,
  content: string,
): Promise<void> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({
      defaultPath: filename,
      filters: [
        { name: "数据文件", extensions: [filename.split(".").pop() || "json"] },
      ],
    });
    if (path) await writeTextFile(path, content);
    return;
  }
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importText(): Promise<string | null> {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await open({
      multiple: false,
      filters: [{ name: "JSON 备份", extensions: ["json"] }],
    });
    return typeof path === "string" ? readTextFile(path) : null;
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () =>
      resolve(input.files?.[0] ? input.files[0].text() : null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export function csvExport(data: AppData): string {
  const header = [
    "类型",
    "标题",
    "项目",
    "开始时间",
    "结束时间",
    "时长(分钟)",
    "项目ID",
  ];
  const rows = [header];
  const projectName = (projectId: string | null) =>
    data.projects.find((item) => item.id === projectId)?.name || "";
  for (const block of data.planBlocks)
    rows.push([
      "计划",
      block.title,
      projectName(block.projectId),
      block.startAt,
      block.endAt,
      String(
        Math.round(
          (Date.parse(block.endAt) - Date.parse(block.startAt)) / 60000,
        ),
      ),
      block.projectId,
    ]);
  for (const session of data.focusSessions)
    rows.push([
      "实际",
      session.title,
      projectName(session.projectId),
      session.startAt,
      session.endAt || "",
      String(session.endAt ? focusDurationMinutes(session) : 0),
      session.projectId || "",
    ]);
  return (
    "\ufeff" +
    rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
      )
      .join("\r\n")
  );
}
