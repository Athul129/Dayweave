import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSupabaseClient: vi.fn(), builder: {} as Record<string, ReturnType<typeof vi.fn>>, response: { data: null as unknown, error: null as unknown } }));

vi.mock("@/lib/supabase", () => ({ getSupabaseClient: mocks.getSupabaseClient }));

import { createNote, deleteNote, fetchNotes, updateNote } from "@/lib/notes";

const noteRow = {
  id: "ba69913b-3427-4403-9788-c86ce2f9b55c",
  user_id: "user-123",
  title: "Field note",
  body: "A small observation.",
  created_at: "2030-01-15T09:00:00.000Z",
  updated_at: "2030-01-15T09:00:00.000Z",
};

describe("note persistence", () => {
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

  it("loads only the authenticated user's notes and maps database fields", async () => {
    mocks.response.data = [noteRow];
    expect(await fetchNotes("user-123")).toEqual([{
      id: noteRow.id,
      title: noteRow.title,
      body: noteRow.body,
      createdAt: noteRow.created_at,
      updatedAt: noteRow.updated_at,
    }]);
    expect(mocks.getSupabaseClient.mock.results[0].value.from).toHaveBeenCalledWith("notes");
    expect(mocks.builder.eq).toHaveBeenCalledWith("user_id", "user-123");
  });

  it("creates a note for the authenticated user and uses its returned UUID", async () => {
    mocks.response.data = noteRow;
    const created = await createNote("user-123", { title: noteRow.title, body: noteRow.body });
    expect(mocks.builder.insert).toHaveBeenCalledWith({ title: noteRow.title, body: noteRow.body, user_id: "user-123" });
    expect(created.id).toBe(noteRow.id);
  });

  it("updates and deletes only the selected note for the authenticated user", async () => {
    mocks.response.data = { ...noteRow, title: "Updated note", updated_at: "2030-01-16T09:00:00.000Z" };
    const updated = await updateNote("user-123", noteRow.id, { title: "Updated note", body: noteRow.body });
    expect(mocks.builder.update).toHaveBeenCalledWith(expect.objectContaining({ title: "Updated note", body: noteRow.body, updated_at: expect.any(String) }));
    expect(mocks.builder.eq).toHaveBeenNthCalledWith(1, "id", noteRow.id);
    expect(mocks.builder.eq).toHaveBeenNthCalledWith(2, "user_id", "user-123");
    expect(updated.title).toBe("Updated note");

    await deleteNote("user-123", noteRow.id);
    expect(mocks.builder.delete).toHaveBeenCalled();
    expect(mocks.builder.eq).toHaveBeenNthCalledWith(3, "id", noteRow.id);
    expect(mocks.builder.eq).toHaveBeenNthCalledWith(4, "user_id", "user-123");
  });
});
