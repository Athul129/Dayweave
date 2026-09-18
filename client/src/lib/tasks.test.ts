import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSupabaseClient: vi.fn(), builder: {} as Record<string, ReturnType<typeof vi.fn>>, response: { data: null as unknown, error: null as unknown } }));

vi.mock("@/lib/supabase", () => ({ getSupabaseClient: mocks.getSupabaseClient }));

import { createTask, deleteTask, fetchTasks, updateTask } from "@/lib/tasks";

const taskRow = {
  id: "8ae885ef-0f70-41ad-9c1d-3d8f2c28fd53",
  user_id: "user-123",
  title: "Write the brief",
  note: "First draft",
  time: "09:15",
  minutes: 45,
  energy: "Deep",
  done: false,
  section: "Morning",
  date: "2030-01-15",
};

describe("task persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.response = { data: null, error: null };
    for (const method of ["select", "eq", "order", "insert", "update", "delete", "single"]) {
      mocks.builder[method] = vi.fn(() => mocks.builder);
    }
    mocks.builder.then = vi.fn((resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(mocks.response).then(resolve, reject));
    mocks.builder.single = vi.fn(() => Promise.resolve(mocks.response));
    mocks.getSupabaseClient.mockReturnValue({ from: vi.fn(() => mocks.builder) });
  });

  it("loads only the authenticated user's rows and maps database UUIDs", async () => {
    mocks.response.data = [taskRow];
    const tasks = await fetchTasks("user-123");

    expect(mocks.getSupabaseClient.mock.results[0].value.from).toHaveBeenCalledWith("tasks");
    expect(mocks.builder.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(tasks).toEqual([{ id: taskRow.id, title: taskRow.title, note: taskRow.note, time: taskRow.time, minutes: 45, energy: "Deep", done: false, section: "Morning", date: "2030-01-15" }]);
  });

  it("inserts the authenticated owner and uses the returned database row", async () => {
    mocks.response.data = taskRow;
    const { id: _id, user_id: _userId, done: _done, ...draft } = taskRow;
    const created = await createTask("user-123", draft);

    expect(mocks.builder.insert).toHaveBeenCalledWith({ ...draft, user_id: "user-123" });
    expect(created.id).toBe(taskRow.id);
  });

  it("updates and deletes only the selected task for the authenticated owner", async () => {
    mocks.response.data = { ...taskRow, done: true };
    const updated = await updateTask("user-123", taskRow.id, { done: true });
    expect(mocks.builder.update).toHaveBeenCalledWith({ done: true });
    expect(mocks.builder.eq).toHaveBeenNthCalledWith(1, "id", taskRow.id);
    expect(mocks.builder.eq).toHaveBeenNthCalledWith(2, "user_id", "user-123");
    expect(updated.done).toBe(true);

    await deleteTask("user-123", taskRow.id);
    expect(mocks.builder.delete).toHaveBeenCalled();
    expect(mocks.builder.eq).toHaveBeenNthCalledWith(3, "id", taskRow.id);
    expect(mocks.builder.eq).toHaveBeenNthCalledWith(4, "user_id", "user-123");
  });
});
