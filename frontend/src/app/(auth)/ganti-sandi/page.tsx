import { ForcePasswordChangeForm } from "@/components/auth/ForcePasswordChangeForm";

export const metadata = {
  title: "Ganti Kata Sandi | Print Pilot",
};

export default function GantiSandiPage() {
  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-6 font-sans">
      <ForcePasswordChangeForm />
    </div>
  );
}
