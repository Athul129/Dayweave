import { useEffect, useRef, useState } from "react";
import { LogOut, MoreHorizontal, UserRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function AuthAccountControl({ section }: { section?: string }) {
  const { user, signOut, userId } = useAuth();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const controlRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setOpen(false); }, [section]);
  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!controlRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnScroll = () => setOpen(false);
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    window.addEventListener("scroll", closeOnScroll, { passive: true });
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      window.removeEventListener("scroll", closeOnScroll);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!user) return null;
  const email = user.email?.trim() ?? "";
  const emailName = email.split("@")[0] ?? "";
  const nameParts = emailName.split(/[._+-]+/).filter(Boolean);
  const initials = nameParts.length > 1
    ? nameParts.slice(0, 2).map((part) => part[0]).join("").toUpperCase()
    : emailName.slice(0, 2).toUpperCase();

  const logout = async () => {
    setError("");
    const result = await signOut();
    if (result.error) setError(result.error.message);
  };

  return <div ref={controlRef} className="auth-account-control" data-user-id={userId ?? undefined}>
    {error && <span className="auth-account-error" role="alert">{error}</span>}
    <div className="profile auth-account-profile">
      <div className="avatar" aria-hidden="true">{initials || <UserRound size={15} />}</div>
      <div className="auth-account-identity"><strong title={email}>{email}</strong><span>Personal space</span></div>
      <button type="button" className="auth-account-options" aria-label="Account options" aria-expanded={open} onClick={() => setOpen((current) => !current)}><MoreHorizontal size={18} /></button>
    </div>
    {open && <div className="auth-account-menu"><span>Signed in</span><span className="auth-account-menu-email">{email}</span><button type="button" onClick={logout}><LogOut size={14} /> Sign out</button></div>}
  </div>;
}
