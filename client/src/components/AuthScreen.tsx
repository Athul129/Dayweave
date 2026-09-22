import { FormEvent, useState } from "react";
import { ArrowUpRight, Check, Eye, EyeOff, Leaf, LoaderCircle, Mail, LockKeyhole } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const friendlyAuthError = (message: string) => {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "That email and password combination is not recognised.";
  if (normalized.includes("email not confirmed")) return "Confirm your email from the link we sent before signing in.";
  if (normalized.includes("user already registered")) return "An account already exists for this email. Try signing in instead.";
  if (normalized.includes("password should be at least")) return "Use a password with at least six characters.";
  return "Something went wrong. Please try again.";
};

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setConfirmationSent(false);
    setSubmitting(true);

    try {
      const trimmedEmail = email.trim();
      const trimmedDisplayName = displayName.trim();
      if (mode === "signup" && !trimmedDisplayName) {
        setError("Enter a display name to create your account.");
        return;
      }
      if (mode === "signup" && password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      const response = mode === "login" ? await signIn(trimmedEmail, password) : await signUp(trimmedEmail, password, trimmedDisplayName);
      if (response.error) {
        setError(friendlyAuthError(response.error.message));
      } else if (mode === "signup" && !response.data.session) {
        setConfirmationSent(true);
      }
    } catch (caught) {
      setError(caught instanceof Error ? friendlyAuthError(caught.message) : "Authentication could not be completed.");
    } finally {
      setSubmitting(false);
    }
  };

  return <main className="auth-shell">
    <section className="auth-card" aria-labelledby="auth-title">
      <div className="auth-brand"><div className="auth-brand-mark"><img src="/images/dayweave-mark.webp" alt="" /></div><strong>dayweave</strong></div>
      <div className="auth-intro"><span className="eyebrow accent"><Leaf size={13} /> MAKE ROOM</span><h1 id="auth-title">A quieter place<br />to begin.</h1><p>{mode === "login" ? "Your daily route is waiting when you are ready." : "Make an account to keep your daily route close."}</p></div>
      {confirmationSent ? <div className="auth-confirmation" role="status" aria-live="polite"><div className="auth-confirmation-mark"><Check size={19} /></div><h2>Check your inbox.</h2><p>We sent a confirmation link to <strong>{email}</strong>. Follow it, then return here to sign in.</p><button type="button" className="secondary-action auth-wide-action" onClick={() => { setConfirmationSent(false); setMode("login"); }}>Back to sign in</button></div> : <form className="auth-form" onSubmit={submit} noValidate>
        <label className="auth-field"><span>Email</span><div className="auth-input-wrap"><Mail size={16} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder="you@example.com" /></div></label>
        {mode === "signup" && <label className="auth-field"><span>Display name</span><div className="auth-input-wrap"><input type="text" value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" required placeholder="How should we call you?" /></div></label>}
        <label className="auth-field"><span>Password</span><div className="auth-input-wrap"><LockKeyhole size={16} /><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={6} required placeholder="At least 6 characters" /><button type="button" className="auth-password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
        {mode === "signup" && <label className="auth-field"><span>Confirm password</span><div className="auth-input-wrap"><LockKeyhole size={16} /><input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={6} required placeholder="Enter your password again" /><button type="button" className="auth-password-toggle" onClick={() => setShowConfirmPassword((visible) => !visible)} aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}>{showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="primary-action auth-submit" type="submit" disabled={submitting}>{submitting ? <LoaderCircle size={16} className="auth-spinner" /> : <ArrowUpRight size={16} />} {submitting ? "Making space..." : mode === "login" ? "Sign in" : "Create account"}</button>
      </form>}
      {!confirmationSent && <p className="auth-switch">{mode === "login" ? "New here?" : "Already have an account?"} <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}> {mode === "login" ? "Create an account" : "Sign in"}</button></p>}
    </section>
    <aside className="auth-aside"><span className="eyebrow">A LITTLE DIRECTION</span><blockquote>“Make room for one thing that matters.”</blockquote><p>Dayweave keeps the day spacious, so your attention can land somewhere real.</p></aside>
  </main>;
}
