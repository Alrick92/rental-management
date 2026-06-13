"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

interface NavItem {
  label: string;
  href: string;
}

interface NavGroup {
  label: string;
  href?: string;
  items?: NavItem[];
}

interface PortalShellProps {
  portalName: string;
  roleBadge: string;
  badgeColor?: string;
  navGroups: NavGroup[];
  user: {
    displayName: string;
    email: string;
    role: string;
  };
  darkMode?: boolean;
  children?: React.ReactNode;
}

function SidebarGroup({
  group,
  pathname,
  darkMode,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  darkMode: boolean;
  onNavigate?: () => void;
}) {
  const items = group.items || [];
  const isActive = group.href
    ? pathname === group.href
    : items.some((item) => pathname === item.href);
  const [expanded, setExpanded] = useState(isActive);

  const textBase = darkMode ? "text-slate-400" : "text-[#64748b]";
  const textActive = darkMode ? "text-white" : "text-[#1a365d]";
  const textHover = darkMode ? "hover:text-white" : "hover:text-[#1e293b]";
  const bgHover = darkMode ? "hover:bg-[#1a365d]" : "hover:bg-[#f1f5f9]";
  const bgActive = darkMode ? "bg-[#1a365d]" : "bg-[#f1f5f9]";
  const subBg = darkMode ? "bg-[#0a1929]" : "bg-[#f8fafc]";

  if (group.href) {
    return (
      <Link
        href={group.href}
        onClick={onNavigate}
        className={`flex items-center px-4 py-2.5 text-sm font-medium transition-colors ${bgHover} ${
          pathname === group.href
            ? `${bgActive} ${textActive} border-l-3 border-[#d97706]`
            : `${textBase} ${textHover} border-l-3 border-transparent`
        }`}
      >
        {group.label}
      </Link>
    );
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors ${bgHover} ${
          isActive
            ? `${textActive} border-l-3 border-[#d97706]`
            : `${textBase} ${textHover} border-l-3 border-transparent`
        }`}
      >
        <span>{group.label}</span>
        <svg
          className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className={subBg}>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`block py-2 pl-8 pr-4 text-sm transition-colors ${bgHover} ${
                pathname === item.href
                  ? `font-medium ${textActive} border-l-2 border-[#d97706] ml-2`
                  : `${textBase} ${textHover}`
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function PortalShell({
  portalName,
  roleBadge,
  badgeColor = "#d97706",
  navGroups,
  user,
  darkMode = false,
  children,
}: PortalShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const sidebarBg = darkMode ? "bg-[#0f2440]" : "bg-white";
  const sidebarBorder = darkMode ? "border-[#234681]" : "border-[#e2e8f0]";
  const contentBg = darkMode ? "bg-[#162d50]" : "bg-[#f8fafc]";

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar — desktop (always visible) */}
      <aside
        className={`hidden lg:flex lg:flex-col lg:w-60 border-r ${sidebarBorder} ${sidebarBg} flex-shrink-0`}
      >
        {/* Portal header */}
        <div className="flex items-center px-4 py-4 border-b border-inherit">
          <h1 className={`text-sm font-bold uppercase tracking-wide ${darkMode ? "text-white" : "text-[#1a365d]"}`}>
            {portalName}
          </h1>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          {navGroups.map((group) => (
            <SidebarGroup
              key={group.label}
              group={group}
              pathname={pathname}
              darkMode={darkMode}
            />
          ))}
        </nav>

        {/* User section */}
        <div className={`border-t ${sidebarBorder} px-4 py-3`}>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-medium truncate ${darkMode ? "text-white" : "text-[#1e293b]"}`}>
                {user.displayName}
              </p>
              <span
                className="inline-block mt-0.5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide border"
                style={{ borderColor: badgeColor, backgroundColor: `${badgeColor}1a`, color: badgeColor }}
              >
                {roleBadge}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className={`text-xs ${darkMode ? "text-slate-400 hover:text-white" : "text-[#64748b] hover:text-[#1e293b]"} transition-colors`}
              title="Sign out"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="square" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className={`relative w-64 h-full flex flex-col ${sidebarBg} shadow-xl`}>
            {/* Portal header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-inherit">
              <h1 className={`text-sm font-bold uppercase tracking-wide ${darkMode ? "text-white" : "text-[#1a365d]"}`}>
                {portalName}
              </h1>
              <button
                onClick={() => setSidebarOpen(false)}
                className={`p-1 ${darkMode ? "text-slate-400" : "text-[#64748b]"}`}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="square" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto py-2">
              {navGroups.map((group) => (
                <SidebarGroup
                  key={group.label}
                  group={group}
                  pathname={pathname}
                  darkMode={darkMode}
                  onNavigate={() => setSidebarOpen(false)}
                />
              ))}
            </nav>

            {/* User section */}
            <div className={`border-t ${sidebarBorder} px-4 py-3`}>
              <p className={`text-xs font-medium truncate ${darkMode ? "text-white" : "text-[#1e293b]"}`}>
                {user.displayName}
              </p>
              <button
                onClick={handleLogout}
                className={`mt-2 text-xs ${darkMode ? "text-slate-400 hover:text-white" : "text-[#64748b] hover:text-[#1e293b]"} transition-colors`}
              >
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main content area */}
      <div className={`flex-1 flex flex-col min-w-0 ${contentBg}`}>
        {/* Top bar (mobile only — shows hamburger) */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-[#e2e8f0] bg-[#1a365d]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-white p-1"
            aria-label="Open menu"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="square" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-sm font-bold uppercase tracking-wide text-white">{portalName}</h1>
          <span
            className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide border"
            style={{ borderColor: badgeColor, backgroundColor: `${badgeColor}1a`, color: badgeColor }}
          >
            {roleBadge}
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
