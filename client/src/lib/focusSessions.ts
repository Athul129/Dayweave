import { getSupabaseClient } from "@/lib/supabase";

export type FocusSessionHistory = {
  id: string;
  sessionId: string;
  userId: string;
  taskId: string | null;
  taskTitle: string;
  taskDate: string | null;
  plannedDurationSeconds: number;
  startedAt: string;
  completedAt: string;
  pausedSeconds: number;
  createdAt: string;
};

export type FocusSessionHistoryDraft = Omit<FocusSessionHistory, "id" | "userId" | "createdAt">;

type FocusSessionRow = {
  id: string;
  session_id: string;
  user_id: string;
  task_id: string | null;
  task_title: string;
  task_date: string | null;
  planned_duration_seconds: number;
  started_at: string;
  completed_at: string;
  paused_seconds: number;
  created_at: string;
};

function mapFocusSession(row: FocusSessionRow): FocusSessionHistory {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    userId: String(row.user_id),
    taskId: row.task_id ? String(row.task_id) : null,
    taskTitle: row.task_title,
    taskDate: row.task_date,
    plannedDurationSeconds: row.planned_duration_seconds,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    pausedSeconds: row.paused_seconds,
    createdAt: row.created_at,
  };
}

/** Inserts one completed session; RLS remains authoritative for ownership. */
export async function createFocusSession(userId: string, draft: FocusSessionHistoryDraft): Promise<FocusSessionHistory> {
  const { data, error } = await getSupabaseClient()
    .from("focus_sessions")
    .insert({
      session_id: draft.sessionId,
      user_id: userId,
      task_id: draft.taskId,
      task_title: draft.taskTitle,
      task_date: draft.taskDate,
      planned_duration_seconds: draft.plannedDurationSeconds,
      started_at: draft.startedAt,
      completed_at: draft.completedAt,
      paused_seconds: draft.pausedSeconds,
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapFocusSession(data as FocusSessionRow);
}

export async function getFocusSessions(userId: string): Promise<FocusSessionHistory[]> {
  const { data, error } = await getSupabaseClient()
    .from("focus_sessions")
    .select("id, session_id, user_id, task_id, task_title, task_date, planned_duration_seconds, started_at, completed_at, paused_seconds, created_at")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => mapFocusSession(row as FocusSessionRow));
}
