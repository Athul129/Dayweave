import { getSupabaseClient } from "@/lib/supabase";

export type Energy = "Deep" | "Light" | "Social";
export type Section = "Morning" | "Midday" | "Afternoon";

export type Task = {
  id: string;
  title: string;
  note: string;
  time: string;
  minutes: number;
  energy: Energy;
  done: boolean;
  section: Section;
  date: string;
};

export type TaskDraft = Omit<Task, "id" | "done">;

/** Database access is always scoped to the current auth user; RLS remains authoritative. */
export async function fetchTasks(userId: string): Promise<Task[]> {
  const { data, error } = await getSupabaseClient()
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: true })
    .order("time", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    title: row.title,
    note: row.note,
    time: row.time,
    minutes: row.minutes,
    energy: row.energy,
    done: row.done,
    section: row.section,
    date: row.date,
  }));
}

export async function createTask(userId: string, draft: TaskDraft): Promise<Task> {
  const { data, error } = await getSupabaseClient()
    .from("tasks")
    .insert({ ...draft, user_id: userId })
    .select("*")
    .single();

  if (error) throw error;
  return {
    id: String(data.id),
    title: data.title,
    note: data.note,
    time: data.time,
    minutes: data.minutes,
    energy: data.energy,
    done: data.done,
    section: data.section,
    date: data.date,
  };
}

export async function updateTask(userId: string, id: string, changes: Partial<TaskDraft> & { done?: boolean }): Promise<Task> {
  const { data, error } = await getSupabaseClient()
    .from("tasks")
    .update(changes)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw error;
  return {
    id: String(data.id),
    title: data.title,
    note: data.note,
    time: data.time,
    minutes: data.minutes,
    energy: data.energy,
    done: data.done,
    section: data.section,
    date: data.date,
  };
}

export async function deleteTask(userId: string, id: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
}
