/* Dayweave style reminder: Quiet Cartography — editorial wayfinding, tactile paper, warm ink, offset composition, and humane pacing. */
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Compass, Feather, Inbox, Leaf, MoreHorizontal, Pencil, Play, Plus, Save, Sparkles, Trash2, Wind, X } from "lucide-react";
import { createTask as insertTask, deleteTask as removeTask, fetchTasks, updateTask as persistTask, type Energy, type Section, type Task, type TaskDraft } from "@/lib/tasks";
import { createNote as insertNote, deleteNote as removeNote, fetchNotes, updateNote as persistNote, type Note, type NoteDraft } from "@/lib/notes";
import { fetchDailyIntention, saveDailyIntention } from "@/lib/intentions";
import { fetchDailyReflection, saveDailyReflection } from "@/lib/reflections";
import { createFocusSession, getFocusSessions, type FocusSessionHistory, type FocusSessionHistoryDraft } from "@/lib/focusSessions";
import { getDefaultTaskMinutes } from "@/lib/preferences";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import DayweaveShell from "@/components/DayweaveShell";
import { PreferencesDialog } from "@/components/PreferencesDialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type WeekDay = { date: string; label: string; short: string; number: string; current?: boolean };
type TaskErrors = Partial<Record<keyof TaskDraft, string>>;
type TaskStatusFilter = "all" | "active" | "completed";
type TaskEnergyFilter = "all" | Energy;
type TaskSectionFilter = "all" | Section;
type FocusSession = { sessionId: string; taskId: string; durationSeconds: number; startAt: number; endAt: number; pausedAt: number | null; pausedRemainingSeconds: number | null; pausedSeconds: number; isRunning: boolean; completed: boolean; updatedAt: number };
const LEGACY_FOCUS_KEY = "dayweave-focus-session";
const focusStorageKey = (userId: string) => `dayweave-focus-session:${userId}`;
const pendingFocusHistoryKey = (userId: string) => `dayweave-pending-focus-history:${userId}`;
const savePendingFocusHistory = (userId: string, draft: FocusSessionHistoryDraft) => {
  try {
    const key = pendingFocusHistoryKey(userId);
    const existing = localStorage.getItem(key);
    if (existing) {
      const existingDraft = JSON.parse(existing) as Partial<FocusSessionHistoryDraft>;
      if (typeof existingDraft.completedAt === "string" && existingDraft.completedAt > draft.completedAt) return;
    }
    localStorage.setItem(key, JSON.stringify(draft));
  } catch { /* Ignore storage failures; the completion warning remains visible. */ }
};
const loadPendingFocusHistory = (userId: string): FocusSessionHistoryDraft | null => {
  try {
    const stored = localStorage.getItem(pendingFocusHistoryKey(userId));
    if (!stored) return null;
    const draft = JSON.parse(stored) as Partial<FocusSessionHistoryDraft>;
    if (typeof draft.sessionId !== "string" || typeof draft.taskTitle !== "string" || typeof draft.plannedDurationSeconds !== "number" || typeof draft.startedAt !== "string" || typeof draft.completedAt !== "string" || typeof draft.pausedSeconds !== "number" || (draft.taskId !== null && typeof draft.taskId !== "string") || (draft.taskDate !== null && typeof draft.taskDate !== "string")) {
      localStorage.removeItem(pendingFocusHistoryKey(userId));
      return null;
    }
    return draft as FocusSessionHistoryDraft;
  } catch {
    try { localStorage.removeItem(pendingFocusHistoryKey(userId)); } catch { /* Ignore storage failures. */ }
    return null;
  }
};
const removePendingFocusHistory = (userId: string, sessionId: string) => {
  try {
    const key = pendingFocusHistoryKey(userId);
    const stored = localStorage.getItem(key);
    if (!stored) return;
    const draft = JSON.parse(stored) as Partial<FocusSessionHistoryDraft>;
    if (draft.sessionId === sessionId) localStorage.removeItem(key);
  } catch { /* Ignore storage failures. */ }
};
const DEFAULT_DAILY_INTENTION = "Make room for one thing that matters.";

