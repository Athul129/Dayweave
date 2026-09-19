/* Dayweave style reminder: Quiet Cartography — editorial wayfinding, tactile paper, warm ink, offset composition, and humane pacing. */
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarDays, Check, ChevronRight, Clock3, Compass, Feather, Inbox, Leaf, MoreHorizontal, Pencil, Play, Plus, Save, Sparkles, Trash2, Wind, X } from "lucide-react";
import { createTask as insertTask, deleteTask as removeTask, fetchTasks, updateTask as persistTask, type Energy, type Section, type Task, type TaskDraft } from "@/lib/tasks";
import { createNote as insertNote, deleteNote as removeNote, fetchNotes, updateNote as persistNote, type Note, type NoteDraft } from "@/lib/notes";
import { fetchDailyIntention, saveDailyIntention } from "@/lib/intentions";
import { createFocusSession } from "@/lib/focusSessions";
import { getDefaultTaskMinutes } from "@/lib/preferences";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import DayweaveShell from "@/components/DayweaveShell";
import { PreferencesDialog } from "@/components/PreferencesDialog";

type WeekDay = { date: string; label: string; short: string; number: string; current?: boolean };
type TaskErrors = Partial<Record<keyof TaskDraft, string>>;
type FocusSession = { sessionId: string; taskId: string; durationSeconds: number; startAt: number; endAt: number; pausedAt: number | null; pausedRemainingSeconds: number | null; pausedSeconds: number; isRunning: boolean; completed: boolean; updatedAt: number };
const FOCUS_KEY = "dayweave-focus-session";
const DEFAULT_DAILY_INTENTION = "Make room for one thing that matters.";

