"use client";

import { useState, useRef, useEffect } from "react";
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

function NavDropdown({
  group,
  pathname,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const items = group.items || [];
  const isActive = items.some((item) => pathname === item.href);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
          isActive
            ? "border-[#d97706] text-[#1a365d]"
            : "border-transparent text-[#64748b] hover:border-[#cbd5e1] hover:text-[#1e293b]"
        }`}
      >
        {group.label}
        <svg
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-px min-w-[180px] border border-[#e2e8f0] bg-white shadow-md">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => { setOpen(false); onNavigate?.(); }}
              className={`block px-4 py-2.5 text-sm transition-colors ${
                pathname === item.href
                  ? "bg-[#f8fafc] font-medium text-[#1a365d] border-l-2 border-[#d97706]"
                  : "text-[#64748b] hover:bg-[#f8fafc] hover:text-[#1e293b]"
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

function MobileNavGroup({
  group,
  pathname,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  onNavigate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const items = group.items || [];
  const isActive = group.href
    ? pathname === group.href
    : items.some((item) => pathname === item.href);

  if (group.href) {
    return (
      <Link
        href={group.href}
        onClick={onNavigate}
        className={`block px-4 py-3 text-sm font-medium border-l-2 ${
          isActive
            ? "border-[#d97706] text-[#1a365d] bg-[#f8fafc]"
            : "border-transparent text-[#64748b] hover:text-[#1e293b] hover:bg-[#f8fafc]"
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
        className={`flex w-full items-center justify-between px-4 py-3 text-sm font-medium border-l-2 ${
          isActive
            ? "border-[#d97706] text-[#1a365d] bg-[#f8fafc]"
            : "border-transparent text-[#64748b] hover:text-[#1e293b] hover:bg-[#f8fafc]"
        }`}
      >
        {group.label}
        <svg
          className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="bg-[#f8fafc]">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`block pl-8 pr-4 py-2.5 text-sm ${
                pathname === item.href
                  ? "font-medium text-[#1a365d] border-l-2 border-[#d97706] ml-2"
                  : "text-[#64748b] hover:text-[#1e293b]"
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const bgClass = darkMode ? "bg-[#0f2440]" : "bg-[#f8fafc]";
  const navBgClass = darkMode ? "bg-[#1a365d] border-[#234681]" : "bg-white border-[#e2e8f0]";

  return (
    <div className={`min-h-screen ${bgClass}`}>
      {/* Header */}
      <div className="bg-[#1a365d]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden text-white p-1"
              aria-label="Toggle menu"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="square" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="square" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            <h1 className="text-lg font-bold tracking-tight text-white">{portalName}</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline text-sm text-slate-300">
              {user.displayName}
              <span
                className="ml-2 border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide"
                style={{ borderColor: badgeColor, backgroundColor: `${badgeColor}1a`, color: badgeColor }}
              >
                {roleBadge}
              </span>
            </span>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm text-slate-300 transition-colors hover:text-white"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Desktop nav */}
      <nav className={`hidden lg:block border-b ${navBgClass}`}>
        <div className="mx-auto flex max-w-7xl items-center gap-1 px-4 overflow-x-auto">
          {navGroups.map((group) =>
            group.href ? (
              <Link
                key={group.label}
                href={group.href}
                className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                  pathname === group.href
                    ? "border-[#d97706] text-[#1a365d]"
                    : "border-transparent text-[#64748b] hover:border-[#cbd5e1] hover:text-[#1e293b]"
                }`}
              >
                {group.label}
              </Link>
            ) : (
              <NavDropdown
                key={group.label}
                group={group}
                pathname={pathname}
              />
            )
          )}
        </div>
      </nav>

      {/* Mobile nav */}
      {mobileMenuOpen && (
        <nav className={`lg:hidden border-b shadow-lg ${navBgClass}`}>
          <div className="max-h-[70vh] overflow-y-auto py-2">
            {navGroups.map((group) => (
              <MobileNavGroup
                key={group.label}
                group={group}
                pathname={pathname}
                onNavigate={() => setMobileMenuOpen(false)}
              />
            ))}
          </div>
        </nav>
      )}

      <main className="mx-auto max-w-7xl px-4 py-8">
        {children}
      </main>
    </div>
  );
}
