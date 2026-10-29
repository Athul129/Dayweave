import { useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarDays, ChevronRight, Cloud, CloudDrizzle, CloudRain, CloudSun, Compass, Inbox, LayoutDashboard, Menu, Moon, Sun, SunMedium, Timer, Umbrella } from "lucide-react";
import { useWeather } from "@/hooks/useWeather";
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
  const weather = useWeather();
  const mobileNavRef = useRef<HTMLElement | null>(null);
  const [mobileNavHasMoreRight, setMobileNavHasMoreRight] = useState(false);

  useEffect(() => {
    if (!mobileNavOpen) {
      setMobileNavHasMoreRight(false);
      return;
    }

    const nav = mobileNavRef.current;
    if (!nav) return;

    const updateOverflow = () => {
      const hasMoreRight = nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1;
      setMobileNavHasMoreRight((current) => current === hasMoreRight ? current : hasMoreRight);
    };

    updateOverflow();
    nav.addEventListener("scroll", updateOverflow, { passive: true });
    window.addEventListener("resize", updateOverflow);
    return () => {
      nav.removeEventListener("scroll", updateOverflow);
      window.removeEventListener("resize", updateOverflow);
    };
  }, [activeSection, mobileNavOpen, notesCount, todayCount]);

  const navigateFromMobile = (navigate: () => void) => {
    navigate();
    onCloseMobileNav();
  };

  const weatherView = (() => {
    if (weather.status === "loading") return { label: "WEATHER", text: "Finding the sky...", icon: SunMedium };
    if (!weather.data) return { label: "WEATHER UNAVAILABLE", text: "Location not available", icon: Cloud };
    const { code, isDay, temperature } = weather.data;
    const temp = `${Math.round(temperature)}°`;
    if (code === 0) return { label: isDay ? "CLEAR OUTSIDE" : "CLEAR TONIGHT", text: `${temp} · ${isDay ? "bright and calm" : "clear skies"}`, icon: isDay ? Sun : Moon };
    if ([1, 2, 3].includes(code)) return { label: "PARTLY CLOUDY", text: `${temp} · changing skies`, icon: CloudSun };
    if ([45, 48].includes(code)) return { label: "MISTY OUTSIDE", text: `${temp} · misty`, icon: Cloud };
    if ([51, 53, 55, 56, 57].includes(code)) return { label: "LIGHT DRIZZLE", text: `${temp} · light drizzle`, icon: CloudDrizzle };
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: "RAINING OUTSIDE", text: `${temp} · rain nearby`, icon: CloudRain };
    if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: "SNOWING OUTSIDE", text: `${temp} · snow nearby`, icon: Umbrella };
    if ([95, 96, 99].includes(code)) return { label: "STORMY OUTSIDE", text: `${temp} · unsettled skies`, icon: CloudRain };
    return { label: "WEATHER", text: `${temp} · changing skies`, icon: Cloud };
  })();
  const WeatherIcon = weatherView.icon;

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
          <div className="weather-chip" aria-live="polite"><WeatherIcon size={19} aria-hidden="true" /><div><span>{weatherView.label}</span><strong>{weatherView.text}</strong></div></div>
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
        {mobileNavOpen && <div className={`mobile-nav-wrap ${mobileNavHasMoreRight ? "has-more-right" : ""}`}>
          <nav ref={mobileNavRef} id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation">
          <button className={activeSection === "today" ? "active" : ""} onClick={() => navigateFromMobile(onNavigateToday)}><LayoutDashboard size={16} /> Today{todayCount !== undefined && <span>{todayCount}</span>}</button>
          <button className={activeSection === "week" ? "active" : ""} onClick={() => navigateFromMobile(onNavigateWeek)}><CalendarDays size={16} /> This week</button>
          <button className={activeSection === "notes" ? "active" : ""} onClick={() => navigateFromMobile(onNavigateNotes)}><Inbox size={16} /> Loose notes{notesCount !== undefined && <span>{notesCount}</span>}</button>
          <button className={activeSection === "focus-history" ? "active" : ""} onClick={() => navigateFromMobile(onNavigateFocusHistory)}><Timer size={16} /> Focus History</button>
          <button onClick={() => navigateFromMobile(onPreferencesClick)}><Compass size={16} /> Preferences</button>
          </nav>
        </div>}
        <div className="mobile-weather-chip" aria-live="polite"><WeatherIcon size={18} aria-hidden="true" /><div><span>{weatherView.label}</span><strong>{weatherView.text}</strong></div></div>
        {children}
      </main>
      {afterMain}
    </div>
  );
}
