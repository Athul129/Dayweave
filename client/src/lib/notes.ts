import { getSupabaseClient } from "@/lib/supabase";

export type Note = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type NoteDraft = Pick<Note, "title" | "body">;

function mapNote(row: { id: string; title: string; body: string; created_at: string; updated_at: string }): Note {
  return {
    id: String(row.id),
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Reads are scoped to the current auth user; database RLS remains authoritative. */
export async function fetchNotes(userId: string): Promise<Note[]> {
  const { data, error } = await getSupabaseClient()
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapNote);
}

export async function createNote(userId: string, draft: NoteDraft): Promise<Note> {
  const { data, error } = await getSupabaseClient()
    .from("notes")
    .insert({ ...draft, user_id: userId })
    .select("*")
    .single();

  if (error) throw error;
  return mapNote(data);
}

export async function updateNote(userId: string, id: string, changes: NoteDraft): Promise<Note> {
  const { data, error } = await getSupabaseClient()
    .from("notes")
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw error;
  return mapNote(data);
}

export async function deleteNote(userId: string, id: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("notes")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
}
