import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSupabaseClient: vi.fn(), builder: {} as Record<string, ReturnType<typeof vi.fn>>, response: { data: null as unknown, error: null as unknown } }));

vi.mock("@/lib/supabase", () => ({ getSupabaseClient: mocks.getSupabaseClient }));

import { fetchDailyIntention, saveDailyIntention } from "@/lib/intentions";

describe("daily intention persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.response = { data: null, error: null };
    for (const method of ["select", "eq", "maybeSingle", "upsert"]) {
      mocks.builder[method] = vi.fn(() => mocks.builder);
    }
    mocks.builder.maybeSingle = vi.fn(() => Promise.resolve(mocks.response));
    mocks.builder.then = vi.fn((resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(mocks.response).then(resolve, reject));
    mocks.getSupabaseClient.mockReturnValue({ from: vi.fn(() => mocks.builder) });
  });

  it("loads only the specified user's intention for the specified local date", async () => {
    mocks.response.data = { intention: "Finish Dayweave" };
    expect(await fetchDailyIntention("user-a", "2026-09-12")).toBe("Finish Dayweave");
    expect(mocks.getSupabaseClient.mock.results[0].value.from).toHaveBeenCalledWith("daily_intentions");
    expect(mocks.builder.eq).toHaveBeenNthCalledWith(1, "user_id", "user-a");
    expect(mocks.builder.eq).toHaveBeenNthCalledWith(2, "date", "2026-09-12");
  });

  it("upserts by the unique user/date key without accepting ownership from the UI", async () => {
    const dateBeforeSave = Date.now();
    await saveDailyIntention("user-a", "2026-09-12", "Learn Supabase");
    const [values, options] = mocks.builder.upsert.mock.calls[0];
    expect(values).toEqual({
      user_id: "user-a",
      date: "2026-09-12",
      intention: "Learn Supabase",
      updated_at: expect.any(String),
    });
    expect(Date.parse(values.updated_at)).toBeGreaterThanOrEqual(dateBeforeSave);
    expect(options).toEqual({ onConflict: "user_id,date" });
  });
});
