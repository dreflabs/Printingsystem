import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { ShieldCheck, LogOut } from "lucide-react";
import { getPlatformActor, IMPERSONATE_COOKIE } from "@/lib/platform";
import { signOut } from "@/lib/auth";

const NAV = [
  { href: "/platform", label: "Dashboard" },
  { href: "/platform/admins", label: "Akun Admin" },
  { href: "/platform/activity", label: "Aktivitas" },
];

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const actor = await getPlatformActor();
  // The login route renders its own tree; this layout guards everything else.
  if (!actor) redirect("/platform/login");

  return (
    <div className="min-h-screen bg-base text-primary">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-5">
            <Link href="/platform" className="flex items-center gap-2 font-bold">
              <ShieldCheck className="h-5 w-5 text-accent-teal" />
              Print Pilot <span className="text-muted font-normal">/ Platform</span>
            </Link>
            {actor.mfaEnabled && (
              <nav className="hidden sm:flex items-center gap-4 text-sm">
                {NAV.map((n) => (
                  <Link key={n.href} href={n.href} className="text-muted hover:text-primary">
                    {n.label}
                  </Link>
                ))}
              </nav>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted">{actor.name}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-teal/10 text-accent-teal border border-accent-teal/30">
              {actor.subLevel}
            </span>
            <form
              action={async () => {
                "use server";
                (await cookies()).delete(IMPERSONATE_COOKIE);
                await signOut({ redirectTo: "/platform/login" });
              }}
            >
              <button className="flex items-center gap-1.5 text-muted hover:text-primary">
                <LogOut className="h-4 w-4" /> Keluar
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-6">{children}</main>
    </div>
  );
}
