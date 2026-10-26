import { Block, demoDay, initialState, mails, State, Task } from "./data";
export const storageKey = "plannerpal-demo-v1";
export const validDate = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  value >= "2000-01-01" &&
  value <= "2100-12-31" &&
  !Number.isNaN(Date.parse(value + "T12:00:00Z")) &&
  new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value;
export function shiftDay(date: string, offset: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
export const dateLabel = (date: string, long = false) =>
  new Date(date + "T12:00:00").toLocaleDateString("nl-NL", {
    weekday: long ? "long" : "short",
    day: "numeric",
    month: long ? "long" : "short",
  });
export const minutesLabel = (n: number) =>
  `${Math.floor(n / 60) ? `${Math.floor(n / 60)}u ` : ""}${n % 60 || !n ? `${n % 60}m` : ""}`.trim();
export type Interval = { start: number; duration: number };
export const overlaps = (a: Interval, b: Interval) =>
  a.start < b.start + b.duration && b.start < a.start + a.duration;
export function occupied(
  state: State,
  date: string,
  exclude?: { kind: "task" | "block"; id: number },
): Interval[] {
  return [
    ...state.blocks.filter(
      (b) =>
        b.date === date && !(exclude?.kind === "block" && exclude.id === b.id),
    ),
    ...state.tasks
      .filter(
        (t) =>
          t.date === date &&
          !t.done &&
          t.start !== undefined &&
          !(exclude?.kind === "task" && exclude.id === t.id),
      )
      .map((t) => ({ start: t.start!, duration: t.duration })),
  ];
}
export function canFit(
  state: State,
  date: string,
  start: number,
  duration: number,
  exclude?: { kind: "task" | "block"; id: number },
) {
  return (
    validDate(date) &&
    Number.isInteger(start) &&
    start >= 540 &&
    Number.isInteger(duration) &&
    duration >= 5 &&
    start + duration <= 1020 &&
    !occupied(state, date, exclude).some((b) =>
      overlaps({ start, duration }, b),
    )
  );
}
export function slotsFor(state: State, task: Task, date: string) {
  return Array.from({ length: 32 }, (_, i) => 540 + i * 15).filter((start) =>
    canFit(state, date, start, task.duration, { kind: "task", id: task.id }),
  );
}
// Read the previous prototype's storage without discarding accepted tasks or drafts.
export function restore(value: unknown): State | null {
  if (!value || typeof value !== "object") return null;
  const s = value as State;
  if (
    !Array.isArray(s.tasks) ||
    !Array.isArray(s.drafts) ||
    !Array.isArray(s.read)
  )
    return null;
  const tasks: Task[] = [];
  for (const t of s.tasks) {
    if (
      !t ||
      !Number.isSafeInteger(t.id) ||
      !(t.mailId === null || mails.some((m) => m.id === t.mailId)) ||
      typeof t.title !== "string" ||
      !t.title.trim() ||
      !Number.isInteger(t.duration) ||
      t.duration < 5 ||
      t.duration > 480 ||
      !["Hoog", "Normaal", "Laag"].includes(t.priority) ||
      !validDate(t.deadline) ||
      typeof t.done !== "boolean" ||
      (t.date !== undefined && !validDate(t.date)) ||
      (t.start !== undefined &&
        (!Number.isInteger(t.start) ||
          t.start < 540 ||
          t.start + t.duration > 1020))
    )
      return null;
    tasks.push({
      ...t,
      date: t.date ?? demoDay,
      ...(t.done ? { start: undefined } : {}),
    });
  }
  if (new Set(tasks.map((t) => t.id)).size !== tasks.length) return null;
  if (
    !s.drafts.every(
      (d) =>
        d &&
        mails.some((m) => m.id === d.mailId) &&
        typeof d.text === "string" &&
        typeof d.approved === "boolean",
    ) ||
    !s.read.every((id) => mails.some((m) => m.id === id))
  )
    return null;
  const blocks: Block[] =
    s.blocks === undefined ? initialState().blocks : s.blocks;
  if (
    !Array.isArray(blocks) ||
    !blocks.every(
      (b) =>
        b &&
        Number.isSafeInteger(b.id) &&
        validDate(b.date) &&
        typeof b.title === "string" &&
        b.title.trim() &&
        ["Afspraak", "Pauze"].includes(b.type) &&
        Number.isInteger(b.start) &&
        b.start >= 540 &&
        Number.isInteger(b.duration) &&
        b.duration >= 5 &&
        b.start + b.duration <= 1020,
    ) ||
    new Set(blocks.map((b) => b.id)).size !== blocks.length
  )
    return null;
  const restored = { tasks, drafts: s.drafts, read: s.read, blocks };
  // Reject overlapping imported data rather than making an impossible day look valid.
  for (const b of blocks)
    if (
      !canFit(restored, b.date, b.start, b.duration, {
        kind: "block",
        id: b.id,
      })
    )
      return null;
  for (const t of tasks)
    if (
      t.start !== undefined &&
      !canFit(restored, t.date, t.start, t.duration, { kind: "task", id: t.id })
    )
      return null;
  return restored;
}
