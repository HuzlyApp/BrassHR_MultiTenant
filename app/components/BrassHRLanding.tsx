import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Download,
  LayoutDashboard,
  Search,
  Settings,
  Shield,
  Users,
  UsersRound,
} from "lucide-react";

const navy = "#104b83";
const goldFrom = "#BC8B41";
const goldTo = "#E9B771";
const goldGradient = `linear-gradient(90deg, ${goldFrom} 0%, ${goldTo} 100%)`;
const pageBg = "#f7f5f0";

const navLinkDropdown =
  "flex items-center gap-1 text-[15px] font-medium text-[#104b83] transition hover:text-[#0c3d6b]";
const navLinkPlain = "text-[15px] font-medium text-[#104b83] transition hover:text-[#0c3d6b]";

function LogoMark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-start ${className}`}>
      <span
        className="text-[26px] font-bold tracking-tight lowercase leading-none"
        style={{ color: goldFrom, fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
      >
        brass
      </span>
      <svg className="mt-1 h-[6px] w-[72px]" viewBox="0 0 72 6" fill="none" aria-hidden>
        <path
          d="M0 3C6 0 12 6 18 3C24 0 30 6 36 3C42 0 48 6 54 3C60 0 66 6 72 3"
          stroke={goldFrom}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <span className="mt-1 text-[11px] font-semibold tracking-wide text-[#104b83]">HR simplified</span>
    </div>
  );
}

function GoldBlob({ className }: { className: string }) {
  return (
    <div
      className={`pointer-events-none absolute rounded-full opacity-[0.22] blur-3xl ${className}`}
      style={{
        background: `radial-gradient(circle at 30% 30%, ${goldTo}, ${goldFrom} 45%, transparent 70%)`,
      }}
    />
  );
}

export default function BrassHRLanding() {
  /** Pixel heights for the preview bar chart (Fri tallest). */
  const barHeightsPx = [34, 46, 40, 62, 78, 32, 26];

  return (
    <div className="relative min-h-screen overflow-x-hidden text-[#1e293b]" style={{ backgroundColor: pageBg }}>
      <GoldBlob className="-right-24 top-32 h-[420px] w-[420px]" />
      <GoldBlob className="-left-32 bottom-0 h-[380px] w-[380px]" />
      <GoldBlob className="left-1/3 top-[55%] h-[320px] w-[320px] opacity-[0.14]" />

      <header className="relative z-10 border-b border-black/[0.04] bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-6 px-5 py-4 lg:px-8">
          <Link href="/" className="shrink-0">
            <LogoMark />
          </Link>

          <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary">
            <button type="button" className={navLinkDropdown}>
              Product <ChevronDown className="h-4 w-4 opacity-70" strokeWidth={2} />
            </button>
            <Link href="#features" className={navLinkPlain}>
              Features
            </Link>
            <Link href="#pricing" className={navLinkPlain}>
              Pricing
            </Link>
            <button type="button" className={navLinkDropdown}>
              Resources <ChevronDown className="h-4 w-4 opacity-70" strokeWidth={2} />
            </button>
            <Link href="#about" className={navLinkPlain}>
              About
            </Link>
          </nav>

          <div className="flex shrink-0 items-center gap-4">
            <Link href="/login" className="hidden text-[15px] font-semibold sm:inline" style={{ color: navy }}>
              Login
            </Link>
            <Link
              href="/tenant-onboarding"
              className="rounded-lg px-4 py-2.5 text-[14px] font-semibold text-white shadow-sm transition hover:brightness-105 sm:px-5"
              style={{ backgroundColor: navy }}
            >
              Book a Demo
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid max-w-[1200px] gap-12 px-5 py-12 lg:grid-cols-[1fr_min(480px,42vw)] lg:items-center lg:gap-10 lg:px-8 lg:py-16">
        <section className="max-w-xl">
          <h1 className="text-balance text-4xl font-semibold leading-[1.15] tracking-tight text-[#104b83] sm:text-5xl">
            HR simplified <span className="text-[#0f172a]">for</span>{" "}
            <span style={{ color: goldFrom }}>growing teams</span>
          </h1>
          <p className="mt-5 text-[17px] leading-relaxed text-slate-600">
            Hire, manage, and pay your people with ease. Employee records, scheduling, timekeeping, and payroll-ready
            exports—all in one place.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-[16px] font-semibold text-white shadow-md transition hover:brightness-105"
              style={{ background: goldGradient, boxShadow: "0 12px 28px rgba(188, 139, 65, 0.35)" }}
            >
              Start Free Trial
              <ArrowRight className="h-5 w-5" strokeWidth={2.2} />
            </Link>
            <Link
              href="#features"
              className="inline-flex items-center justify-center rounded-xl border-2 border-[#104b83] bg-white px-7 py-3.5 text-[16px] font-semibold text-[#104b83] transition hover:bg-slate-50"
            >
              See How It Works
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap gap-x-8 gap-y-4 text-[14px] font-medium" style={{ color: goldFrom }}>
            <span className="flex items-center gap-2">
              <Shield className="h-5 w-5 opacity-90" strokeWidth={2} />
              Secure &amp; Compliant
            </span>
            <span className="flex items-center gap-2">
              <Clock className="h-5 w-5 opacity-90" strokeWidth={2} />
              Save Time
            </span>
            <span className="flex items-center gap-2">
              <UsersRound className="h-5 w-5 opacity-90" strokeWidth={2} />
              Built for Teams
            </span>
          </div>

          <p className="mt-10 text-sm text-slate-500">
            Applying for a role?{" "}
            <Link href="/application/step-1-upload" className="font-semibold text-[#104b83] underline-offset-2 hover:underline">
              Start your application
            </Link>
            {" · "}
            <Link href="/tenant-onboarding" className="font-semibold text-[#104b83] underline-offset-2 hover:underline">
              Staffing organization setup
            </Link>
          </p>
        </section>

        <section
          className="relative rounded-2xl border border-slate-200/80 bg-white shadow-[0_28px_80px_rgba(15,40,80,0.12)]"
          aria-label="Product preview"
        >
          <div className="flex min-h-[520px] flex-col overflow-hidden rounded-2xl sm:min-h-[560px]">
            <div className="flex flex-1">
              <aside className="hidden w-[168px] shrink-0 border-r border-slate-100 bg-[#fafafa] py-4 pl-3 pr-2 sm:block">
                <div className="px-2 pb-4">
                  <LogoMark className="scale-90" />
                </div>
                <ul className="space-y-0.5 text-[12px] font-medium text-[#104b83]">
                  {[
                    { icon: LayoutDashboard, label: "Dashboard", active: true },
                    { icon: Users, label: "Employees", active: false },
                    { icon: UsersRound, label: "Hiring", active: false },
                    { icon: Calendar, label: "Schedule", active: false },
                    { icon: Clock, label: "Timekeeping", active: false },
                    { icon: BarChart3, label: "Reports", active: false },
                    { icon: Download, label: "Payroll Exports", active: false },
                    { icon: Settings, label: "Settings", active: false },
                  ].map(({ icon: Icon, label, active }) => (
                    <li key={label}>
                      <span
                        className={`flex items-center gap-2 rounded-lg px-2 py-2 ${
                          active ? "bg-[#104b83] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                        <span className="truncate">{label}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </aside>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      readOnly
                      placeholder="Search employees..."
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-[13px] text-slate-700 outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500"
                    aria-label="Notifications"
                  >
                    <Bell className="h-4 w-4" />
                  </button>
                  <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 sm:flex">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white"
                      style={{ backgroundColor: navy }}
                    >
                      AS
                    </span>
                    <span className="text-[12px] font-semibold text-slate-700">Admin</span>
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </div>
                </div>

                <div className="flex-1 space-y-4 overflow-auto p-4 sm:p-5">
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {[
                      { title: "Total Employees", value: "128", delta: "+8 this month", deltaClass: "text-emerald-600" },
                      { title: "On Leave", value: "12", delta: "-2 this month", deltaClass: "text-amber-600" },
                      { title: "Open Positions", value: "5", link: "View openings →" },
                      { title: "Hours This Week", value: "1,296", delta: "+5% vs last week", deltaClass: "text-emerald-600" },
                    ].map((card) => (
                      <div key={card.title} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{card.title}</p>
                        <p className="mt-1 text-xl font-semibold text-slate-900">{card.value}</p>
                        {"delta" in card && card.delta ? (
                          <p className={`mt-1 text-[11px] font-medium ${card.deltaClass}`}>{card.delta}</p>
                        ) : null}
                        {"link" in card && card.link ? (
                          <button type="button" className="mt-2 text-[11px] font-semibold text-[#104b83] hover:underline">
                            {card.link}
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div id="features" className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm scroll-mt-24">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-[13px] font-semibold text-slate-800">Upcoming Schedule</h3>
                        <button type="button" className="text-[11px] font-semibold text-[#104b83] hover:underline">
                          View full schedule →
                        </button>
                      </div>
                      <ul className="space-y-3 text-[12px]">
                        {[
                          { day: "May 19", time: "8:00 – 4:00", dept: "Customer Support" },
                          { day: "May 20", time: "7:00 – 3:00", dept: "Operations" },
                          { day: "May 21", time: "9:00 – 5:00", dept: "Sales" },
                        ].map((row) => (
                          <li key={row.day} className="flex items-center justify-between gap-2 border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                            <div>
                              <p className="font-semibold text-slate-800">{row.day}</p>
                              <p className="text-slate-500">
                                {row.time} · {row.dept}
                              </p>
                            </div>
                            <div className="flex -space-x-1.5">
                              {[goldFrom, navy, "#94a3b8"].map((c, i) => (
                                <span
                                  key={i}
                                  className="h-7 w-7 rounded-full border-2 border-white"
                                  style={{ backgroundColor: c }}
                                />
                              ))}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                      <div className="mb-3 flex items-baseline justify-between">
                        <h3 className="text-[13px] font-semibold text-slate-800">Timekeeping Overview</h3>
                        <p className="text-[11px] font-medium text-emerald-600">+5%</p>
                      </div>
                      <p className="text-2xl font-semibold text-slate-900">1,296h</p>
                      <p className="text-[11px] text-slate-500">Total hours</p>
                      <div className="mt-4 flex h-[104px] items-end justify-between gap-1.5 border-t border-slate-50 pt-4">
                        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                          <div key={`${d}-${i}`} className="flex flex-1 flex-col items-center gap-1">
                            <div
                              className="w-full max-w-[28px] rounded-t"
                              style={{
                                height: barHeightsPx[i],
                                backgroundColor: i === 4 ? navy : "#e2e8f0",
                              }}
                            />
                            <span className="text-[10px] font-medium text-slate-400">{d}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div id="pricing" className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm scroll-mt-24">
                    <h3 className="mb-3 text-[13px] font-semibold text-slate-800">Recent Payroll Exports</h3>
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                          <Check className="h-5 w-5" strokeWidth={2.5} />
                        </span>
                        <div>
                          <p className="text-[13px] font-semibold text-slate-800">May 16, 2025</p>
                          <p className="text-[12px] text-slate-500">128 employees · CSV Export</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[12px] font-semibold text-[#104b83] shadow-sm hover:bg-slate-50"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer id="about" className="relative z-10 border-t border-black/[0.06] bg-white/60 py-8 text-center text-[13px] text-slate-500 backdrop-blur-sm scroll-mt-20">
        <p>© {new Date().getFullYear()} BrassHR. All rights reserved.</p>
      </footer>
    </div>
  );
}
