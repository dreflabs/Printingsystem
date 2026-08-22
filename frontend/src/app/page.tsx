import { redirect } from "next/navigation";

export default function HomePage() {
  // Redirect pengguna yang baru datang langsung ke halaman login
  redirect("/login");
}
