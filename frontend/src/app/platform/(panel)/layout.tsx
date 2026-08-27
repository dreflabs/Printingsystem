import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, LogOut } from "lucide-react";
import { getPlatformActor } from "@/lib/platform";
import { signOut } from "@/lib/auth";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const actor = await getPlatformActor();
  // The login route renders its own tree; this layout guards everything else.
  if (!actor) redirect("/platform/login");

  return (
    <div className="min-h-screen bg-base text-primary">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-14">
          <Link href="/platform" className="flex items-center gap-2 font-bold">
            <ShieldCheck className="h-5 w-5 text-accent-teal" />
            Print Pilot <span className="text-muted font-normal">/ Platform</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted">{actor.name}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-teal/10 text-accent-teal border border-accent-teal/30">
              {actor.subLevel}
            </span>
            <form
              action={async () => {
                "use server";
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