const padDatePart = (value: number) => String(value).padStart(2, "0");
const localDateString = (value = new Date()) => `${value.getFullYear()}-${padDatePart(value.getMonth() + 1)}-${padDatePart(value.getDate())}`;
const parseDateOnly = (value: string) => { const [year, month, day] = value.split("-").map(Number); return new Date(year, month - 1, day); };
const addDateDays = (date: string, amount: number) => { const parsed = parseDateOnly(date); parsed.setDate(parsed.getDate() + amount); return localDateString(parsed); };
const mondayFor = (date: string) => { const parsed = parseDateOnly(date); const distanceFromMonday = (parsed.getDay() + 6) % 7; parsed.setDate(parsed.getDate() - distanceFromMonday); return localDateString(parsed); };
const getWeekDays = (weekAnchorDate: string, actualCurrentDate = weekAnchorDate): WeekDay[] => { const start = mondayFor(weekAnchorDate); return Array.from({ length: 7 }, (_, index) => { const date = addDateDays(start, index); const parsed = parseDateOnly(date); return { date, label: new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(parsed), short: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(parsed).toUpperCase(), number: String(parsed.getDate()), current: date === actualCurrentDate }; }); };
const formatLongDate = (date: string) => new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(parseDateOnly(date));
const formatSidebarDate = (date: string) => new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(parseDateOnly(date)).toUpperCase();
const formatWeekRange = (weekDays: WeekDay[]) => { const first = parseDateOnly(weekDays[0].date); const last = parseDateOnly(weekDays[weekDays.length - 1].date); const firstMonth = new Intl.DateTimeFormat("en-US", { month: "long" }).format(first); const lastMonth = new Intl.DateTimeFormat("en-US", { month: "long" }).format(last); const firstYear = first.getFullYear(); const lastYear = last.getFullYear(); if (firstYear === lastYear && firstMonth === lastMonth) return `${firstMonth} ${first.getDate()} — ${last.getDate()}, ${firstYear}`; if (firstYear === lastYear) return `${firstMonth} ${first.getDate()} — ${lastMonth} ${last.getDate()}, ${firstYear}`; return `${firstMonth} ${first.getDate()}, ${firstYear} — ${lastMonth} ${last.getDate()}, ${lastYear}`; };
const energyStyles: Record<Energy, string> = { Deep: "energy-deep", Light: "energy-light", Social: "energy-social" };
const sections: Section[] = ["Morning", "Midday", "Afternoon"];
const viewForPath = (path: string): "today" | "week" | "notes" => path === "/this-week" ? "week" : path === "/loose-notes" ? "notes" : "today";
const makeDefaultTaskDraft = (date: string): TaskDraft => ({ title: "", note: "A small, clear next step.", time: "16:00", minutes: getDefaultTaskMinutes(), energy: "Light", section: "Afternoon", date });
type TaskErrorOperation = "load" | "save" | "update" | "move" | "delete";
const taskErrorMessage = (operation: TaskErrorOperation, error: unknown) => {
  console.error(`Task ${operation} failed`, error);
  switch (operation) {
    case "load": return "Your tasks could not be loaded. Please try again.";
    case "save": return "Task could not be saved. Please try again.";
    case "update": return "Task could not be updated. Please try again.";
    case "move": return "Task could not be moved. Please try again.";
    case "delete": return "Task could not be deleted. Please try again.";
  }
};
type NoteErrorOperation = "load" | "save" | "delete";
const noteErrorMessage = (operation: NoteErrorOperation, error: unknown) => {
  console.error(`Note ${operation} failed`, error);
  switch (operation) {
    case "load": return "Your notes could not be loaded. Please try again.";
    case "save": return "Note could not be saved. Please try again.";
    case "delete": return "Note could not be deleted. Please try again.";
  }
};
const getTaskDateLockReason = (task: Task | undefined, focusSession: FocusSession | null, today: string) => {
  if (!task) return null;
  if (task.done) return "The date is locked for completed tasks.";
  if (focusSession?.taskId === task.id && !focusSession.completed) return "The date is locked while this task’s Focus Session is active or paused.";
  if (task.date < today) return "The existing past date is locked.";
  return null;
};
const getTaskDateError = (mode: "create" | "edit" | "move", targetDate: string, today: string, existingDate?: string, lockReason?: string | null) => {
  if (mode !== "create" && targetDate === existingDate) return null;
  if (mode === "edit" && lockReason) return lockReason;
  if (targetDate < today) return "Tasks can’t be scheduled for a past date.";
  return null;
};
const formatMinutes = (minutes: number) => minutes >= 60 ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}` : `${minutes}m`;
const formatNoteDate = (value: string) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
const localDateTimeTimestamp = (date: string, time: string) => { const [year, month, day] = date.split("-").map(Number); const [hours, minutes] = time.split(":").map(Number); return new Date(year, month - 1, day, hours, minutes, 0, 0).getTime(); };
const getFocusRemainingSeconds = (session: FocusSession, now = Date.now()) => { if (session.completed) return 0; if (session.pausedAt !== null) return Math.max(0, Math.ceil(session.pausedRemainingSeconds ?? 0)); if (now < session.startAt) return session.durationSeconds; return Math.max(0, Math.ceil((session.endAt - now) / 1000)); };
const pauseFocusSession = (session: FocusSession, now = Date.now()): FocusSession => { const remainingSeconds = getFocusRemainingSeconds(session, now); return { ...session, pausedAt: now, pausedRemainingSeconds: remainingSeconds, isRunning: false, updatedAt: now }; };
const resumeFocusSession = (session: FocusSession, now = Date.now()): FocusSession => { const remainingSeconds = Math.max(0, Math.ceil(session.pausedRemainingSeconds ?? getFocusRemainingSeconds(session, now))); return { ...session, startAt: now, endAt: now + remainingSeconds * 1000, pausedAt: null, pausedRemainingSeconds: null, pausedSeconds: session.pausedSeconds + (session.pausedAt === null ? 0 : Math.max(0, Math.floor((now - session.pausedAt) / 1000))), isRunning: remainingSeconds > 0, completed: remainingSeconds === 0, updatedAt: now }; };
const currentSessionLabel = (session: FocusSession | null, beforeStart: boolean) => beforeStart ? "Not started" : session?.pausedAt === null ? "Pause timer" : "Resume timer";

function loadFocusSession(userId: string, tasks?: Task[]): FocusSession | null {
  try {
    const saved = JSON.parse(localStorage.getItem(focusStorageKey(userId)) || "null") as (Partial<FocusSession> & { remainingSeconds?: number }) | null;
    if (!saved || typeof saved.taskId !== "string" && !Number.isFinite(saved.taskId) || tasks && !tasks.some((task) => task.id === String(saved.taskId))) return null;
    const durationSeconds = Math.max(60, Number(saved.durationSeconds) || 60);
    const now = Date.now();
    const legacyRemainingSeconds = Number.isFinite(saved.remainingSeconds) ? Math.min(durationSeconds, Math.max(0, Number(saved.remainingSeconds))) : null;
    const hasTimestamps = Number.isFinite(saved.startAt) && Number.isFinite(saved.endAt);
    const startAt = hasTimestamps ? Number(saved.startAt) : now - ((durationSeconds - (legacyRemainingSeconds ?? durationSeconds)) * 1000);
    const endAt = hasTimestamps ? Number(saved.endAt) : now + ((legacyRemainingSeconds ?? durationSeconds) * 1000);
    const completed = Boolean(saved.completed) || (saved.pausedAt === null && now >= endAt && now >= startAt);
    const pausedAt = Number.isFinite(saved.pausedAt) ? Number(saved.pausedAt) : (!hasTimestamps && saved.isRunning === false && !completed ? now : null);
    const pausedRemainingSeconds = Number.isFinite(saved.pausedRemainingSeconds) ? Math.max(0, Number(saved.pausedRemainingSeconds)) : (pausedAt !== null ? legacyRemainingSeconds : null);
    const sessionId = typeof saved.sessionId === "string" && saved.sessionId ? saved.sessionId : crypto.randomUUID();
    return { sessionId, taskId: String(saved.taskId), durationSeconds, startAt, endAt, pausedAt, pausedRemainingSeconds, pausedSeconds: Number.isFinite(saved.pausedSeconds) ? Math.max(0, Number(saved.pausedSeconds)) : 0, isRunning: !completed && pausedAt === null, completed, updatedAt: now };
  } catch { return null; }
}

function validateTaskDraft(draft: TaskDraft): TaskErrors {
  const errors: TaskErrors = {};
  if (!draft.title.trim()) errors.title = "Give this task a short title.";
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(draft.time);
  if (!timeMatch || Number(timeMatch[1]) > 23 || Number(timeMatch[2]) > 59) errors.time = "Use a time between 00:00 and 23:59.";
  if (!Number.isInteger(draft.minutes) || draft.minutes < 1 || draft.minutes > 1440) errors.minutes = "Choose a duration from 1 to 1,440 minutes.";
  return errors;
}

function TaskForm({ mode, initial, today, dateLockedMessage, isSubmitting, onSave, onCancel, onRequestDelete, deleteConfirm, onConfirmDelete, onCancelDelete }: { mode: "create" | "edit"; initial: TaskDraft; today: string; dateLockedMessage: string | null; isSubmitting: boolean; onSave: (draft: TaskDraft) => void; onCancel: () => void; onRequestDelete?: () => void; deleteConfirm?: boolean; onConfirmDelete?: () => void; onCancelDelete?: () => void }) {
  const [draft, setDraft] = useState<TaskDraft>(initial);
  const [errors, setErrors] = useState<TaskErrors>({});
  const update = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) => { setDraft((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: undefined })); };
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (isSubmitting) return; const nextErrors = validateTaskDraft(draft); const dateError = getTaskDateError(mode, draft.date, today, initial.date, dateLockedMessage); if (dateError) nextErrors.date = dateError; if (Object.keys(nextErrors).length) { setErrors(nextErrors); return; } onSave({ ...draft, title: draft.title.trim(), note: draft.note.trim() || "A small, clear next step." }); };
  return <form className="task-form" onSubmit={submit} noValidate>
    <div className="task-form-heading"><div><span className="eyebrow accent"><Pencil size={12} /> {mode === "edit" ? "EDIT TASK" : "SHAPE TASK"}</span><h2 id="task-form-title">{mode === "edit" ? "Tune the details" : "Give it a place"}</h2><p>{mode === "edit" ? "Small adjustments keep the route honest." : "Add just enough detail to make this easy to return to."}</p></div><button type="button" className="close-modal" onClick={onCancel} aria-label="Close task form"><X size={18} /></button></div>
    <div className="form-fields">
      <label className="form-field full"><span>Title <b>*</b></span><input autoFocus value={draft.title} onChange={(event) => update("title", event.target.value)} placeholder="e.g. Send the project brief" aria-invalid={Boolean(errors.title)} />{errors.title && <small className="field-error">{errors.title}</small>}</label>
      <label className="form-field full"><span>Note</span><textarea value={draft.note} onChange={(event) => update("note", event.target.value)} placeholder="What does done look like?" rows={3} /></label>
      <label className="form-field"><span>Time <b>*</b></span><input type="time" value={draft.time} onChange={(event) => update("time", event.target.value)} aria-invalid={Boolean(errors.time)} />{errors.time && <small className="field-error">{errors.time}</small>}</label>
      <label className="form-field"><span>Duration <b>*</b></span><div className="duration-input"><input type="number" min="1" max="1440" step="5" value={draft.minutes || ""} onChange={(event) => update("minutes", Number(event.target.value))} aria-invalid={Boolean(errors.minutes)} /><span>min</span></div>{errors.minutes && <small className="field-error">{errors.minutes}</small>}</label>
      <fieldset className="form-field full"><legend>Energy level</legend><div className="choice-row">{(["Deep", "Light", "Social"] as Energy[]).map((energy) => <button type="button" key={energy} className={`choice-button ${draft.energy === energy ? `chosen ${energyStyles[energy]}` : ""}`} onClick={() => update("energy", energy)}>{energy}</button>)}</div></fieldset>
      <fieldset className="form-field full"><legend>Day section</legend><div className="choice-row section-choices">{sections.map((section) => <button type="button" key={section} className={`choice-button ${draft.section === section ? "chosen section-chosen" : ""}`} onClick={() => update("section", section)}>{section}</button>)}</div></fieldset>
      <label className="form-field full"><span>Date</span><input type="date" value={draft.date} min={today} disabled={Boolean(dateLockedMessage)} aria-invalid={Boolean(errors.date)} aria-describedby={dateLockedMessage || errors.date ? "task-date-help" : undefined} onChange={(event) => update("date", event.target.value)} />{(dateLockedMessage || errors.date) && <small id="task-date-help" className={errors.date ? "field-error" : "mt-1 block text-[10px] text-[#758683]"}>{errors.date ?? dateLockedMessage}</small>}</label>
    </div>
    {deleteConfirm && <div className="delete-confirm"><div className="delete-icon"><Trash2 size={17} /></div><div><strong>Delete this task?</strong><p>This can’t be undone.</p></div><div className="delete-actions"><button type="button" className="cancel-delete" onClick={onCancelDelete}>Keep it</button><button type="button" className="confirm-delete" onClick={onConfirmDelete}>Delete</button></div></div>}
    <div className="task-form-footer">{mode === "edit" ? <button type="button" className="delete-trigger" onClick={onRequestDelete}><Trash2 size={15} /> Delete task</button> : <span className="required-note"><b>*</b> Required</span>}<div className="form-actions"><button type="button" className="secondary-action" onClick={onCancel}>Cancel</button><button className="primary-action" type="submit" disabled={isSubmitting}><Save size={15} /> {mode === "edit" ? "Save changes" : "Add to route"}</button></div></div>
  </form>;
}

function WeeklyView({ tasks, selectedDay, setSelectedDay, openCreate, openEdit, setActiveId, toggleTask, onMoveTask, showToast, weekDays, weekLabel, weekOffset, onPreviousWeek, onNextWeek, onToday }: { tasks: Task[]; selectedDay: string; setSelectedDay: (date: string) => void; openCreate: (title?: string, date?: string) => void; openEdit: (task: Task) => void; setActiveId: (id: string | null) => void; toggleTask: (id: string) => void; onMoveTask: (taskId: string, date: string) => void; showToast: (message: string) => void; weekDays: WeekDay[]; weekLabel: string; weekOffset: number; onPreviousWeek: () => void; onNextWeek: () => void; onToday: () => void }) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);
  const dragClickBlockUntil = useRef(0);
  const edgeAutoScroll = useRef<{ active: boolean; frame: number | null; lastFrameAt: number | null; velocity: number; cleanup: (() => void) | null }>({ active: false, frame: null, lastFrameAt: null, velocity: 0, cleanup: null });
  const stopEdgeAutoScroll = () => {
    const scroll = edgeAutoScroll.current;
    scroll.active = false;
    scroll.velocity = 0;
    scroll.lastFrameAt = null;
    if (scroll.frame !== null) window.cancelAnimationFrame(scroll.frame);
    scroll.frame = null;
    scroll.cleanup?.();
    scroll.cleanup = null;
  };
  const updateEdgeAutoScroll = (clientY: number) => {
    const scroll = edgeAutoScroll.current;
    if (!scroll.active || !window.matchMedia("(max-width: 740px)").matches) {
      scroll.velocity = 0;
      if (scroll.frame !== null) window.cancelAnimationFrame(scroll.frame);
      scroll.frame = null;
      scroll.lastFrameAt = null;
      return;
    }

    const edgeZone = 88;
    const distanceFromBottom = window.innerHeight - clientY;
    if (clientY < edgeZone) {
      scroll.velocity = -420 * Math.min(1, (edgeZone - clientY) / edgeZone);
    } else if (distanceFromBottom < edgeZone) {
      scroll.velocity = 420 * Math.min(1, (edgeZone - distanceFromBottom) / edgeZone);
    } else {
      scroll.velocity = 0;
      if (scroll.frame !== null) window.cancelAnimationFrame(scroll.frame);
      scroll.frame = null;
      scroll.lastFrameAt = null;
      return;
    }

    if (scroll.velocity === 0 || scroll.frame !== null) return;
    const scrollFrame = (timestamp: number) => {
      scroll.frame = null;
      if (!scroll.active || scroll.velocity === 0) return;
      if (scroll.lastFrameAt !== null) {
        const previousScrollY = window.scrollY;
        const elapsed = Math.min(timestamp - scroll.lastFrameAt, 32) / 1000;
        window.scrollBy(0, scroll.velocity * elapsed);
        if (window.scrollY === previousScrollY) {
          scroll.lastFrameAt = null;
          return;
        }
      }
      scroll.lastFrameAt = timestamp;
      scroll.frame = window.requestAnimationFrame(scrollFrame);
    };
    scroll.frame = window.requestAnimationFrame(scrollFrame);
  };
  const startEdgeAutoScroll = (clientY: number) => {
    stopEdgeAutoScroll();
    edgeAutoScroll.current.active = true;
    const trackDragPosition = (event: DragEvent) => updateEdgeAutoScroll(event.clientY);
    document.addEventListener("drag", trackDragPosition, true);
    document.addEventListener("dragover", trackDragPosition, true);
    edgeAutoScroll.current.cleanup = () => {
      document.removeEventListener("drag", trackDragPosition, true);
      document.removeEventListener("dragover", trackDragPosition, true);
    };
    updateEdgeAutoScroll(clientY);
  };
  useEffect(() => () => stopEdgeAutoScroll(), []);
  const weekTasks = tasks.filter((task) => weekDays.some((day) => day.date === task.date));
  const completed = weekTasks.filter((task) => task.done).length;
  const progress = weekTasks.length ? Math.round((completed / weekTasks.length) * 100) : 0;
  const plannedMinutes = weekTasks.reduce((sum, task) => sum + task.minutes, 0);
  return <div className="week-view">
    <section className="week-hero"><div><div className="eyebrow accent"><CalendarDays size={13} /> WEEKLY FIELD NOTES</div><h1>Make a week<br />that can breathe.</h1><p>See the shape of what’s ahead without filling every inch of it.</p></div><div className="week-score"><div className="week-score-ring" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}><div><strong>{progress}</strong><span>% clear</span></div></div><div><span className="eyebrow">WEEK IN VIEW</span><strong>{completed} of {weekTasks.length} tasks complete</strong><small>{formatMinutes(plannedMinutes)} planned across the week</small></div></div></section>
    <div className="week-toolbar"><div><div className="flex items-center gap-1"><button type="button" className="icon-button" onClick={onPreviousWeek} aria-label="Previous week"><ChevronLeft size={17} /></button><span className="eyebrow">{weekLabel}</span><button type="button" className="icon-button" onClick={onNextWeek} aria-label="Next week"><ChevronRight size={17} /></button>{weekOffset !== 0 && <button type="button" className="secondary-action" onClick={onToday}>Today</button>}</div><h2>Seven small horizons</h2></div><button className="primary-action" onClick={() => openCreate("", selectedDay)}><Plus size={15} /> Plan a task</button></div>
    <div className="weekly-grid">{weekDays.map((day) => { const dayTasks = tasks.filter((task) => task.date === day.date); const dayCompleted = dayTasks.filter((task) => task.done).length; const dayMinutes = dayTasks.reduce((sum, task) => sum + task.minutes, 0); const selected = selectedDay === day.date; const dropTarget = dropTargetDate === day.date; return <article className={`weekly-day ${day.current ? "current-day" : ""} ${selected ? "selected-day" : ""} ${dropTarget ? "ring-2 ring-inset ring-[#89967b]/60" : ""}`} key={day.date} onClick={() => { if (Date.now() < dragClickBlockUntil.current) return; setSelectedDay(day.date); setActiveId(dayTasks.find((task) => !task.done)?.id ?? dayTasks[0]?.id ?? null); }} onDragOver={(event) => { if (!draggedTaskId) return; event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropTargetDate(day.date); }} onDragLeave={() => setDropTargetDate((date) => date === day.date ? null : date)} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const taskId = event.dataTransfer.getData("text/plain") || draggedTaskId; setDraggedTaskId(null); setDropTargetDate(null); stopEdgeAutoScroll(); dragClickBlockUntil.current = Date.now() + 500; window.setTimeout(() => { dragClickBlockUntil.current = 0; }, 500); if (taskId) onMoveTask(taskId, day.date); }}><header className="weekly-day-header"><div><span>{day.short}</span><strong>{day.number}</strong></div>{day.current && <em>Today</em>}<button className="day-menu" onClick={(event) => { event.stopPropagation(); setSelectedDay(day.date); showToast(`${day.label} is in view`); }} aria-label={`Focus on ${day.label}`}><ArrowUpRight size={16} /></button></header><div className="weekly-day-stats"><span>{dayTasks.length} {dayTasks.length === 1 ? "task" : "tasks"}</span><span>{dayCompleted} done</span><span>{formatMinutes(dayMinutes)}</span></div><div className="weekly-day-tasks">{dayTasks.length ? dayTasks.map((task) => <div className={`week-task ${task.done ? "week-task-done" : ""} cursor-grab active:cursor-grabbing`} key={task.id} draggable onDragStart={(event) => { if ((event.target as HTMLElement).closest("button")) { event.preventDefault(); return; } event.stopPropagation(); setDraggedTaskId(task.id); setDropTargetDate(null); dragClickBlockUntil.current = Date.now() + 1000; event.dataTransfer.setData("text/plain", task.id); event.dataTransfer.effectAllowed = "move"; startEdgeAutoScroll(event.clientY); }} onDragEnd={() => { setDraggedTaskId(null); setDropTargetDate(null); stopEdgeAutoScroll(); window.setTimeout(() => { dragClickBlockUntil.current = 0; }, 500); }} onClick={(event) => { event.stopPropagation(); if (Date.now() < dragClickBlockUntil.current) return; setSelectedDay(day.date); setActiveId(task.id); }}><button className="week-check" onClick={(event) => { event.stopPropagation(); toggleTask(task.id); }} aria-label={`Mark ${task.title} complete`}>{task.done && <Check size={11} />}</button><div className="week-task-copy"><div><span>{task.time}</span><span className={`energy-tag ${energyStyles[task.energy]}`}>{task.energy}</span></div><strong>{task.title}</strong></div><button className="week-task-edit" onClick={(event) => { event.stopPropagation(); openEdit(task); }} aria-label={`Edit ${task.title}`}><Pencil size={13} /></button></div>) : <div className="weekly-empty"><Leaf size={17} /><span>{day.current ? "A clean page." : "Open space."}</span><button onClick={(event) => { event.stopPropagation(); openCreate("", day.date); }}>Add one <Plus size={11} /></button></div>}</div></article>; })}</div>
    <div className="week-note"><Wind size={16} /><span>Leave a little room between the landmarks.</span><button onClick={() => showToast("A spacious week is a useful week")}>Why?</button></div>
  </div>;
}

function NoteForm({ mode, initial, onSave, onCancel, onRequestDelete, deleteConfirm, onConfirmDelete, onCancelDelete }: { mode: "create" | "edit"; initial: NoteDraft; onSave: (draft: NoteDraft) => void; onCancel: () => void; onRequestDelete?: () => void; deleteConfirm?: boolean; onConfirmDelete?: () => void; onCancelDelete?: () => void }) {
  const [draft, setDraft] = useState<NoteDraft>(initial);
  const [error, setError] = useState("");
  const submit = (event: React.FormEvent) => { event.preventDefault(); const title = draft.title.trim(); if (!title) { setError("Give this note a title before saving."); return; } onSave({ title, body: draft.body.trim() }); };
  return <form className="note-form" onSubmit={submit} noValidate>
    <div className="task-form-heading"><div><span className="eyebrow accent"><Feather size={12} /> {mode === "edit" ? "EDIT NOTE" : "NEW NOTE"}</span><h2 id="note-form-title">{mode === "edit" ? "Keep the thread" : "Catch the thought"}</h2><p>{mode === "edit" ? "Let the note stay loose, but keep it clear." : "A place for the thought that is not a task yet."}</p></div><button type="button" className="close-modal" onClick={onCancel} aria-label="Close note form"><X size={18} /></button></div>
    <div className="note-form-fields"><label className="form-field full"><span>Title <b>*</b></span><input autoFocus value={draft.title} onChange={(event) => { setError(""); setDraft((current) => ({ ...current, title: event.target.value })); }} placeholder="e.g. A question to carry forward" aria-invalid={Boolean(error)} />{error && <small className="field-error">{error}</small>}</label><label className="form-field full"><span>Body</span><textarea value={draft.body} onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} placeholder="Let it take up a little space here..." rows={9} /></label></div>
    {deleteConfirm && <div className="delete-confirm"><div className="delete-icon"><Trash2 size={17} /></div><div><strong>Delete this note?</strong><p>This can’t be undone.</p></div><div className="delete-actions"><button type="button" className="cancel-delete" onClick={onCancelDelete}>Keep it</button><button type="button" className="confirm-delete" onClick={onConfirmDelete}>Delete</button></div></div>}
    <div className="task-form-footer">{mode === "edit" ? <button type="button" className="delete-trigger" onClick={onRequestDelete}><Trash2 size={15} /> Delete note</button> : <span className="required-note"><b>*</b> Required</span>}<div className="form-actions"><button type="button" className="secondary-action" onClick={onCancel}>Cancel</button><button className="primary-action" type="submit"><Save size={15} /> {mode === "edit" ? "Save changes" : "Save note"}</button></div></div>
  </form>;
}

function NotesView({ notes, search, setSearch, selectedNoteId, setSelectedNoteId, openCreate, openEdit, loading, error }: { notes: Note[]; search: string; setSearch: (value: string) => void; selectedNoteId: string | null; setSelectedNoteId: (id: string | null) => void; openCreate: () => void; openEdit: (note: Note) => void; loading: boolean; error: string }) {
  const filteredNotes = useMemo(() => { const query = search.trim().toLowerCase(); return [...notes].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)).filter((note) => !query || `${note.title} ${note.body}`.toLowerCase().includes(query)); }, [notes, search]);
  const selectedNote = filteredNotes.find((note) => note.id === selectedNoteId) || filteredNotes[0];
  useEffect(() => { if (selectedNote && selectedNote.id !== selectedNoteId) setSelectedNoteId(selectedNote.id); if (!selectedNote && selectedNoteId !== null) setSelectedNoteId(null); }, [selectedNote, selectedNoteId, setSelectedNoteId]);
  return <div className="notes-view">
    <section className="notes-hero"><div><div className="eyebrow accent"><Feather size={13} /> LOOSE NOTES</div><h1>Keep a thought<br />before it drifts.</h1><p>A quiet shelf for questions, fragments, and the things that are not tasks yet.</p></div><button className="primary-action" onClick={openCreate}><Plus size={15} /> New note</button></section>
    <div className="notes-workspace"><div className="notes-list-panel"><div className="notes-list-heading"><div><span className="eyebrow">YOUR NOTEBOOK</span><h2>{notes.length} {notes.length === 1 ? "note" : "notes"}</h2></div><button className="icon-button notes-add-icon" onClick={openCreate} aria-label="New note"><Plus size={18} /></button></div><label className="notes-search"><Inbox size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your notes" aria-label="Search notes" />{search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search"><X size={14} /></button>}</label><div className="notes-list">{loading ? <p role="status">Loading your notes…</p> : error ? <p role="alert">Could not load your notes. {error}</p> : !notes.length ? <div className="notes-empty-list"><Feather size={23} /><strong>Nothing loose yet.</strong><span>Give the first thought somewhere to land.</span><button onClick={openCreate}>Write a note <ArrowUpRight size={14} /></button></div> : !filteredNotes.length ? <div className="notes-empty-list search-empty"><Compass size={23} /><strong>No matching notes.</strong><span>Try a different word or let the thought rest.</span></div> : filteredNotes.map((note) => <button className={`note-list-item ${selectedNote?.id === note.id ? "selected" : ""}`} key={note.id} onClick={() => setSelectedNoteId(note.id)}><div className="note-list-top"><span>{formatNoteDate(note.updatedAt)}</span><ChevronRight size={14} /></div><strong>{note.title}</strong><p>{note.body || "No body yet — open to add a little more."}</p></button>)}</div></div><article className="note-reader">{selectedNote ? <><div className="note-reader-top"><span className="eyebrow">LAST TOUCHED · {formatNoteDate(selectedNote.updatedAt)}</span><button className="secondary-action" onClick={() => openEdit(selectedNote)}><Pencil size={14} /> Edit note</button></div><div className="note-reader-content"><span className="note-created">Written {formatNoteDate(selectedNote.createdAt)}</span><h2>{selectedNote.title}</h2><p>{selectedNote.body || "This note is waiting for its first sentence."}</p></div></> : <div className="note-reader-empty"><div className="empty-route-mark"><Feather size={19} /></div><h3>Your quiet page.</h3><p>Select a note to read it here, or start a new one when a thought arrives.</p><button className="primary-action" onClick={openCreate}><Plus size={15} /> New note</button></div>}</article></div>
  </div>;
}

const formatCountdown = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

function FocusMode({ task, session, setSession, onComplete, onExit, onAddTask, onReturnToday }: { task?: Task; session: FocusSession | null; setSession: React.Dispatch<React.SetStateAction<FocusSession | null>>; onComplete: () => void; onExit: () => void; onAddTask: () => void; onReturnToday: () => void }) {
  const [exitConfirm, setExitConfirm] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const remainingSeconds = session ? getFocusRemainingSeconds(session, now) : 0;
  const finished = Boolean(session?.completed || (remainingSeconds === 0 && session && now >= session.endAt && now >= session.startAt));
  const beforeStart = Boolean(session && !session.completed && session.pausedAt === null && now < session.startAt);
  const percent = session ? Math.min(100, Math.max(0, Math.round(((session.durationSeconds - remainingSeconds) / session.durationSeconds) * 100))) : 0;
  useEffect(() => { if (!session || session.completed) return; const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, [session?.completed]);
  useEffect(() => { if (!session || session.completed || session.pausedAt !== null || now < session.startAt || now < session.endAt) return; setSession((current) => current && current.taskId === session.taskId && !current.completed ? { ...current, isRunning: false, completed: true, pausedAt: null, pausedRemainingSeconds: null, updatedAt: Date.now() } : current); }, [now, session, setSession]);
  useEffect(() => { closeButtonRef.current?.focus(); }, []);
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); setExitConfirm(true); } if (event.key === " " && !["INPUT", "TEXTAREA", "BUTTON"].includes((event.target as HTMLElement).tagName)) { event.preventDefault(); setSession((current) => current ? (current.pausedAt === null && !beforeStart ? pauseFocusSession(current) : current.pausedAt !== null ? resumeFocusSession(current) : current) : current); } if (event.key === "Enter" && (event.target as HTMLElement).dataset.focusComplete === "true") { event.preventDefault(); onComplete(); } if (event.key === "Tab" && overlayRef.current) { const focusable: HTMLElement[] = Array.from(overlayRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input, textarea, select")); if (!focusable.length) return; const first = focusable[0]; const last = focusable[focusable.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } } }; document.addEventListener("keydown", onKeyDown); return () => document.removeEventListener("keydown", onKeyDown); }, [beforeStart, onComplete, setSession]);
  if (!task) return <div className="focus-overlay no-task-focus" role="dialog" aria-modal="true" aria-labelledby="focus-empty-title" ref={overlayRef}><div className="focus-empty-mark"><Leaf size={34} /></div><span className="eyebrow accent">A QUIET START</span><h2 id="focus-empty-title">Nothing needs your attention yet.</h2><p>Give the day one clear thing first, then come back here when it is ready for your attention.</p><div className="focus-empty-actions"><button className="primary-action" onClick={onAddTask}><Plus size={15} /> Add a task</button><button className="secondary-action" onClick={onReturnToday}>Return to Today</button></div></div>;
  return <div className="focus-overlay" role="dialog" aria-modal="true" aria-labelledby="focus-title" ref={overlayRef}><div className="focus-topline"><span className="focus-brand"><div className="focus-brand-mark"><img src="/images/dayweave-mark.webp" alt="" /></div><strong>dayweave</strong></span><span className="eyebrow">ONE THING · {task.time}</span><button ref={closeButtonRef} className="focus-exit" onClick={() => setExitConfirm(true)} aria-label="Exit focus mode"><X size={19} /> Exit</button></div><main className="focus-content"><div className="focus-route-note"><span className="focus-route-line" /><span>{task.section.toUpperCase()} · {task.energy.toUpperCase()} ENERGY</span><span className="focus-route-line" /></div><h1 id="focus-title">{task.title}</h1><p className="focus-note">{task.note}</p><div className={`focus-timer-wrap ${finished ? "focus-finished" : ""}`}><div className="focus-timer-progress" style={{ "--focus-progress": `${percent * 3.6}deg` } as React.CSSProperties}><div className="focus-timer-inner" role="status" aria-live="polite"><strong>{finished ? "Done" : formatCountdown(remainingSeconds)}</strong><span>{finished ? "TIME WELL SPENT" : beforeStart ? "NOT STARTED" : `${formatMinutes(task.minutes)} ESTIMATED`}</span></div></div></div>{finished ? <div className="focus-complete-copy"><span className="eyebrow accent"><Check size={13} /> BLOCK COMPLETE</span><h2>You stayed with it.</h2><p>The task is still here until you choose what comes next.</p><button className="primary-action" data-focus-complete="true" onClick={onComplete}><Check size={15} /> Mark complete</button><button className="focus-extend" onClick={() => setSession((current) => current ? resumeFocusSession({ ...current, pausedAt: Date.now(), pausedRemainingSeconds: 5 * 60, completed: false }, Date.now()) : current)}>Continue for 5 more minutes</button></div> : <div className="focus-controls"><div className="focus-control-meta"><span>{percent}% of this block</span><span>{task.energy} energy · {formatMinutes(task.minutes)}</span></div><div className="focus-control-buttons"><button className="focus-pause" disabled={beforeStart} onClick={() => setSession((current) => current ? (current.pausedAt === null ? pauseFocusSession(current) : resumeFocusSession(current)) : current)} aria-label={currentSessionLabel(session, beforeStart)}>{currentSessionLabel(session, beforeStart)}</button><button className="primary-action focus-complete-button" data-focus-complete="true" onClick={onComplete}><Check size={16} /> Complete</button></div></div>}</main>{exitConfirm && <div className="focus-confirm" role="alertdialog" aria-modal="true" aria-labelledby="leave-focus-title"><span className="eyebrow accent">KEEP THE THREAD</span><h2 id="leave-focus-title">Leave focus?</h2><p>Your progress will be kept.</p><div><button className="secondary-action" onClick={() => setExitConfirm(false)}>Keep focusing</button><button className="primary-action" onClick={onExit}>Leave focus</button></div></div>}</div>;
}

export default function Home() {
  const { userId } = useAuth();
  const [location, setLocation] = useLocation();
  const [currentDate, setCurrentDate] = useState(localDateString);
  const [weekOffset, setWeekOffset] = useState(0); const displayedWeekDays = useMemo(() => getWeekDays(addDateDays(currentDate, weekOffset * 7), currentDate), [currentDate, weekOffset]); const weekLabel = formatWeekRange(displayedWeekDays);
  const [tasks, setTasks] = useState<Task[]>([]); const tasksRef = useRef<Task[]>([]); const userIdRef = useRef(userId); userIdRef.current = userId;
  const [tasksLoading, setTasksLoading] = useState(true); const [tasksReady, setTasksReady] = useState(false); const [tasksError, setTasksError] = useState(""); const [taskLoadRetry, setTaskLoadRetry] = useState(0); const taskLoadInFlight = useRef(false);
  const [focusHistorySessions, setFocusHistorySessions] = useState<FocusSessionHistory[]>([]); const [focusHistoryLoading, setFocusHistoryLoading] = useState(true); const [focusHistoryError, setFocusHistoryError] = useState(false);
  const [taskSearch, setTaskSearch] = useState(""); const [taskStatusFilter, setTaskStatusFilter] = useState<TaskStatusFilter>("all"); const [taskEnergyFilter, setTaskEnergyFilter] = useState<TaskEnergyFilter>("all"); const [taskSectionFilter, setTaskSectionFilter] = useState<TaskSectionFilter>("all");
  const mutationQueue = useRef<Promise<void>>(Promise.resolve());
  const replaceTasks = (update: Task[] | ((current: Task[]) => Task[])) => { const next = typeof update === "function" ? update(tasksRef.current) : update; tasksRef.current = next; setTasks(next); };
  const queueTaskMutation = <T,>(operation: () => Promise<T>) => { const result = mutationQueue.current.then(operation); mutationQueue.current = result.then(() => undefined, () => undefined); return result; };
  const [notes, setNotes] = useState<Note[]>([]); const notesRef = useRef<Note[]>([]); const [notesLoading, setNotesLoading] = useState(true); const [notesError, setNotesError] = useState("");
  const noteMutationQueue = useRef<Promise<void>>(Promise.resolve());
  const replaceNotes = (update: Note[] | ((current: Note[]) => Note[])) => { const next = typeof update === "function" ? update(notesRef.current) : update; notesRef.current = next; setNotes(next); };
  const queueNoteMutation = <T,>(operation: () => Promise<T>) => { const result = noteMutationQueue.current.then(operation); noteMutationQueue.current = result.then(() => undefined, () => undefined); return result; };
  const [intention, setIntention] = useState(DEFAULT_DAILY_INTENTION); const [intentionLoading, setIntentionLoading] = useState(true); const [intentionLoadedKey, setIntentionLoadedKey] = useState<string | null>(null); const [intentionSaveStatus, setIntentionSaveStatus] = useState<{ key: string; editVersion: number; status: "saving" | "saved" | "failed" } | null>(null);
  const intentionLoadSequence = useRef(0); const intentionEditVersion = useRef(0); const intentionDirty = useRef(false); const intentionWriteQueue = useRef<Promise<void>>(Promise.resolve());
  const intentionKey = userId ? `${userId}:${currentDate}` : ""; const intentionKeyRef = useRef(intentionKey); intentionKeyRef.current = intentionKey;
  const visibleIntention = intentionLoadedKey === intentionKey ? intention : DEFAULT_DAILY_INTENTION;
  const visibleIntentionSaveStatus = intentionLoadedKey === intentionKey && intentionSaveStatus?.key === intentionKey && intentionSaveStatus.editVersion === intentionEditVersion.current ? intentionSaveStatus.status : null;
  const [view, setView] = useState<"today" | "week" | "notes">(() => viewForPath(location)); const [newTask, setNewTask] = useState(""); const [activeId, setActiveId] = useState<string | null>(null); const [selectedWeekDay, setSelectedWeekDay] = useState(localDateString()); const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null); const [notesSearch, setNotesSearch] = useState(""); const [focusSession, setFocusSession] = useState<FocusSession | null>(null); const focusSessionRef = useRef(focusSession); focusSessionRef.current = focusSession; const previousFocusUserId = useRef(userId); const [focusOpen, setFocusOpen] = useState(false); const [mobileNavOpen, setMobileNavOpen] = useState(false); const [menuOpen, setMenuOpen] = useState(false); const [toast, setToast] = useState(""); const toastTimerRef = useRef<number | null>(null); const [preferencesOpen, setPreferencesOpen] = useState(false); const [reflectionOpen, setReflectionOpen] = useState(false); const [reflectionWentWell, setReflectionWentWell] = useState(""); const [reflectionCarryForward, setReflectionCarryForward] = useState(""); const [reflectionLoading, setReflectionLoading] = useState(false); const [reflectionSaving, setReflectionSaving] = useState(false); const reflectionSaveInFlight = useRef(false); const reflectionDateRef = useRef(currentDate); reflectionDateRef.current = currentDate;
  const [taskModal, setTaskModal] = useState<"create" | "edit" | null>(null); const [formDraft, setFormDraft] = useState<TaskDraft>(() => makeDefaultTaskDraft(localDateString())); const [editingId, setEditingId] = useState<string | null>(null); const [deleteConfirm, setDeleteConfirm] = useState(false); const [taskSavePending, setTaskSavePending] = useState(false); const taskSaveInFlight = useRef(false);
  const [noteModal, setNoteModal] = useState<"create" | "edit" | null>(null); const [noteDraft, setNoteDraft] = useState<NoteDraft>({ title: "", body: "" }); const [editingNoteId, setEditingNoteId] = useState<string | null>(null); const [noteDeleteConfirm, setNoteDeleteConfirm] = useState(false);
  const focusCompletionRef = useRef<string | null>(null);
  useEffect(() => { return () => { if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current); toastTimerRef.current = null; }; }, []); useEffect(() => { setMenuOpen(false); }, [view]); useEffect(() => { setView(viewForPath(location)); }, [location]);
  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => { if (!(event.target as Element | null)?.closest(".top-actions")) setMenuOpen(false); };
    const closeOnScroll = () => setMenuOpen(false);
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    window.addEventListener("scroll", closeOnScroll, { passive: true });
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeOnOutsidePointer); window.removeEventListener("scroll", closeOnScroll); document.removeEventListener("keydown", closeOnEscape); };
  }, [menuOpen]);
  useEffect(() => {
    let active = true;
    taskLoadInFlight.current = true;
    setTasksLoading(true);
    setTasksReady(false);
    setTasksError("");
    replaceTasks([]);
    if (!userId) {
      setTasksLoading(false);
      taskLoadInFlight.current = false;
      return () => { active = false; };
    }
    void fetchTasks(userId).then((loadedTasks) => {
      if (!active || userIdRef.current !== userId) return;
      replaceTasks(loadedTasks);
      setTasksReady(true);
      const restoredSession = loadFocusSession(userId, loadedTasks);
      setFocusSession(restoredSession);
    }).catch((error: unknown) => {
      if (!active) return;
      const message = taskErrorMessage("load", error);
      setTasksError(message);
      showToast(message);
    }).finally(() => { if (active) { setTasksLoading(false); taskLoadInFlight.current = false; } });
    return () => { active = false; };
  }, [userId, taskLoadRetry]);
  useEffect(() => {
    if (!userId) return;
    const pendingDraft = loadPendingFocusHistory(userId);
    if (!pendingDraft) return;
    void createFocusSession(userId, pendingDraft).then(() => {
      removePendingFocusHistory(userId, pendingDraft.sessionId);
    }).catch(() => {
      // Leave the pending draft for a future authenticated load.
    });
  }, [userId]);
  useEffect(() => {
    let active = true;
    setFocusHistoryLoading(Boolean(userId));
    setFocusHistoryError(false);
    setFocusHistorySessions([]);
    if (!userId) {
      setFocusHistoryLoading(false);
      return () => { active = false; };
    }
    void getFocusSessions(userId).then((loadedSessions) => {
      if (active && userIdRef.current === userId) setFocusHistorySessions(loadedSessions);
    }).catch(() => {
      if (active && userIdRef.current === userId) setFocusHistoryError(true);
    }).finally(() => {
      if (active) setFocusHistoryLoading(false);
    });
    return () => { active = false; };
  }, [userId]);
  useEffect(() => {
    let active = true;
    setReflectionWentWell("");
    setReflectionCarryForward("");
    setReflectionLoading(Boolean(userId));
    if (!userId) {
      setReflectionLoading(false);
      return () => { active = false; };
    }
    void fetchDailyReflection(userId, currentDate).then((reflection) => {
      if (!active || userIdRef.current !== userId) return;
      setReflectionWentWell(reflection?.wentWell ?? "");
      setReflectionCarryForward(reflection?.carryForward ?? "");
    }).catch(() => {
      if (active && userIdRef.current === userId) showToast("Your daily reflection could not be loaded. Please try again.");
    }).finally(() => {
      if (active) setReflectionLoading(false);
    });
    return () => { active = false; };
  }, [userId, currentDate]);
  useEffect(() => {
    let active = true;
    setNotesLoading(true);
    setNotesError("");
    replaceNotes([]);
    if (!userId) {
      setNotesLoading(false);
      return () => { active = false; };
    }
    void fetchNotes(userId).then((loadedNotes) => {
      if (!active || userIdRef.current !== userId) return;
      replaceNotes(loadedNotes);
    }).catch((error: unknown) => {
      if (!active) return;
      const message = noteErrorMessage("load", error);
      setNotesError(message);
      showToast(message);
    }).finally(() => { if (active) setNotesLoading(false); });
    return () => { active = false; };
  }, [userId]);  useEffect(() => {
    let active = true;
    const sequence = ++intentionLoadSequence.current;
    const key = userId ? `${userId}:${currentDate}` : "";
    setIntentionLoadedKey(null);
    setIntentionLoading(Boolean(userId));
    setIntentionSaveStatus(null);
    
    intentionDirty.current = false;
    if (!userId) {
      setIntention(DEFAULT_DAILY_INTENTION);
      setIntentionLoading(false);
      return () => { active = false; };
    }
    void fetchDailyIntention(userId, currentDate).then((savedIntention) => {
      if (!active || sequence !== intentionLoadSequence.current || intentionKeyRef.current !== key) return;
      setIntention(savedIntention ?? DEFAULT_DAILY_INTENTION);
      setIntentionLoadedKey(key);
    }).catch((error: unknown) => {
      if (!active || sequence !== intentionLoadSequence.current || intentionKeyRef.current !== key) return;
      setIntention(DEFAULT_DAILY_INTENTION);
      setIntentionLoadedKey(key);
      
      showToast("Your daily intention could not be loaded. Please try again.");
    }).finally(() => {
      if (active && sequence === intentionLoadSequence.current) setIntentionLoading(false);
    });
    return () => { active = false; };
  }, [userId, currentDate]);
  useEffect(() => {
    if (!userId || !intentionDirty.current || intentionLoadedKey !== intentionKey) return;
    const savedUserId = userId;
    const savedDate = currentDate;
    const savedKey = intentionKey;
    const savedValue = intention;
    const editVersion = intentionEditVersion.current;
    const timeout = window.setTimeout(() => {
      const request = intentionWriteQueue.current.then(async () => {
        if (userIdRef.current !== savedUserId || intentionKeyRef.current !== savedKey) return;
        await saveDailyIntention(savedUserId, savedDate, savedValue);
        if (userIdRef.current === savedUserId && intentionKeyRef.current === savedKey && intentionEditVersion.current === editVersion) {
          intentionDirty.current = false;
          setIntentionSaveStatus({ key: savedKey, editVersion, status: "saved" });
        }
      });
      intentionWriteQueue.current = request.then(() => undefined, () => undefined);
      void request.catch((error: unknown) => {
        if (userIdRef.current !== savedUserId || intentionKeyRef.current !== savedKey || intentionEditVersion.current !== editVersion) return;
        setIntentionSaveStatus({ key: savedKey, editVersion, status: "failed" });
        setToast("Your daily intention could not be saved. Please try again.");
      });
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [userId, currentDate, intentionKey, intentionLoadedKey, intention]);  useEffect(() => { localStorage.removeItem(LEGACY_FOCUS_KEY); const previousUserId = previousFocusUserId.current; if (previousUserId && previousUserId !== userId) localStorage.removeItem(focusStorageKey(previousUserId)); previousFocusUserId.current = userId; setFocusSession(null); setFocusOpen(false); }, [userId]); useEffect(() => { const tick = window.setInterval(() => { const nextDate = localDateString(); setCurrentDate((current) => current === nextDate ? current : nextDate); }, 60_000); return () => window.clearInterval(tick); }, []); useEffect(() => { setSelectedWeekDay((selected) => displayedWeekDays.some((day) => day.date === selected) ? selected : addDateDays(currentDate, weekOffset * 7)); }, [currentDate, weekOffset, displayedWeekDays]); useEffect(() => { if (!userId) return; const key = focusStorageKey(userId); if (focusSession) localStorage.setItem(key, JSON.stringify(focusSession)); else localStorage.removeItem(key); }, [focusSession, userId]); useEffect(() => { if (focusSession && tasksReady && !tasks.some((task) => task.id === focusSession.taskId)) { setFocusSession(null); setFocusOpen(false); } }, [focusSession, tasks, tasksReady]);
  const todayTasks = useMemo(() => tasks.filter((task) => task.date === currentDate), [tasks, currentDate]); const completed = todayTasks.filter((task) => task.done).length; const todayRemaining = todayTasks.filter((task) => !task.done); const activeToday = todayTasks.find((task) => task.id === activeId) || todayRemaining[0] || todayTasks[0]; const selectedTask = tasks.find((task) => task.id === activeId) || tasks.find((task) => !task.done); const focusTask = focusSession ? tasks.find((task) => task.id === focusSession.taskId) : undefined; const progress = todayTasks.length ? Math.round((completed / todayTasks.length) * 100) : 0; const totalMinutes = todayRemaining.reduce((sum, task) => sum + task.minutes, 0); const todayPlannedMinutes = todayTasks.reduce((sum, task) => sum + task.minutes, 0);
  const todayFocusSessions = useMemo(() => focusHistorySessions.filter((session) => localDateString(new Date(session.completedAt)) === currentDate), [focusHistorySessions, currentDate]); const todayPlannedFocusMinutes = Math.round(todayFocusSessions.reduce((sum, session) => sum + session.plannedDurationSeconds, 0) / 60); const todayPausedMinutes = Math.round(todayFocusSessions.reduce((sum, session) => sum + session.pausedSeconds, 0) / 60);
  const filteredTodayTasks = useMemo(() => { const query = taskSearch.trim().toLowerCase(); return todayTasks.filter((task) => (!query || `${task.title} ${task.note}`.toLowerCase().includes(query)) && (taskStatusFilter === "all" || (taskStatusFilter === "completed" ? task.done : !task.done)) && (taskEnergyFilter === "all" || task.energy === taskEnergyFilter) && (taskSectionFilter === "all" || task.section === taskSectionFilter)); }, [todayTasks, taskSearch, taskStatusFilter, taskEnergyFilter, taskSectionFilter]);
  const taskFiltersActive = Boolean(taskSearch.trim() || taskStatusFilter !== "all" || taskEnergyFilter !== "all" || taskSectionFilter !== "all");
  const grouped = useMemo(() => sections.map((section) => ({ section, tasks: filteredTodayTasks.filter((task) => task.section === section) })).filter((group) => group.tasks.length), [filteredTodayTasks]);
  const showToast = (message: string) => { if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current); setToast(message); toastTimerRef.current = window.setTimeout(() => { setToast(""); toastTimerRef.current = null; }, 2400); };
  const retryTaskLoad = () => { if (tasksLoading || taskLoadInFlight.current) return; setTaskLoadRetry((value) => value + 1); };
  const changeDisplayedWeek = (amount: number) => { setWeekOffset((offset) => offset + amount); setSelectedWeekDay((date) => addDateDays(date, amount * 7)); };
  const toggleTask = async (id: string): Promise<boolean> => {
    if (!userId || tasksLoading) return false;
    return queueTaskMutation(async () => {
      const current = tasksRef.current.find((task) => task.id === id);
      if (!current || userIdRef.current !== userId) return false;
      try {
        const updated = await persistTask(userId, id, { done: !current.done });
        if (userIdRef.current === userId) replaceTasks((items) => items.map((task) => task.id === id ? updated : task));
        return true;
      } catch (error) { setToast(taskErrorMessage("update", error)); }
      return false;
    });
  };
  const moveTaskToDate = (id: string, date: string) => {
    if (!userId || tasksLoading) return;
    const initialTask = tasksRef.current.find((task) => task.id === id);
    if (!initialTask || initialTask.date === date) return;
    if (getTaskDateError("move", date, currentDate, initialTask.date)) {
      showToast("Tasks can't be moved to a past date.");
      return;
    }
    if (initialTask.done) {
      showToast("Completed tasks can't be moved.");
      return;
    }
    if (focusSessionRef.current?.taskId === id && !focusSessionRef.current.completed) {
      showToast("This task can't be moved while its Focus Session is active or paused.");
      return;
    }
    void queueTaskMutation(async () => {
      if (userIdRef.current !== userId) return;
      const currentTask = tasksRef.current.find((task) => task.id === id);
      if (!currentTask || currentTask.date === date) return;
      if (getTaskDateError("move", date, localDateString(), currentTask.date)) {
        showToast("Tasks can't be moved to a past date.");
        return;
      }
      if (currentTask.done) {
        showToast("Completed tasks can't be moved.");
        return;
      }
      const activeSession = focusSessionRef.current;
      if (activeSession?.taskId === id && !activeSession.completed) {
        showToast("This task can't be moved while its Focus Session is active or paused.");
        return;
      }
      try {
        const updated = await persistTask(userId, id, { date });
        if (userIdRef.current === userId) {
          replaceTasks((items) => items.map((task) => task.id === id ? updated : task));
          showToast("Task moved to a different day");
        }
      } catch (error) {
        if (userIdRef.current === userId) {
          setToast(taskErrorMessage("move", error));
        }
      }
    });
  };
  const deferTask = (id: string) => {
    if (!userId || tasksLoading) return;
    void queueTaskMutation(async () => {
      if (userIdRef.current !== userId) return;
      try {
        const updated = await persistTask(userId, id, { time: "16:30", section: "Afternoon" });
        if (userIdRef.current === userId) { replaceTasks((items) => items.map((task) => task.id === id ? updated : task)); showToast("Moved to the afternoon"); }
      } catch (error) { setToast(taskErrorMessage("update", error)); }
    });
  };
  const openCreate = (title = "", date = currentDate) => { const allowedDate = date < currentDate ? currentDate : date; setFormDraft({ ...makeDefaultTaskDraft(allowedDate), title, date: allowedDate }); setEditingId(null); setDeleteConfirm(false); setTaskModal("create"); setNewTask(""); };
  const openEdit = (task: Task) => { setFormDraft({ title: task.title, note: task.note, time: task.time, minutes: task.minutes, energy: task.energy, section: task.section, date: task.date }); setEditingId(task.id); setDeleteConfirm(false); setTaskModal("edit"); };
  const saveTask = (draft: TaskDraft) => {
    if (taskSaveInFlight.current) return;
    if (!userId || tasksLoading) { showToast("Sign in to save tasks."); return; }
    const targetId = taskModal === "edit" ? editingId : null;
    const mode = targetId === null ? "create" : "edit";
    const prepareDraft = (candidate: TaskDraft, task: Task | undefined, today: string): TaskDraft | null => {
      const lockReason = mode === "edit" ? getTaskDateLockReason(task, focusSessionRef.current, today) : null;
      const dateError = getTaskDateError(mode, candidate.date, today, task?.date, lockReason);
      if (!dateError) return candidate;
      if (mode === "edit" && task && lockReason && candidate.date !== task.date) {
        showToast(dateError);
        return { ...candidate, date: task.date };
      }
      showToast(dateError);
      return null;
    };
    const initialTask = targetId === null ? undefined : tasksRef.current.find((task) => task.id === targetId);
    if (targetId !== null && !initialTask) return;
    const initialDraft = prepareDraft(draft, initialTask, localDateString());
    if (!initialDraft) return;
    taskSaveInFlight.current = true;
    setTaskSavePending(true);
    void queueTaskMutation(async () => {
      try {
        if (userIdRef.current !== userId) return;
        const queuedTask = targetId === null ? undefined : tasksRef.current.find((task) => task.id === targetId);
        if (targetId !== null && !queuedTask) return;
        const queuedDraft = prepareDraft(initialDraft, queuedTask, localDateString());
        if (!queuedDraft) return;
        if (targetId !== null) {
          const updated = await persistTask(userId, targetId, queuedDraft);
          if (userIdRef.current === userId) { replaceTasks((items) => items.map((task) => task.id === targetId ? updated : task)); showToast("Task details saved"); }
        } else {
          const created = await insertTask(userId, queuedDraft);
          if (userIdRef.current === userId) { replaceTasks((items) => [...items, created]); setActiveId(created.id); showToast("Added to your route"); }
        }
        if (userIdRef.current === userId) { setTaskModal(null); setEditingId(null); setDeleteConfirm(false); }
      } catch (error) { setToast(taskErrorMessage("save", error)); }
      finally { taskSaveInFlight.current = false; setTaskSavePending(false); }
    });
  };
  const deleteTask = () => {
    if (editingId === null || !userId || tasksLoading) return;
    const targetId = editingId;
    void queueTaskMutation(async () => {
      if (userIdRef.current !== userId) return;
      try {
        await removeTask(userId, targetId);
        if (userIdRef.current === userId) {
          const remaining = tasksRef.current.filter((task) => task.id !== targetId);
          replaceTasks(remaining);
          if (activeId === targetId) setActiveId(remaining.find((task) => !task.done)?.id ?? remaining[0]?.id ?? null);
          setTaskModal(null); setEditingId(null); setDeleteConfirm(false); showToast("Task deleted");
        }
      } catch (error) { setToast(taskErrorMessage("delete", error)); }
    });
  };
  const openNoteCreate = () => { setNoteDraft({ title: "", body: "" }); setEditingNoteId(null); setNoteDeleteConfirm(false); setNoteModal("create"); };
  const openNoteEdit = (note: Note) => { setNoteDraft({ title: note.title, body: note.body }); setEditingNoteId(note.id); setNoteDeleteConfirm(false); setNoteModal("edit"); };
  const saveNote = (draft: NoteDraft) => {
    if (!userId || notesLoading) { showToast("Sign in to save notes."); return; }
    const targetId = noteModal === "edit" ? editingNoteId : null;
    void queueNoteMutation(async () => {
      if (userIdRef.current !== userId) return;
      try {
        if (targetId !== null) {
          const updated = await persistNote(userId, targetId, draft);
          if (userIdRef.current === userId) {
            replaceNotes((items) => items.map((note) => note.id === targetId ? updated : note));
            setSelectedNoteId(updated.id);
            showToast("Note saved");
          }
        } else {
          const created = await insertNote(userId, draft);
          if (userIdRef.current === userId) {
            replaceNotes((items) => [...items, created]);
            setSelectedNoteId(created.id);
            showToast("Note saved");
          }
        }
        if (userIdRef.current === userId) { setNoteModal(null); setEditingNoteId(null); setNoteDeleteConfirm(false); }
      } catch (error) { showToast(noteErrorMessage("save", error)); }
    });
  };
  const deleteNote = () => {
    if (editingNoteId === null || !userId || notesLoading) return;
    const targetId = editingNoteId;
    void queueNoteMutation(async () => {
      if (userIdRef.current !== userId) return;
      try {
        await removeNote(userId, targetId);
        if (userIdRef.current === userId) {
          const remaining = notesRef.current.filter((note) => note.id !== targetId);
          replaceNotes(remaining);
          if (selectedNoteId === targetId) setSelectedNoteId(remaining[0]?.id ?? null);
          setNoteModal(null); setEditingNoteId(null); setNoteDeleteConfirm(false); showToast("Note deleted");
        }
      } catch (error) { showToast(noteErrorMessage("delete", error)); }
    });
  };
  const saveReflection = async () => {
    if (!userId || reflectionSaveInFlight.current || reflectionLoading) return;
    reflectionSaveInFlight.current = true;
    setReflectionSaving(true);
    const saveDate = currentDate;
    const wentWell = reflectionWentWell.trim();
    const carryForward = reflectionCarryForward.trim();
    try {
      const saved = await saveDailyReflection(userId, currentDate, wentWell, carryForward);
      if (userIdRef.current === userId && reflectionDateRef.current === saveDate) {
        setReflectionWentWell(saved.wentWell);
        setReflectionCarryForward(saved.carryForward);
        setReflectionOpen(false);
      }
    } catch {
      showToast("Your daily reflection could not be saved. Please try again.");
    } finally {
      reflectionSaveInFlight.current = false;
      setReflectionSaving(false);
    }
  };
  const startFocus = (requestedTask?: Task) => { if (!userId) { setFocusSession(null); setFocusOpen(false); return; } const task = requestedTask && !requestedTask.done ? requestedTask : tasks.find((item) => !item.done); if (!task) { setFocusSession(null); setFocusOpen(true); return; } setActiveId(task.id); setFocusSession((current) => { const now = Date.now(); if (current?.taskId === task.id && !current.completed) return current.pausedAt !== null ? resumeFocusSession(current, now) : { ...current, isRunning: true, updatedAt: now }; const startAt = localDateTimeTimestamp(task.date, task.time); const endAt = startAt + task.minutes * 60 * 1000; return { sessionId: crypto.randomUUID(), taskId: task.id, durationSeconds: task.minutes * 60, startAt, endAt, pausedAt: null, pausedRemainingSeconds: null, pausedSeconds: 0, isRunning: true, completed: false, updatedAt: now }; }); setFocusOpen(true); };
  const exitFocus = () => { setFocusOpen(false); setFocusSession((current) => current ? pauseFocusSession(current) : null); };
  const completeFocus = async () => { if (!focusSession || focusCompletionRef.current === focusSession.sessionId) return; const completedSession = focusSession; focusCompletionRef.current = completedSession.sessionId; const task = tasksRef.current.find((item) => item.id === completedSession.taskId); const historyDraft: FocusSessionHistoryDraft = { sessionId: completedSession.sessionId, taskId: task?.id ?? null, taskTitle: task?.title ?? "Focus session", taskDate: task?.date ?? null, plannedDurationSeconds: completedSession.durationSeconds, startedAt: new Date(completedSession.startAt).toISOString(), completedAt: new Date().toISOString(), pausedSeconds: completedSession.pausedSeconds }; let historySaved = Boolean(userId); try { if (userId) { await createFocusSession(userId, historyDraft); removePendingFocusHistory(userId, historyDraft.sessionId); } } catch { historySaved = false; if (userId) savePendingFocusHistory(userId, historyDraft); } const taskCompleted = await toggleTask(completedSession.taskId); if (!taskCompleted) { focusCompletionRef.current = null; showToast("Task could not be completed. Please try again."); return; } setFocusOpen(false); setFocusSession(null); showToast(historySaved ? "Task completed" : "Task completed, but Focus History could not be saved."); };
  const taskBeingEdited = editingId ? tasks.find((task) => task.id === editingId) : undefined;
  const taskDateLockReason = taskModal === "edit" ? getTaskDateLockReason(taskBeingEdited, focusSession, currentDate) : null;
  return <DayweaveShell
    activeSection={view}
    sidebarDate={formatSidebarDate(currentDate)}
    breadcrumbSection={view === "today" ? "Today" : view === "week" ? "This week" : "Loose notes"}
    breadcrumbDetail={view === "today" ? formatLongDate(currentDate) : view === "week" ? weekLabel : `${notes.length} saved ${notes.length === 1 ? "note" : "notes"}`}
    todayCount={todayTasks.length}
    notesCount={notes.length}
    mobileNavOpen={mobileNavOpen}
    onToggleMobileNav={() => setMobileNavOpen((open) => !open)}
    onCloseMobileNav={() => setMobileNavOpen(false)}
    onNavigateToday={() => { setLocation("/"); setActiveId(todayTasks.find((task) => !task.done)?.id ?? todayTasks[0]?.id ?? null); }}
    onNavigateWeek={() => setLocation("/this-week")}
    onNavigateNotes={() => setLocation("/loose-notes")}
    onNavigateFocusHistory={() => setLocation("/focus-history")}
    onPreferencesClick={() => setPreferencesOpen(true)}
    ariaHidden={focusOpen}
    topActions={<div className="top-actions"><button className="icon-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="More options"><MoreHorizontal size={19} /></button>{menuOpen && <div className="pop-menu"><button onClick={() => { setMenuOpen(false); showToast("A blank day is a brave start"); }}>Clear the day</button><button onClick={() => { setMenuOpen(false); showToast("Share link copied"); }}>Share view</button></div>}<button className="focus-button" onClick={() => startFocus(selectedTask)}><Play size={15} fill="currentColor" /> Focus mode</button></div>}
    afterMain={<>
      {focusOpen && <FocusMode task={focusTask} session={focusSession} setSession={setFocusSession} onComplete={completeFocus} onExit={exitFocus} onAddTask={() => { setFocusOpen(false); setFocusSession(null); setView("today"); openCreate(); }} onReturnToday={() => { setFocusOpen(false); setFocusSession(null); setView("today"); }} />}
      {taskModal && <div className="modal-backdrop task-modal-backdrop" onClick={() => setTaskModal(null)}><div className="task-form-modal" role="dialog" aria-modal="true" aria-labelledby="task-form-title" onClick={(event) => event.stopPropagation()}><TaskForm mode={taskModal} initial={formDraft} today={currentDate} dateLockedMessage={taskDateLockReason} isSubmitting={taskSavePending} onSave={saveTask} onCancel={() => setTaskModal(null)} onRequestDelete={() => setDeleteConfirm(true)} deleteConfirm={deleteConfirm} onConfirmDelete={deleteTask} onCancelDelete={() => setDeleteConfirm(false)} /></div></div>}
      {noteModal && <div className="modal-backdrop task-modal-backdrop" onClick={() => setNoteModal(null)}><div className="task-form-modal note-form-modal" role="dialog" aria-modal="true" aria-labelledby="note-form-title" onClick={(event) => event.stopPropagation()}><NoteForm mode={noteModal} initial={noteDraft} onSave={saveNote} onCancel={() => setNoteModal(null)} onRequestDelete={() => setNoteDeleteConfirm(true)} deleteConfirm={noteDeleteConfirm} onConfirmDelete={deleteNote} onCancelDelete={() => setNoteDeleteConfirm(false)} /></div></div>}
      {toast && <div className="toast" role="status" aria-live="polite"><Check size={16} /> {toast}</div>}
      <PreferencesDialog open={preferencesOpen} onOpenChange={setPreferencesOpen} />
      <Dialog open={reflectionOpen} onOpenChange={setReflectionOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[20px] border-[#e8e4da] bg-[#fbfaf6] p-6 text-[#292d3b] shadow-[0_18px_60px_rgba(30,35,48,0.16)] sm:max-w-lg sm:p-8">
          <DialogHeader className="gap-2 pr-7 text-left">
            <span className="eyebrow accent">DAILY REFLECTION</span>
            <DialogTitle className="text-2xl font-semibold tracking-[-0.03em]">What mattered today?</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-[#77776f]">A quiet look at the shape of your day.</DialogDescription>
          </DialogHeader>
          <div className="mt-3 space-y-6">
            <section className="rounded-2xl border border-[#e9e5dc] bg-white/70 p-5">
              <span className="eyebrow">YOUR INTENTION</span>
              <p className="mt-3 mb-0 font-[Fraunces,serif] text-xl leading-snug text-[#1d2d35]">{visibleIntention || "No intention set today."}</p>
            </section>
            <section aria-labelledby="reflection-today-heading">
              <h2 id="reflection-today-heading" className="mb-3 text-xs font-bold uppercase tracking-[.1em] text-[#87918e]">Your day</h2>
              <p className="reflection-narrative">{completed > 0 ? "You made some movement today." : todayTasks.length > 0 ? "You gave today some shape." : "Today is still open."}</p>
              <div className="reflection-today-metrics grid gap-2 sm:grid-cols-3">
                <div className="reflection-metric"><strong><Check size={16} aria-hidden="true" />{completed}</strong><span>task{completed === 1 ? "" : "s"} completed</span></div>
                <div className="reflection-metric"><strong><ArrowDownRight size={16} aria-hidden="true" />{todayRemaining.length}</strong><span>task{todayRemaining.length === 1 ? "" : "s"} remaining</span></div>
                <div className="reflection-metric reflection-planned-metric"><strong><Clock3 size={16} aria-hidden="true" />{todayPlannedMinutes} min</strong><span>planned</span></div>
              </div>
            </section>
            <section aria-labelledby="reflection-focus-heading">
              <h2 id="reflection-focus-heading" className="mb-3 text-xs font-bold uppercase tracking-[.1em] text-[#87918e]">Focus</h2>
              {focusHistoryLoading ? <p className="m-0 text-sm text-[#647679]" role="status">Focus summary loading…</p> : focusHistoryError ? <p className="m-0 text-sm text-[#647679]" role="status">Focus summary unavailable right now.</p> : todayFocusSessions.length ? <p className="reflection-focus-summary">{todayFocusSessions.length} {todayFocusSessions.length === 1 ? "session" : "sessions"} · {todayPlannedFocusMinutes} min planned</p> : <div className="reflection-focus-empty"><strong>No focus sessions today.</strong><span>That&apos;s okay. Every day looks different.</span></div>}
            </section>
            <section className="reflection-before" aria-labelledby="reflection-before-heading">
              <h2 id="reflection-before-heading" className="mb-3 text-xs font-bold uppercase tracking-[.1em] text-[#87918e]">Before you go</h2>
              <div className="reflection-inputs">
                <label htmlFor="reflection-went-well">What went well?</label>
                <textarea id="reflection-went-well" value={reflectionWentWell} onChange={(event) => setReflectionWentWell(event.target.value)} placeholder="A few words about today..." rows={3} />
                <label htmlFor="reflection-carry-forward">What should carry forward?</label>
                <textarea id="reflection-carry-forward" value={reflectionCarryForward} onChange={(event) => setReflectionCarryForward(event.target.value)} placeholder="Something for tomorrow..." rows={3} />
              </div>
            </section>
            <div className="reflection-closing"><p>Take what matters with you.</p><button type="button" onClick={() => void saveReflection()} disabled={reflectionLoading || reflectionSaving}>{reflectionSaving ? "Saving..." : <>Done for today <ArrowUpRight size={15} /></>}</button></div>
          </div>
        </DialogContent>
      </Dialog>
    </>}
  >

          {view === "notes" ? <NotesView notes={notes} search={notesSearch} setSearch={setNotesSearch} selectedNoteId={selectedNoteId} setSelectedNoteId={setSelectedNoteId} openCreate={openNoteCreate} openEdit={openNoteEdit} loading={notesLoading} error={notesError} /> : view === "week" ? <WeeklyView tasks={tasks} selectedDay={selectedWeekDay} setSelectedDay={setSelectedWeekDay} openCreate={openCreate} openEdit={openEdit} setActiveId={(id) => setActiveId(id)} toggleTask={toggleTask} onMoveTask={moveTaskToDate} showToast={showToast} weekDays={displayedWeekDays} weekLabel={weekLabel} weekOffset={weekOffset} onPreviousWeek={() => changeDisplayedWeek(-1)} onNextWeek={() => changeDisplayedWeek(1)} onToday={() => { setWeekOffset(0); setSelectedWeekDay(currentDate); }} /> : <><section className="hero-row"><div className="hero-copy"><div className="eyebrow accent"><Sparkles size={13} /> MORNING CHECK-IN</div><h1>{visibleIntention}</h1><p className="hero-sub">A little direction goes a long way. What would make today feel well spent?</p><div className="intention-line"><Feather size={15} /><input aria-label="Daily intention" value={visibleIntention} disabled={!userId || intentionLoading} onChange={(event) => { intentionDirty.current = true; const editVersion = ++intentionEditVersion.current; setIntentionSaveStatus({ key: intentionKey, editVersion, status: "saving" }); setIntention(event.target.value); }} style={{ minWidth: 0 }} />{visibleIntentionSaveStatus && <span role="status" aria-live="polite" aria-atomic="true" style={{ flex: "none", whiteSpace: "nowrap", fontSize: 10, color: visibleIntentionSaveStatus === "failed" ? "#b86648" : visibleIntentionSaveStatus === "saved" ? "#71846e" : "#87928b" }}>{visibleIntentionSaveStatus === "saving" ? "Saving..." : visibleIntentionSaveStatus === "saved" ? "Saved" : "Save failed"}</span>}</div></div><div className="day-score"><div className="score-ring" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}><div><strong>{progress}</strong><span>% clear</span></div></div><span className="score-caption">{completed === 0 ? "A clean page" : `${completed} small win${completed === 1 ? "" : "s"}`}<br />already counts.</span></div></section><section className="workspace-grid"><div className="route-column"><div className="section-heading"><div><span className="eyebrow">YOUR ROUTE</span><h2>Shape the day</h2></div><span className="capacity"><Clock3 size={14} /> {formatMinutes(totalMinutes)} left</span></div><div className="add-task"><Plus size={18} /><input value={newTask} onChange={(event) => setNewTask(event.target.value)} onKeyDown={(event) => event.key === "Enter" && openCreate(newTask.trim())} placeholder="What’s taking up space in your head?" /><button onClick={() => openCreate(newTask.trim())}>Add</button></div><div className="task-filters" aria-label="Search and filter tasks"><input className="task-filter-search" value={taskSearch} onChange={(event) => setTaskSearch(event.target.value)} placeholder="Search tasks..." aria-label="Search tasks" /><select value={taskStatusFilter} onChange={(event) => setTaskStatusFilter(event.target.value as TaskStatusFilter)} aria-label="Filter tasks by status"><option value="all">Status: All</option><option value="active">Status: Active</option><option value="completed">Status: Completed</option></select><select value={taskEnergyFilter} onChange={(event) => setTaskEnergyFilter(event.target.value as TaskEnergyFilter)} aria-label="Filter tasks by energy"><option value="all">Energy: All</option><option value="Deep">Energy: Deep</option><option value="Light">Energy: Light</option><option value="Social">Energy: Social</option></select><select value={taskSectionFilter} onChange={(event) => setTaskSectionFilter(event.target.value as TaskSectionFilter)} aria-label="Filter tasks by section"><option value="all">Section: All</option>{sections.map((section) => <option key={section} value={section}>Section: {section}</option>)}</select>{taskFiltersActive && <button type="button" className="secondary-action" onClick={() => { setTaskSearch(""); setTaskStatusFilter("all"); setTaskEnergyFilter("all"); setTaskSectionFilter("all"); }}>Clear filters</button>}<span className="task-filter-count">{filteredTodayTasks.length === todayTasks.length ? `${todayTasks.length} ${todayTasks.length === 1 ? "task" : "tasks"}` : `${filteredTodayTasks.length} matching ${filteredTodayTasks.length === 1 ? "task" : "tasks"}`}</span></div><div className="task-route">{tasksLoading ? <p role="status">Loading your tasks…</p> : tasksError ? <div role="alert"><p>Could not load your tasks. {tasksError}</p><button type="button" className="secondary-action" onClick={retryTaskLoad} disabled={tasksLoading}>Retry</button></div> : grouped.length ? grouped.map((group) => <div className="route-group" key={group.section}><div className="route-label"><span>{group.section}</span><i /></div>{group.tasks.map((task) => <article className={`task-card ${task.id === activeToday?.id ? "selected" : ""} ${task.done ? "completed" : ""}`} key={task.id} onClick={() => setActiveId(task.id)}><button className="check-button" onClick={(event) => { event.stopPropagation(); toggleTask(task.id); }} aria-label={`Mark ${task.title} complete`}>{task.done && <Check size={14} />}</button><div className="task-content"><div className="task-meta"><span>{task.time}</span><span className={`energy-tag ${energyStyles[task.energy]}`}>{task.energy}</span><span>{formatMinutes(task.minutes)}</span></div><h3>{task.title}</h3><p>{task.note}</p></div><div className="task-actions"><button className="task-edit-button" onClick={(event) => { event.stopPropagation(); openEdit(task); }} aria-label={`Edit ${task.title}`}><Pencil size={15} /></button><button className="task-arrow" onClick={(event) => { event.stopPropagation(); startFocus(task); }} aria-label={`Focus on ${task.title}`}><ArrowUpRight size={17} /></button></div></article>)}</div>) : taskFiltersActive ? <div className="empty-route"><div className="empty-route-mark"><X size={18} /></div><h3>No tasks match these filters.</h3><p>Try a different search or clear the filters.</p><button onClick={() => { setTaskSearch(""); setTaskStatusFilter("all"); setTaskEnergyFilter("all"); setTaskSectionFilter("all"); }}>Clear filters</button></div> : <div className="empty-route"><div className="empty-route-mark"><Plus size={18} /></div><h3>Your route starts here.</h3><p>Capture a thought above, then give it a time and a little shape.</p><button onClick={() => openCreate()}>Shape your first task <ArrowUpRight size={15} /></button></div>}</div><div className="route-footer"><span><Wind size={16} /> Leave 45 minutes unplanned</span><button onClick={() => showToast("Your day has breathing room")}>Why?</button></div></div><aside className="now-column"><div className="now-card"><div className="now-header"><span className="eyebrow accent"><span className="pulse-dot" /> UP NEXT</span><span className="now-time">{activeToday?.time || "—"}</span></div>{activeToday ? <><div className="now-art"><img src="/images/dayweave-morning.webp" alt="Sunlit window and plant" /></div><div className="now-body"><span className="now-kicker">{activeToday.energy.toUpperCase()} ENERGY · {formatMinutes(activeToday.minutes)}</span><h2>{activeToday.title}</h2><p>{activeToday.note}</p><div className="now-actions"><button className="primary-action" onClick={() => startFocus(activeToday)}><Play size={15} fill="currentColor" /> Start focus</button><button className="secondary-action" onClick={() => deferTask(activeToday.id)}><ArrowDownRight size={15} /> Later</button></div></div></> : <div className="empty-now"><Leaf size={28} /><h3>Nothing pressing.</h3><p>You made it to the other side of the list.</p></div>}</div><div className="reflection-card"><div className="reflection-copy"><span className="eyebrow">LATER, MAYBE</span><h3>Close the loop gently.</h3><p>Three minutes to notice what moved.</p><button onClick={() => setReflectionOpen(true)}>Open reflection <ArrowUpRight size={15} /></button></div><img src="/images/dayweave-reflection.webp" alt="Warm evening desk" /></div></aside></section></>}
  </DayweaveShell>;
}
