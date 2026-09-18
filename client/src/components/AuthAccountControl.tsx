import { useState } from "react";
import { LogOut, MoreHorizontal, UserRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function AuthAccountControl() {
  const { user, signOut, userId } = useAuth();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
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

  return <div className="auth-account-control" data-user-id={userId ?? undefined}>
    {error && <span className="auth-account-error" role="alert">{error}</span>}
    <div className="profile auth-account-profile">
      <div className="avatar" aria-hidden="true">{initials || <UserRound size={15} />}</div>
      <div className="auth-account-identity"><strong title={email}>{email}</strong><span>Personal space</span></div>
      <button type="button" className="auth-account-options" aria-label="Account options" aria-expanded={open} onClick={() => setOpen((current) => !current)}><MoreHorizontal size={18} /></button>
    </div>
    {open && <div className="auth-account-menu"><span>Signed in</span><button type="button" onClick={logout}><LogOut size={14} /> Sign out</button></div>}
  </div>;
}
