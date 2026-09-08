import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getPlatformActor, IMPERSONATE_COOKIE } from "@/lib/platform";
import { signOut } from "@/lib/auth";
import { PlatformShell } from "@/components/platform/PlatformShell";

async function platformSignOut() {
  "use server";
  (await cookies()).delete(IMPERSONATE_COOKIE);
  // redirect() relatif — hindari redirectTo Auth.js yang bisa absolut ke localhost:3000 di balik proxy.
  await signOut({ redirect: false });
  redirect("/platform/login");
}

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const actor = await getPlatformActor();
  // The login route renders its own tree; this layout guards everything else.
  if (!actor) redirect("/platform/login");

  return (
    <PlatformShell
      actor={{ name: actor.name, subLevel: actor.subLevel }}
      signOutAction={platformSignOut}
    >
      {children}
    </PlatformShell>
  );
}
