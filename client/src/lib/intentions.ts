import { getSupabaseClient } from "@/lib/supabase";

/** Returns null when this user has not set an intention for the requested local date. */
export async function fetchDailyIntention(userId: string, date: string): Promise<string | null> {
  const { data, error } = await getSupabaseClient()
    .from("daily_intentions")
    .select("intention")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();

  if (error) throw error;
  return data?.intention ?? null;
}

/** The unique (user_id, date) constraint makes this safe to call for both first saves and edits. */
export async function saveDailyIntention(userId: string, date: string, intention: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("daily_intentions")
    .upsert(
      { user_id: userId, date, intention, updated_at: new Date().toISOString() },
      { onConflict: "user_id,date" },
    );

  if (error) throw error;
}
