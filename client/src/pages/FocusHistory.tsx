import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getFocusSessions, type FocusSessionHistory } from "@/lib/focusSessions";
import DayweaveShell from "@/components/DayweaveShell";
import { PreferencesDialog } from "@/components/PreferencesDialog";
import { useLocation } from "wouter";

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) return `${remainingSeconds} sec`;
  if (remainingSeconds === 0) return `${minutes} min`;
  return `${minutes} min ${remainingSeconds} sec`;
}

function formatCompletedTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatGroupDate(date: Date, today: Date, yesterday: Date): string {
  const dateKey = localDateKey(date);
  if (dateKey === localDateKey(today)) return "Today";
  if (dateKey === localDateKey(yesterday)) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function FocusHistory() {
  const [, setLocation] = useLocation();
  const { userId } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [sessions, setSessions] = useState<FocusSessionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(false);
    setSessions([]);

    if (!userId) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    void getFocusSessions(userId)
      .then((loadedSessions) => {
        if (active) setSessions(loadedSessions);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const groupedSessions = sessions.reduce<Array<{ key: string; label: string; sessions: FocusSessionHistory[] }>>(
    (groups, session) => {
      const completedAt = new Date(session.completedAt);
      const key = localDateKey(completedAt);
      let group = groups.find((item) => item.key === key);
      if (!group) {
        group = { key, label: formatGroupDate(completedAt, today, yesterday), sessions: [] };
        groups.push(group);
      }
      group.sessions.push(session);
      return groups;
    },
    [],
  );
  const completedSessions = sessions.length;
  const totalPlannedSeconds = sessions.reduce((total, session) => total + session.plannedDurationSeconds, 0);
  const totalPausedSeconds = sessions.reduce((total, session) => total + session.pausedSeconds, 0);
  const sidebarDate = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date()).toUpperCase();

  return (
    <DayweaveShell
      activeSection="focus-history"
      sidebarDate={sidebarDate}
      breadcrumbSection="Focus History"
      breadcrumbDetail="Completed sessions"
      mobileNavOpen={mobileNavOpen}
      onToggleMobileNav={() => setMobileNavOpen((open) => !open)}
      onCloseMobileNav={() => setMobileNavOpen(false)}
      onNavigateToday={() => setLocation("/")}
      onNavigateWeek={() => setLocation("/")}
      onNavigateNotes={() => setLocation("/")}
      onNavigateFocusHistory={() => setLocation("/focus-history")}
      onPreferencesClick={() => setPreferencesOpen(true)}
    >
      <section className="notes-hero">
        <div>
          <span className="eyebrow accent">FOCUS HISTORY</span>
          <h1>Focus History</h1>
          <p>A record of the focus sessions you've completed.</p>
        </div>
      </section>

      {!loading && !error && sessions.length > 0 && (
        <section aria-label="Focus history summary" className="mx-auto mt-7 grid max-w-3xl grid-cols-3 divide-x divide-[#dfe3dc] rounded-xl border border-[#e1e3da] bg-[#fffdf7] px-2 py-4 shadow-[2px_3px_0_#e8e4d9] sm:mt-8 sm:px-5 sm:py-5">
          <div className="min-w-0 px-2 sm:px-4">
            <span className="block text-[9px] font-bold uppercase tracking-[.1em] text-[#87918e] sm:text-[10px]">Completed</span>
            <strong className="mt-1 block break-words font-[Fraunces,serif] text-sm font-semibold leading-tight text-[#1d2d35] sm:text-lg">
              {completedSessions} {completedSessions === 1 ? "session" : "sessions"}
            </strong>
          </div>
          <div className="min-w-0 px-2 sm:px-4">
            <span className="block text-[9px] font-bold uppercase tracking-[.1em] text-[#87918e] sm:text-[10px]">Focused</span>
            <strong className="mt-1 block break-words font-[Fraunces,serif] text-sm font-semibold leading-tight text-[#1d2d35] sm:text-lg">
              {formatDuration(totalPlannedSeconds)}
            </strong>
          </div>
          <div className="min-w-0 px-2 sm:px-4">
            <span className="block text-[9px] font-bold uppercase tracking-[.1em] text-[#87918e] sm:text-[10px]">Paused</span>
            <strong className="mt-1 block break-words font-[Fraunces,serif] text-sm font-semibold leading-tight text-[#1d2d35] sm:text-lg">
              {formatDuration(totalPausedSeconds)}
            </strong>
          </div>
        </section>
      )}

      <div className="mx-auto mt-9 max-w-3xl pb-10 sm:mt-11">
        {loading ? (
          <p className="rounded-xl border border-[#dfe3dc] bg-[#fffdf7] px-5 py-6 text-sm text-[#647679] shadow-[2px_3px_0_#e8e4d9]" role="status">Loading...</p>
        ) : error ? (
          <p className="rounded-xl border border-[#e5d8cd] bg-[#fffaf5] px-5 py-6 text-sm text-[#765f54]" role="alert">Unable to load Focus History.</p>
        ) : sessions.length === 0 ? (
          <p className="rounded-xl border border-[#dfe3dc] bg-[#fffdf7] px-5 py-6 text-sm text-[#647679] shadow-[2px_3px_0_#e8e4d9]">No completed focus sessions yet.</p>
        ) : (
          <div className="space-y-8">
            {groupedSessions.map((group) => (
              <section key={group.key} aria-label={group.label}>
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="m-0 shrink-0 font-[Fraunces,serif] text-xl font-semibold tracking-[-.03em] text-[#1d2d35]">{group.label}</h2>
                  <span className="h-px flex-1 bg-[#dfe3dc]" aria-hidden="true" />
                </div>
                <div className="space-y-3">
                  {group.sessions.map((session) => (
                    <article key={session.id} className="rounded-xl border border-[#e1e3da] bg-[#fffdf7] p-4 shadow-[3px_4px_0_#e8e4d9,0_7px_16px_#243b3210] sm:p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <h3 className="m-0 break-words font-[Fraunces,serif] text-lg font-semibold leading-tight tracking-[-.025em] text-[#1d2d35] sm:text-xl">
                            {session.taskTitle}
                          </h3>
                          <p className="mt-2 mb-0 text-xs text-[#7a8882]">
                            Completed at {formatCompletedTime(session.completedAt)}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[#e7eee7] px-3 py-1.5 text-xs font-semibold text-[#53666a]">
                            {formatDuration(session.plannedDurationSeconds)}
                          </span>
                          {session.pausedSeconds > 0 && (
                            <span className="rounded-full bg-[#f5ebce] px-3 py-1.5 text-xs text-[#80672f]">
                              Paused {formatDuration(session.pausedSeconds)}
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
      <PreferencesDialog open={preferencesOpen} onOpenChange={setPreferencesOpen} />
    </DayweaveShell>
  );
}
