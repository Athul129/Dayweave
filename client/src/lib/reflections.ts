import { getSupabaseClient } from "@/lib/supabase";

export type DailyReflection = {
  id: string;
  userId: string;
  date: string;
  wentWell: string;
  carryForward: string;
  createdAt: string;
  updatedAt: string;
};

type DailyReflectionRow = {
  id: string;
  user_id: string;
  date: string;
  went_well: string;
  carry_forward: string;
  created_at: string;
  updated_at: string;
};

function mapDailyReflection(row: DailyReflectionRow): DailyReflection {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    date: row.date,
    wentWell: row.went_well,
    carryForward: row.carry_forward,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchDailyReflection(userId: string, date: string): Promise<DailyReflection | null> {
  const { data, error } = await getSupabaseClient()
    .from("daily_reflections")
    .select("*")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();

  if (error) throw error;
  return data ? mapDailyReflection(data as DailyReflectionRow) : null;
}

export async function saveDailyReflection(userId: string, date: string, wentWell: string, carryForward: string): Promise<DailyReflection> {
  const { data, error } = await getSupabaseClient()
    .from("daily_reflections")
    .upsert(
      { user_id: userId, date, went_well: wentWell, carry_forward: carryForward, updated_at: new Date().toISOString() },
      { onConflict: "user_id,date" },
    )
    .select("*")
    .single();

  if (error) throw error;
  return mapDailyReflection(data as DailyReflectionRow);
}
