import type { ReactNode } from "react";
import { CalendarDays, ChevronRight, Compass, Inbox, LayoutDashboard, Menu, SunMedium, Timer } from "lucide-react";
import AuthAccountControl from "@/components/AuthAccountControl";

export type DayweaveSection = "today" | "week" | "notes" | "focus-history";

type DayweaveShellProps = {
  activeSection: DayweaveSection;
  sidebarDate: string;
  breadcrumbSection: string;
  breadcrumbDetail: string;
  todayCount?: number;
  notesCount?: number;
  mobileNavOpen: boolean;
  onToggleMobileNav: () => void;
  onCloseMobileNav: () => void;
  onNavigateToday: () => void;
  onNavigateWeek: () => void;
  onNavigateNotes: () => void;
  onNavigateFocusHistory: () => void;
  onPreferencesClick: () => void;
  topActions?: ReactNode;
  beforeMobileNav?: ReactNode;
  children: ReactNode;
  afterMain?: ReactNode;
  ariaHidden?: boolean;
};

export default function DayweaveShell({
  activeSection,
  sidebarDate,
  breadcrumbSection,
  breadcrumbDetail,
  todayCount,
  notesCount,
  mobileNavOpen,
  onToggleMobileNav,
  onCloseMobileNav,
  onNavigateToday,
  onNavigateWeek,
  onNavigateNotes,
  onNavigateFocusHistory,
  onPreferencesClick,
  topActions,
  beforeMobileNav,
  children,
  afterMain,
  ariaHidden,
}: DayweaveShellProps) {
  const navigateFromMobile = (navigate: () => void) => {
    navigate();
    onCloseMobileNav();
  };

  return (
    <div className="app-shell">
      <aside className="side-rail" aria-hidden={ariaHidden ? "true" : undefined}>
        <div className="brand-lockup"><div className="brand-mark"><img src="/images/dayweave-mark.webp" alt="" /></div><span>dayweave</span></div>
        <div className="rail-date"><span className="eyebrow">{sidebarDate}</span><strong>Build a day<br />you can inhabit.</strong></div>
        <nav className="rail-nav" aria-label="Main navigation">
          <button className={`rail-link ${activeSection === "today" ? "active" : ""}`} onClick={onNavigateToday}><LayoutDashboard size={17} /> Today{todayCount !== undefined && <span className="link-count">{todayCount}</span>}</button>
          <button className={`rail-link ${activeSection === "week" ? "active" : ""}`} onClick={onNavigateWeek}><CalendarDays size={17} /> This week</button>
          <button className={`rail-link ${activeSection === "notes" ? "active" : ""}`} onClick={onNavigateNotes}><Inbox size={17} /> Loose notes{notesCount !== undefined && <span className="link-count">{notesCount}</span>}</button>
          <button className={`rail-link ${activeSection === "focus-history" ? "active" : ""}`} onClick={onNavigateFocusHistory}><Timer size={17} /> Focus History</button>
        </nav>
        <div className="rail-bottom">
          <div className="weather-chip"><SunMedium size={19} /><div><span>LIGHT OUTSIDE</span><strong>18° · soft morning</strong></div></div>
          <button className="rail-link subtle" onClick={onPreferencesClick}><Compass size={17} /> Preferences</button>
          <AuthAccountControl section={activeSection} />
        </div>
      </aside>
      <main className="main-canvas" aria-hidden={ariaHidden ? "true" : undefined}>
        <header className="topbar">
          <button className="mobile-menu" onClick={onToggleMobileNav} aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileNavOpen} aria-controls="mobile-navigation"><Menu size={20} /></button>
          <div className="breadcrumb"><span>{breadcrumbSection}</span><ChevronRight size={14} /><strong>{breadcrumbDetail}</strong></div>
          {topActions}
        </header>
        {beforeMobileNav}
        {mobileNavOpen && <nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation">
          <button className={activeSection === "today" ? "active" : ""} onClick={() => navigateFromMobile(onNavigateToday)}><LayoutDashboard size={16} /> Today{todayCount !== undefined && <span>{todayCount}</span>}</button>
          <button className={activeSection === "week" ? "active" : ""} onClick={() => navigateFromMobile(onNavigateWeek)}><CalendarDays size={16} /> This week</button>
          <button className={activeSection === "notes" ? "active" : ""} onClick={() => navigateFromMobile(onNavigateNotes)}><Inbox size={16} /> Loose notes{notesCount !== undefined && <span>{notesCount}</span>}</button>
          <button className={activeSection === "focus-history" ? "active" : ""} onClick={() => navigateFromMobile(onNavigateFocusHistory)}><Timer size={16} /> Focus History</button>
        </nav>}
        {children}
      </main>
      {afterMain}
    </div>
  );
}