const padDatePart = (value: number) => String(value).padStart(2, "0");
const localDateString = (value = new Date()) => `${value.getFullYear()}-${padDatePart(value.getMonth() + 1)}-${padDatePart(value.getDate())}`;
const parseDateOnly = (value: string) => { const [year, month, day] = value.split("-").map(Number); return new Date(year, month - 1, day); };
const addDateDays = (date: string, amount: number) => { const parsed = parseDateOnly(date); parsed.setDate(parsed.getDate() + amount); return localDateString(parsed); };
const mondayFor = (date: string) => { const parsed = parseDateOnly(date); const distanceFromMonday = (parsed.getDay() + 6) % 7; parsed.setDate(parsed.getDate() - distanceFromMonday); return localDateString(parsed); };
const getWeekDays = (currentDate: string): WeekDay[] => { const start = mondayFor(currentDate); return Array.from({ length: 7 }, (_, index) => { const date = addDateDays(start, index); const parsed = parseDateOnly(date); return { date, label: new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(parsed), short: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(parsed).toUpperCase(), number: String(parsed.getDate()), current: date === currentDate }; }); };
const formatLongDate = (date: string) => new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(parseDateOnly(date));
const formatSidebarDate = (date: string) => new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(parseDateOnly(date)).toUpperCase();
const formatWeekRange = (weekDays: WeekDay[]) => { const first = parseDateOnly(weekDays[0].date); const last = parseDateOnly(weekDays[weekDays.length - 1].date); const firstMonth = new Intl.DateTimeFormat("en-US", { month: "long" }).format(first); const lastMonth = new Intl.DateTimeFormat("en-US", { month: "long" }).format(last); const firstYear = first.getFullYear(); const lastYear = last.getFullYear(); if (firstYear === lastYear && firstMonth === lastMonth) return `${firstMonth} ${first.getDate()} — ${last.getDate()}, ${firstYear}`; if (firstYear === lastYear) return `${firstMonth} ${first.getDate()} — ${lastMonth} ${last.getDate()}, ${firstYear}`; return `${firstMonth} ${first.getDate()}, ${firstYear} — ${lastMonth} ${last.getDate()}, ${lastYear}`; };
const energyStyles: Record<Energy, string> = { Deep: "energy-deep", Light: "energy-light", Social: "energy-social" };
const sections: Section[] = ["Morning", "Midday", "Afternoon"];
const makeDefaultTaskDraft = (date: string): TaskDraft => ({ title: "", note: "A small, clear next step.", time: "16:00", minutes: getDefaultTaskMinutes(), energy: "Light", section: "Afternoon", date });
const formatMinutes = (minutes: number) => minutes >= 60 ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}` : `${minutes}m`;
const formatNoteDate = (value: string) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
const localDateTimeTimestamp = (date: string, time: string) => { const [year, month, day] = date.split("-").map(Number); const [hours, minutes] = time.split(":").map(Number); return new Date(year, month - 1, day, hours, minutes, 0, 0).getTime(); };
const getFocusRemainingSeconds = (session: FocusSession, now = Date.now()) => { if (session.completed) return 0; if (session.pausedAt !== null) return Math.max(0, Math.ceil(session.pausedRemainingSeconds ?? 0)); if (now < session.startAt) return session.durationSeconds; return Math.max(0, Math.ceil((session.endAt - now) / 1000)); };
const pauseFocusSession = (session: FocusSession, now = Date.now()): FocusSession => { const remainingSeconds = getFocusRemainingSeconds(session, now); return { ...session, pausedAt: now, pausedRemainingSeconds: remainingSeconds, isRunning: false, updatedAt: now }; };
const resumeFocusSession = (session: FocusSession, now = Date.now()): FocusSession => { const remainingSeconds = Math.max(0, Math.ceil(session.pausedRemainingSeconds ?? getFocusRemainingSeconds(session, now))); return { ...session, startAt: now, endAt: now + remainingSeconds * 1000, pausedAt: null, pausedRemainingSeconds: null, pausedSeconds: session.pausedSeconds + (session.pausedAt === null ? 0 : Math.max(0, Math.floor((now - session.pausedAt) / 1000))), isRunning: remainingSeconds > 0, completed: remainingSeconds === 0, updatedAt: now }; };
const currentSessionLabel = (session: FocusSession | null, beforeStart: boolean) => beforeStart ? "Not started" : session?.pausedAt === null ? "Pause timer" : "Resume timer";

function loadFocusSession(tasks?: Task[]): FocusSession | null {
  try {
    const saved = JSON.parse(localStorage.getItem(FOCUS_KEY) || "null") as (Partial<FocusSession> & { remainingSeconds?: number }) | null;
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

function TaskForm({ mode, initial, weekDays, onSave, onCancel, onRequestDelete, deleteConfirm, onConfirmDelete, onCancelDelete }: { mode: "create" | "edit"; initial: TaskDraft; weekDays: WeekDay[]; onSave: (draft: TaskDraft) => void; onCancel: () => void; onRequestDelete?: () => void; deleteConfirm?: boolean; onConfirmDelete?: () => void; onCancelDelete?: () => void }) {
  const [draft, setDraft] = useState<TaskDraft>(initial);
  const [errors, setErrors] = useState<TaskErrors>({});
  const update = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) => { setDraft((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: undefined })); };
  const submit = (event: React.FormEvent) => { event.preventDefault(); const nextErrors = validateTaskDraft(draft); if (Object.keys(nextErrors).length) { setErrors(nextErrors); return; } onSave({ ...draft, title: draft.title.trim(), note: draft.note.trim() || "A small, clear next step." }); };
  return <form className="task-form" onSubmit={submit} noValidate>
    <div className="task-form-heading"><div><span className="eyebrow accent"><Pencil size={12} /> {mode === "edit" ? "EDIT TASK" : "SHAPE TASK"}</span><h2 id="task-form-title">{mode === "edit" ? "Tune the details" : "Give it a place"}</h2><p>{mode === "edit" ? "Small adjustments keep the route honest." : "Add just enough detail to make this easy to return to."}</p></div><button type="button" className="close-modal" onClick={onCancel} aria-label="Close task form"><X size={18} /></button></div>
    <div className="form-fields">
      <label className="form-field full"><span>Title <b>*</b></span><input autoFocus value={draft.title} onChange={(event) => update("title", event.target.value)} placeholder="e.g. Send the project brief" aria-invalid={Boolean(errors.title)} />{errors.title && <small className="field-error">{errors.title}</small>}</label>
      <label className="form-field full"><span>Note</span><textarea value={draft.note} onChange={(event) => update("note", event.target.value)} placeholder="What does done look like?" rows={3} /></label>
      <label className="form-field"><span>Time <b>*</b></span><input type="time" value={draft.time} onChange={(event) => update("time", event.target.value)} aria-invalid={Boolean(errors.time)} />{errors.time && <small className="field-error">{errors.time}</small>}</label>
      <label className="form-field"><span>Duration <b>*</b></span><div className="duration-input"><input type="number" min="1" max="1440" step="5" value={draft.minutes || ""} onChange={(event) => update("minutes", Number(event.target.value))} aria-invalid={Boolean(errors.minutes)} /><span>min</span></div>{errors.minutes && <small className="field-error">{errors.minutes}</small>}</label>
      <fieldset className="form-field full"><legend>Energy level</legend><div className="choice-row">{(["Deep", "Light", "Social"] as Energy[]).map((energy) => <button type="button" key={energy} className={`choice-button ${draft.energy === energy ? `chosen ${energyStyles[energy]}` : ""}`} onClick={() => update("energy", energy)}>{energy}</button>)}</div></fieldset>
      <fieldset className="form-field full"><legend>Day section</legend><div className="choice-row section-choices">{sections.map((section) => <button type="button" key={section} className={`choice-button ${draft.section === section ? "chosen section-chosen" : ""}`} onClick={() => update("section", section)}>{section}</button>)}</div></fieldset>
      <fieldset className="form-field full"><legend>Day</legend><div className="choice-row day-choices">{weekDays.map((day) => <button type="button" key={day.date} className={`choice-button ${draft.date === day.date ? "chosen section-chosen" : ""}`} onClick={() => update("date", day.date)}>{day.label}</button>)}</div></fieldset>
    </div>
    {deleteConfirm && <div className="delete-confirm"><div className="delete-icon"><Trash2 size={17} /></div><div><strong>Delete this task?</strong><p>This can’t be undone.</p></div><div className="delete-actions"><button type="button" className="cancel-delete" onClick={onCancelDelete}>Keep it</button><button type="button" className="confirm-delete" onClick={onConfirmDelete}>Delete</button></div></div>}
    <div className="task-form-footer">{mode === "edit" ? <button type="button" className="delete-trigger" onClick={onRequestDelete}><Trash2 size={15} /> Delete task</button> : <span className="required-note"><b>*</b> Required</span>}<div className="form-actions"><button type="button" className="secondary-action" onClick={onCancel}>Cancel</button><button className="primary-action" type="submit"><Save size={15} /> {mode === "edit" ? "Save changes" : "Add to route"}</button></div></div>
  </form>;
}

function WeeklyView({ tasks, selectedDay, setSelectedDay, openCreate, openEdit, setActiveId, toggleTask, showToast, weekDays, weekLabel }: { tasks: Task[]; selectedDay: string; setSelectedDay: (date: string) => void; openCreate: (title?: string, date?: string) => void; openEdit: (task: Task) => void; setActiveId: (id: string | null) => void; toggleTask: (id: string) => void; showToast: (message: string) => void; weekDays: WeekDay[]; weekLabel: string }) {
  const completed = tasks.filter((task) => task.done).length;
  const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  const plannedMinutes = tasks.reduce((sum, task) => sum + task.minutes, 0);
  return <div className="week-view">
    <section className="week-hero"><div><div className="eyebrow accent"><CalendarDays size={13} /> WEEKLY FIELD NOTES</div><h1>Make a week<br />that can breathe.</h1><p>See the shape of what’s ahead without filling every inch of it.</p></div><div className="week-score"><div className="week-score-ring" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}><div><strong>{progress}</strong><span>% clear</span></div></div><div><span className="eyebrow">WEEK IN VIEW</span><strong>{completed} of {tasks.length} tasks moved</strong><small>{formatMinutes(plannedMinutes)} planned across the week</small></div></div></section>
    <div className="week-toolbar"><div><span className="eyebrow">{weekLabel}</span><h2>Seven small horizons</h2></div><button className="primary-action" onClick={() => openCreate("", selectedDay)}><Plus size={15} /> Plan a task</button></div>
    <div className="weekly-grid">{weekDays.map((day) => { const dayTasks = tasks.filter((task) => task.date === day.date); const dayCompleted = dayTasks.filter((task) => task.done).length; const dayMinutes = dayTasks.reduce((sum, task) => sum + task.minutes, 0); const selected = selectedDay === day.date; return <article className={`weekly-day ${day.current ? "current-day" : ""} ${selected ? "selected-day" : ""}`} key={day.date} onClick={() => { setSelectedDay(day.date); setActiveId(dayTasks.find((task) => !task.done)?.id ?? dayTasks[0]?.id ?? null); }}><header className="weekly-day-header"><div><span>{day.short}</span><strong>{day.number}</strong></div>{day.current && <em>Today</em>}<button className="day-menu" onClick={(event) => { event.stopPropagation(); setSelectedDay(day.date); showToast(`${day.label} is in view`); }} aria-label={`Focus on ${day.label}`}><ArrowUpRight size={16} /></button></header><div className="weekly-day-stats"><span>{dayTasks.length} {dayTasks.length === 1 ? "task" : "tasks"}</span><span>{dayCompleted} done</span><span>{formatMinutes(dayMinutes)}</span></div><div className="weekly-day-tasks">{dayTasks.length ? dayTasks.map((task) => <div className={`week-task ${task.done ? "week-task-done" : ""}`} key={task.id} onClick={(event) => { event.stopPropagation(); setSelectedDay(day.date); setActiveId(task.id); }}><button className="week-check" onClick={(event) => { event.stopPropagation(); toggleTask(task.id); }} aria-label={`Mark ${task.title} complete`}>{task.done && <Check size={11} />}</button><div className="week-task-copy"><div><span>{task.time}</span><span className={`energy-tag ${energyStyles[task.energy]}`}>{task.energy}</span></div><strong>{task.title}</strong></div><button className="week-task-edit" onClick={(event) => { event.stopPropagation(); openEdit(task); }} aria-label={`Edit ${task.title}`}><Pencil size={13} /></button></div>) : <div className="weekly-empty"><Leaf size={17} /><span>{day.current ? "A clean page." : "Open space."}</span><button onClick={(event) => { event.stopPropagation(); openCreate("", day.date); }}>Add one <Plus size={11} /></button></div>}</div></article>; })}</div>
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
  const [, setLocation] = useLocation();
  const [currentDate, setCurrentDate] = useState(localDateString); const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]); const weekLabel = formatWeekRange(weekDays);
  const [tasks, setTasks] = useState<Task[]>([]); const tasksRef = useRef<Task[]>([]); const userIdRef = useRef(userId); userIdRef.current = userId;
  const [tasksLoading, setTasksLoading] = useState(true); const [tasksReady, setTasksReady] = useState(false); const [tasksError, setTasksError] = useState("");
  const mutationQueue = useRef<Promise<void>>(Promise.resolve());
  const replaceTasks = (update: Task[] | ((current: Task[]) => Task[])) => { const next = typeof update === "function" ? update(tasksRef.current) : update; tasksRef.current = next; setTasks(next); };
  const queueTaskMutation = <T,>(operation: () => Promise<T>) => { const result = mutationQueue.current.then(operation); mutationQueue.current = result.then(() => undefined, () => undefined); return result; };
  const [notes, setNotes] = useState<Note[]>([]); const notesRef = useRef<Note[]>([]); const [notesLoading, setNotesLoading] = useState(true); const [notesError, setNotesError] = useState("");
  const noteMutationQueue = useRef<Promise<void>>(Promise.resolve());
  const replaceNotes = (update: Note[] | ((current: Note[]) => Note[])) => { const next = typeof update === "function" ? update(notesRef.current) : update; notesRef.current = next; setNotes(next); };
  const queueNoteMutation = <T,>(operation: () => Promise<T>) => { const result = noteMutationQueue.current.then(operation); noteMutationQueue.current = result.then(() => undefined, () => undefined); return result; };
  const [intention, setIntention] = useState(DEFAULT_DAILY_INTENTION); const [intentionLoading, setIntentionLoading] = useState(true); const [intentionLoadedKey, setIntentionLoadedKey] = useState<string | null>(null);
  const intentionLoadSequence = useRef(0); const intentionEditVersion = useRef(0); const intentionDirty = useRef(false); const intentionWriteQueue = useRef<Promise<void>>(Promise.resolve());
  const intentionKey = userId ? `${userId}:${currentDate}` : ""; const intentionKeyRef = useRef(intentionKey); intentionKeyRef.current = intentionKey;
  const visibleIntention = intentionLoadedKey === intentionKey ? intention : DEFAULT_DAILY_INTENTION;
  const [view, setView] = useState<"today" | "week" | "notes">("today"); const [newTask, setNewTask] = useState(""); const [activeId, setActiveId] = useState<string | null>(null); const [selectedWeekDay, setSelectedWeekDay] = useState(localDateString()); const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null); const [notesSearch, setNotesSearch] = useState(""); const [focusSession, setFocusSession] = useState<FocusSession | null>(() => loadFocusSession()); const [focusOpen, setFocusOpen] = useState(false); const [mobileNavOpen, setMobileNavOpen] = useState(false); const [menuOpen, setMenuOpen] = useState(false); const [toast, setToast] = useState(""); const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [taskModal, setTaskModal] = useState<"create" | "edit" | null>(null); const [formDraft, setFormDraft] = useState<TaskDraft>(() => makeDefaultTaskDraft(localDateString())); const [editingId, setEditingId] = useState<string | null>(null); const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [noteModal, setNoteModal] = useState<"create" | "edit" | null>(null); const [noteDraft, setNoteDraft] = useState<NoteDraft>({ title: "", body: "" }); const [editingNoteId, setEditingNoteId] = useState<string | null>(null); const [noteDeleteConfirm, setNoteDeleteConfirm] = useState(false);
  const focusCompletionRef = useRef<string | null>(null);
  useEffect(() => { setMenuOpen(false); }, [view]);
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
    setTasksLoading(true);
    setTasksReady(false);
    setTasksError("");
    replaceTasks([]);
    if (!userId) {
      setTasksLoading(false);
      return () => { active = false; };
    }
    void fetchTasks(userId).then((loadedTasks) => {
      if (!active || userIdRef.current !== userId) return;
      replaceTasks(loadedTasks);
      setTasksReady(true);
      const restoredSession = loadFocusSession(loadedTasks);
      setFocusSession(restoredSession);
      setFocusOpen(Boolean(restoredSession));
    }).catch((error: unknown) => {
      if (!active) return;
      setTasksError(error instanceof Error ? error.message : "Tasks could not be loaded.");
      setToast("Your tasks could not be loaded. Please try again.");
    }).finally(() => { if (active) setTasksLoading(false); });
    return () => { active = false; };
  }, [userId]);
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
      setNotesError(error instanceof Error ? error.message : "Notes could not be loaded.");
      setToast("Your notes could not be loaded. Please try again.");
    }).finally(() => { if (active) setNotesLoading(false); });
    return () => { active = false; };
  }, [userId]);  useEffect(() => {
    let active = true;
    const sequence = ++intentionLoadSequence.current;
    const key = userId ? `${userId}:${currentDate}` : "";
    setIntentionLoadedKey(null);
    setIntentionLoading(Boolean(userId));
    
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
      
      setToast("Your daily intention could not be loaded. Please try again.");
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
          
        }
      });
      intentionWriteQueue.current = request.then(() => undefined, () => undefined);
      void request.catch((error: unknown) => {
        if (userIdRef.current !== savedUserId || intentionKeyRef.current !== savedKey) return;
        
        setToast("Your daily intention could not be saved. Please try again.");
      });
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [userId, currentDate, intentionKey, intentionLoadedKey, intention]);  useEffect(() => { const tick = window.setInterval(() => { const nextDate = localDateString(); setCurrentDate((current) => current === nextDate ? current : nextDate); }, 60_000); return () => window.clearInterval(tick); }, []); useEffect(() => { setSelectedWeekDay(currentDate); }, [currentDate]); useEffect(() => { if (focusSession) localStorage.setItem(FOCUS_KEY, JSON.stringify(focusSession)); else localStorage.removeItem(FOCUS_KEY); }, [focusSession]); useEffect(() => { if (focusSession && tasksReady && !tasks.some((task) => task.id === focusSession.taskId)) { setFocusSession(null); setFocusOpen(false); } }, [focusSession, tasks, tasksReady]);
  const todayTasks = useMemo(() => tasks.filter((task) => task.date === currentDate), [tasks, currentDate]); const completed = todayTasks.filter((task) => task.done).length; const todayRemaining = todayTasks.filter((task) => !task.done); const activeToday = todayTasks.find((task) => task.id === activeId) || todayRemaining[0] || todayTasks[0]; const selectedTask = tasks.find((task) => task.id === activeId) || tasks.find((task) => !task.done); const focusTask = focusSession ? tasks.find((task) => task.id === focusSession.taskId) : undefined; const progress = todayTasks.length ? Math.round((completed / todayTasks.length) * 100) : 0; const totalMinutes = todayRemaining.reduce((sum, task) => sum + task.minutes, 0);
  const grouped = useMemo(() => sections.map((section) => ({ section, tasks: todayTasks.filter((task) => task.section === section) })).filter((group) => group.tasks.length), [todayTasks]);
  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2400); };
  const toggleTask = (id: string) => {
    if (!userId || tasksLoading) return;
    void queueTaskMutation(async () => {
      const current = tasksRef.current.find((task) => task.id === id);
      if (!current || userIdRef.current !== userId) return;
      try {
        const updated = await persistTask(userId, id, { done: !current.done });
        if (userIdRef.current === userId) replaceTasks((items) => items.map((task) => task.id === id ? updated : task));
      } catch (error) { setToast(error instanceof Error ? `Task update failed: ${error.message}` : "Task update failed."); }
    });
  };
  const deferTask = (id: string) => {
    if (!userId || tasksLoading) return;
    void queueTaskMutation(async () => {
      if (userIdRef.current !== userId) return;
      try {
        const updated = await persistTask(userId, id, { time: "16:30", section: "Afternoon" });
        if (userIdRef.current === userId) { replaceTasks((items) => items.map((task) => task.id === id ? updated : task)); showToast("Moved to the afternoon"); }
      } catch (error) { setToast(error instanceof Error ? `Task update failed: ${error.message}` : "Task update failed."); }
    });
  };
  const openCreate = (title = "", date = currentDate) => { setFormDraft({ ...makeDefaultTaskDraft(date), title, date }); setEditingId(null); setDeleteConfirm(false); setTaskModal("create"); setNewTask(""); };
  const openEdit = (task: Task) => { setFormDraft({ title: task.title, note: task.note, time: task.time, minutes: task.minutes, energy: task.energy, section: task.section, date: task.date }); setEditingId(task.id); setDeleteConfirm(false); setTaskModal("edit"); };
  const saveTask = (draft: TaskDraft) => {
    if (!userId || tasksLoading) { showToast("Sign in to save tasks."); return; }
    const targetId = taskModal === "edit" ? editingId : null;
    void queueTaskMutation(async () => {
      if (userIdRef.current !== userId) return;
      try {
        if (targetId !== null) {
          const updated = await persistTask(userId, targetId, draft);
          if (userIdRef.current === userId) { replaceTasks((items) => items.map((task) => task.id === targetId ? updated : task)); showToast("Task details saved"); }
        } else {
          const created = await insertTask(userId, draft);
          if (userIdRef.current === userId) { replaceTasks((items) => [...items, created]); setActiveId(created.id); showToast("Added to your route"); }
        }
        if (userIdRef.current === userId) { setTaskModal(null); setEditingId(null); setDeleteConfirm(false); }
      } catch (error) { setToast(error instanceof Error ? `Task save failed: ${error.message}` : "Task save failed. Please try again."); }
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
      } catch (error) { setToast(error instanceof Error ? `Task delete failed: ${error.message}` : "Task delete failed. Please try again."); }
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
      } catch (error) { setToast(error instanceof Error ? `Note save failed: ${error.message}` : "Note save failed. Please try again."); }
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
      } catch (error) { setToast(error instanceof Error ? `Note delete failed: ${error.message}` : "Note delete failed. Please try again."); }
    });
  };
  const startFocus = (requestedTask?: Task) => { const task = requestedTask && !requestedTask.done ? requestedTask : tasks.find((item) => !item.done); if (!task) { setFocusSession(null); setFocusOpen(true); return; } setActiveId(task.id); setFocusSession((current) => { const now = Date.now(); if (current?.taskId === task.id && !current.completed) return current.pausedAt !== null ? resumeFocusSession(current, now) : { ...current, isRunning: true, updatedAt: now }; const startAt = localDateTimeTimestamp(task.date, task.time); const endAt = startAt + task.minutes * 60 * 1000; return { sessionId: crypto.randomUUID(), taskId: task.id, durationSeconds: task.minutes * 60, startAt, endAt, pausedAt: null, pausedRemainingSeconds: null, pausedSeconds: 0, isRunning: true, completed: false, updatedAt: now }; }); setFocusOpen(true); };
  const exitFocus = () => { setFocusOpen(false); setFocusSession((current) => current ? pauseFocusSession(current) : null); };
  const completeFocus = async () => { if (!focusSession || focusCompletionRef.current === focusSession.sessionId) return; const completedSession = focusSession; focusCompletionRef.current = completedSession.sessionId; const task = tasksRef.current.find((item) => item.id === completedSession.taskId); let historySaved = Boolean(userId); try { if (userId) await createFocusSession(userId, { sessionId: completedSession.sessionId, taskId: task?.id ?? null, taskTitle: task?.title ?? "Focus session", taskDate: task?.date ?? null, plannedDurationSeconds: completedSession.durationSeconds, startedAt: new Date(completedSession.startAt).toISOString(), completedAt: new Date().toISOString(), pausedSeconds: completedSession.pausedSeconds }); } catch { historySaved = false; } toggleTask(completedSession.taskId); setFocusOpen(false); setFocusSession(null); showToast(historySaved ? "Task completed" : "Task completed, but Focus History could not be saved."); };
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
    onNavigateToday={() => { setView("today"); setActiveId(todayTasks.find((task) => !task.done)?.id ?? todayTasks[0]?.id ?? null); }}
    onNavigateWeek={() => setView("week")}
    onNavigateNotes={() => setView("notes")}
    onNavigateFocusHistory={() => setLocation("/focus-history")}
    onPreferencesClick={() => setPreferencesOpen(true)}
    ariaHidden={focusOpen}
    beforeMobileNav={(tasksLoading || tasksError) && <p role={tasksLoading ? "status" : "alert"}>{tasksLoading ? "Loading your tasks…" : `Tasks could not be loaded: ${tasksError}`}</p>}
    topActions={<div className="top-actions"><button className="icon-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="More options"><MoreHorizontal size={19} /></button>{menuOpen && <div className="pop-menu"><button onClick={() => { setMenuOpen(false); showToast("A blank day is a brave start"); }}>Clear the day</button><button onClick={() => { setMenuOpen(false); showToast("Share link copied"); }}>Share view</button></div>}<button className="focus-button" onClick={() => startFocus(selectedTask)}><Play size={15} fill="currentColor" /> Focus mode</button></div>}
    afterMain={<>
      {focusOpen && <FocusMode task={focusTask} session={focusSession} setSession={setFocusSession} onComplete={completeFocus} onExit={exitFocus} onAddTask={() => { setFocusOpen(false); setFocusSession(null); setView("today"); openCreate(); }} onReturnToday={() => { setFocusOpen(false); setFocusSession(null); setView("today"); }} />}
      {taskModal && <div className="modal-backdrop task-modal-backdrop" onClick={() => setTaskModal(null)}><div className="task-form-modal" role="dialog" aria-modal="true" aria-labelledby="task-form-title" onClick={(event) => event.stopPropagation()}><TaskForm mode={taskModal} initial={formDraft} weekDays={weekDays} onSave={saveTask} onCancel={() => setTaskModal(null)} onRequestDelete={() => setDeleteConfirm(true)} deleteConfirm={deleteConfirm} onConfirmDelete={deleteTask} onCancelDelete={() => setDeleteConfirm(false)} /></div></div>}
      {noteModal && <div className="modal-backdrop task-modal-backdrop" onClick={() => setNoteModal(null)}><div className="task-form-modal note-form-modal" role="dialog" aria-modal="true" aria-labelledby="note-form-title" onClick={(event) => event.stopPropagation()}><NoteForm mode={noteModal} initial={noteDraft} onSave={saveNote} onCancel={() => setNoteModal(null)} onRequestDelete={() => setNoteDeleteConfirm(true)} deleteConfirm={noteDeleteConfirm} onConfirmDelete={deleteNote} onCancelDelete={() => setNoteDeleteConfirm(false)} /></div></div>}
      {toast && <div className="toast" role="status" aria-live="polite"><Check size={16} /> {toast}</div>}
      <PreferencesDialog open={preferencesOpen} onOpenChange={setPreferencesOpen} />
    </>}
  >

          {view === "notes" ? <NotesView notes={notes} search={notesSearch} setSearch={setNotesSearch} selectedNoteId={selectedNoteId} setSelectedNoteId={setSelectedNoteId} openCreate={openNoteCreate} openEdit={openNoteEdit} loading={notesLoading} error={notesError} /> : view === "week" ? <WeeklyView tasks={tasks} selectedDay={selectedWeekDay} setSelectedDay={setSelectedWeekDay} openCreate={openCreate} openEdit={openEdit} setActiveId={(id) => setActiveId(id)} toggleTask={toggleTask} showToast={showToast} weekDays={weekDays} weekLabel={weekLabel} /> : <><section className="hero-row"><div className="hero-copy"><div className="eyebrow accent"><Sparkles size={13} /> MORNING CHECK-IN</div><h1>{visibleIntention}</h1><p className="hero-sub">A little direction goes a long way. What would make today feel well spent?</p><div className="intention-line"><Feather size={15} /><input aria-label="Daily intention" value={visibleIntention} disabled={!userId || intentionLoading} onChange={(event) => { intentionDirty.current = true; intentionEditVersion.current += 1; setIntention(event.target.value); }} /></div></div><div className="day-score"><div className="score-ring" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}><div><strong>{progress}</strong><span>% clear</span></div></div><span className="score-caption">{completed === 0 ? "A clean page" : `${completed} small win${completed === 1 ? "" : "s"}`}<br />already counts.</span></div></section><section className="workspace-grid"><div className="route-column"><div className="section-heading"><div><span className="eyebrow">YOUR ROUTE</span><h2>Shape the day</h2></div><span className="capacity"><Clock3 size={14} /> {formatMinutes(totalMinutes)} left</span></div><div className="add-task"><Plus size={18} /><input value={newTask} onChange={(event) => setNewTask(event.target.value)} onKeyDown={(event) => event.key === "Enter" && openCreate(newTask.trim())} placeholder="What’s taking up space in your head?" /><button onClick={() => openCreate(newTask.trim())}>Add</button></div><div className="task-route">{tasksLoading ? <p role="status">Loading your tasks…</p> : tasksError ? <p role="alert">Could not load your tasks. {tasksError}</p> : grouped.length ? grouped.map((group) => <div className="route-group" key={group.section}><div className="route-label"><span>{group.section}</span><i /></div>{group.tasks.map((task) => <article className={`task-card ${task.id === activeToday?.id ? "selected" : ""} ${task.done ? "completed" : ""}`} key={task.id} onClick={() => setActiveId(task.id)}><button className="check-button" onClick={(event) => { event.stopPropagation(); toggleTask(task.id); }} aria-label={`Mark ${task.title} complete`}>{task.done && <Check size={14} />}</button><div className="task-content"><div className="task-meta"><span>{task.time}</span><span className={`energy-tag ${energyStyles[task.energy]}`}>{task.energy}</span><span>{formatMinutes(task.minutes)}</span></div><h3>{task.title}</h3><p>{task.note}</p></div><div className="task-actions"><button className="task-edit-button" onClick={(event) => { event.stopPropagation(); openEdit(task); }} aria-label={`Edit ${task.title}`}><Pencil size={15} /></button><button className="task-arrow" onClick={(event) => { event.stopPropagation(); startFocus(task); }} aria-label={`Focus on ${task.title}`}><ArrowUpRight size={17} /></button></div></article>)}</div>) : <div className="empty-route"><div className="empty-route-mark"><Plus size={18} /></div><h3>Your route starts here.</h3><p>Capture a thought above, then give it a time and a little shape.</p><button onClick={() => openCreate()}>Shape your first task <ArrowUpRight size={15} /></button></div>}</div><div className="route-footer"><span><Wind size={16} /> Leave 45 minutes unplanned</span><button onClick={() => showToast("Your day has breathing room")}>Why?</button></div></div><aside className="now-column"><div className="now-card"><div className="now-header"><span className="eyebrow accent"><span className="pulse-dot" /> UP NEXT</span><span className="now-time">{activeToday?.time || "—"}</span></div>{activeToday ? <><div className="now-art"><img src="/images/dayweave-morning.webp" alt="Sunlit window and plant" /></div><div className="now-body"><span className="now-kicker">{activeToday.energy.toUpperCase()} ENERGY · {formatMinutes(activeToday.minutes)}</span><h2>{activeToday.title}</h2><p>{activeToday.note}</p><div className="now-actions"><button className="primary-action" onClick={() => startFocus(activeToday)}><Play size={15} fill="currentColor" /> Start focus</button><button className="secondary-action" onClick={() => deferTask(activeToday.id)}><ArrowDownRight size={15} /> Later</button></div></div></> : <div className="empty-now"><Leaf size={28} /><h3>Nothing pressing.</h3><p>You made it to the other side of the list.</p></div>}</div><div className="reflection-card"><div className="reflection-copy"><span className="eyebrow">LATER, MAYBE</span><h3>Close the loop gently.</h3><p>Three minutes to notice what moved.</p><button onClick={() => showToast("Reflection saved for tonight")}>Open reflection <ChevronRight size={15} /></button></div><img src="/images/dayweave-reflection.webp" alt="Warm evening desk" /></div></aside></section></>}
  </DayweaveShell>;
}
