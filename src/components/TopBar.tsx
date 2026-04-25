"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PikkukirjaLogo } from "@/components/PikkukirjaLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "next-auth/react";
import { KeyRound, LogOut, Shield } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
}

interface TopBarProps {
  email?: string | null;
  name?: string | null;
  isAdmin?: boolean;
  navItems?: NavItem[];
}

function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "PK";
}

export function TopBar({ email, name, isAdmin, navItems = [] }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <header className="h-[50px] px-7 flex items-center gap-3.5 border-b border-border bg-card shrink-0">
      {/* Logo + wordmark */}
      <Link
        href="/"
        className="flex items-center gap-2 shrink-0 text-foreground hover:opacity-80 transition-opacity"
      >
        <PikkukirjaLogo size={22} />
        <span className="font-bold text-sm tracking-tight">Pikkukirja</span>
      </Link>

      {/* Vertical divider — only when nav items exist */}
      {navItems.length > 0 && (
        <div className="w-px h-4 bg-border shrink-0" />
      )}

      {/* Nav items */}
      {navItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(item.href + "/"));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`mx-0.5 my-2.5 px-2.5 rounded-md text-sm transition-colors whitespace-nowrap ${
              isActive
                ? "bg-muted text-foreground font-medium"
                : "text-muted-foreground font-normal hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}

      {/* Spacer */}
      <div className="ml-auto flex items-center gap-2.5">
        <ThemeToggle />

        {email && (
          <span className="font-mono text-xs text-muted-foreground hidden md:block">
            {email}
          </span>
        )}

        {/* Avatar with dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center justify-center rounded-full bg-primary text-primary-foreground font-mono font-bold text-[10px] shrink-0 hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            style={{ width: 27, height: 27 }}
            aria-label="Käyttäjävalikko"
          >
            {getInitials(name, email)}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {isAdmin && (
              <>
                <DropdownMenuItem
                  className="flex items-center gap-2 cursor-pointer"
                  onClick={() => router.push("/admin/users")}
                >
                  <Shield className="h-3.5 w-3.5" />
                  Käyttäjät
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => router.push("/profile")}
            >
              <KeyRound className="h-3.5 w-3.5" />
              Vaihda salasana
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className="flex items-center gap-2 cursor-pointer"
              onClick={async () => {
                await signOut({ redirect: false });
                window.location.href = "/login";
              }}
            >
              <LogOut className="h-3.5 w-3.5" />
              Kirjaudu ulos
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
