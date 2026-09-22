import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ProfileDialogProps = { open: boolean; onOpenChange: (open: boolean) => void };

export default function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
  const { user, updateDisplayName } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDisplayName(typeof user?.user_metadata?.display_name === "string" ? user.user_metadata.display_name : "");
      setError("");
    }
  }, [open, user]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed) {
      setError("Enter a display name.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await updateDisplayName(trimmed);
      if (response.error) {
        setError("Unable to save your profile. Please try again.");
        return;
      }
      onOpenChange(false);
    } catch {
      setError("Unable to save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[20px] border-[#e8e4da] bg-[#fbfaf6] p-5 text-[#292d3b] shadow-[0_18px_60px_rgba(30,35,48,0.16)] sm:p-7">
        <DialogHeader className="gap-2 pr-7 text-left">
          <DialogTitle className="text-xl font-semibold tracking-[-0.03em] sm:text-2xl">Edit profile</DialogTitle>
          <DialogDescription className="text-sm leading-6 text-[#77776f]">Keep the name you want Dayweave to use for you.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-[#343632]">
            <span>Display name</span>
            <input className="min-h-11 rounded-lg border border-[#cfd8cf] bg-[#fffdf7] px-3 text-[#283b3e] outline-none focus:border-[#b69342] focus:ring-2 focus:ring-[#c7a85324]" value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" aria-invalid={Boolean(error)} />
          </label>
          <label className="grid gap-2 text-sm font-medium text-[#343632]">
            <span>Email</span>
            <input className="min-h-11 rounded-lg border border-[#e1e3da] bg-[#f1f0ea] px-3 text-[#77776f]" value={user?.email ?? ""} readOnly aria-readonly="true" />
          </label>
          {error && <p className="m-0 text-sm text-[#b86648]" role="alert">{error}</p>}
          <DialogFooter className="mt-2 sm:gap-3">
            <button type="button" className="secondary-action" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</button>
            <button type="submit" className="primary-action" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
