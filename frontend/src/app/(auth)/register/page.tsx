"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  Mail,
  Phone,
  ShieldCheck,
  User,
  Users,
  ArrowLeft,
  Loader2,
  Lock,
  Clock3,
  GraduationCap,
  Minus,
  Plus,
  ShoppingCart,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getSignupPricingConfig, registerTenant, validateSignupVoucher } from "@/actions/register";
import {
  computeOrderEstimate,
  DEFAULT_PRICING_CONFIG,
  resolveSelfServePlan,
  SAAS_PLANS,
  SELF_SERVE_PLAN_KEYS,
  SERVICE_OPTIONS,
  SUBSCRIPTION_TERMS,
  type PricingConfig,
  type SelfServePlanKey,
  type ServiceKey,
  type TermMonths,
} from "@/lib/saas-catalog";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function InputField({ label, icon: Icon, ...props }: any) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-muted">{label}</label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
          <Icon className="h-4 w-4" />
        </div>
        <input
          {...props}
          className="w-full bg-base border border-border rounded-xl h-11 pl-10 pr-4 text-sm text-primary placeholder:text-muted/50 focus:border-accent-teal focus:ring-1 focus:ring-accent-teal outline-none transition-all"
        />
      </div>
    </div>
  );
}

const STEPS = [
  { s: 1, title: "Akun Owner", desc: "Informasi login Anda" },
  { s: 2, title: "Profil Percetakan", desc: "Data, subdomain & ukuran tim" },
  { s: 3, title: "Pilih Paket", desc: "Sesuaikan dengan skala bisnis" },
  { s: 4, title: "Durasi & Kapasitas", desc: "Lama langganan & kursi tambahan" },
  { s: 5, title: "Layanan & Ringkasan", desc: "Training dan rincian biaya" },
  { s: 6, title: "Selesai", desc: "Masuk dashboard" },
];

type TeamSize = "solo" | "small" | "full";

const TEAM_SIZE_OPTIONS: { value: TeamSize; label: string; hint: string; icon: typeof User }[] = [
  { value: "solo", label: "Saya sendiri", hint: "1 orang — semua tahap dikerjakan sendiri", icon: User },
  { value: "small", label: "Tim kecil", hint: "2–5 orang, tugas kadang tumpang tindih", icon: Users },
  { value: "full", label: "Tim per divisi", hint: "6+ orang, tiap bagian ada penanggung jawabnya", icon: Building2 },
];

/** Perkiraan kebutuhan kursi minimum dari jawaban ukuran tim (ambil batas bawah rentang). */
const REQUIRED_USERS: Record<TeamSize, number> = { solo: 1, small: 2, full: 6 };

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;
const rupiahShort = (n: number) => `Rp${Math.round(n / 1000).toLocaleString("id-ID")}rb`;

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-base" />}>
      <RegisterWizard />
    </Suspense>
  );
}

function RegisterWizard() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownerUsername, setOwnerUsername] = useState("");
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [invoice, setInvoice] = useState<{ number: string | null; amount: number | null; dueDate: string | null } | null>(null);

  const [plan, setPlan] = useState<SelfServePlanKey>(() => resolveSelfServePlan(searchParams.get("plan")));
  const [months, setMonths] = useState<TermMonths>(1);
  const [addonSeats, setAddonSeats] = useState(0);
  const [services, setServices] = useState<ServiceKey[]>([]);
  const [voucherInput, setVoucherInput] = useState("");
  const [voucher, setVoucher] = useState<{ code: string; label: string; discountAmount: number } | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [checkingVoucher, setCheckingVoucher] = useState(false);
  // Harga & parameter komersial dari pengaturan platform (fallback ke default
  // katalog sampai data tiba) supaya angka di wizard = angka yang ditagih.
  const [remote, setRemote] = useState<{
    pricing: PricingConfig;
    planOverrides: Record<string, { price_monthly: number; max_users: number | null; max_orders_per_month: number | null }>;
  } | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    passwordConfirm: "",
    shopName: "",
    subdomain: "",
    address: "",
    teamSize: "solo" as TeamSize,
    consentAccepted: false,
  });

  useEffect(() => {
    let alive = true;
    getSignupPricingConfig().then((r) => {
      if (alive && r.success) setRemote(r.data);
    });
    return () => { alive = false; };
  }, []);

  const pricing = remote?.pricing ?? DEFAULT_PRICING_CONFIG;
  const planOverrides = remote?.planOverrides ?? {};

  /** Definisi paket dengan harga & kuota dari DB (fallback ke katalog). */
  const planView = (key: SelfServePlanKey) => {
    const def = SAAS_PLANS[key];
    const ov = planOverrides[def.slug];
    return {
      ...def,
      price_monthly: ov?.price_monthly ?? def.price_monthly,
      max_users: ov?.max_users ?? def.max_users,
      max_orders_per_month: ov?.max_orders_per_month ?? def.max_orders_per_month,
    };
  };

  /** Termin dengan bulan-dibayar dari pengaturan platform. */
  const termView = (t: (typeof SUBSCRIPTION_TERMS)[number]) => ({
    ...t,
    paidMonths: pricing.terms.find((x) => x.months === t.months)?.paidMonths ?? t.paidMonths,
  });

  /** Layanan dengan harga & flag promo dari pengaturan platform. */
  const serviceView = (s: (typeof SERVICE_OPTIONS)[number]) => {
    const cfg = pricing.services.find((x) => x.key === s.key);
    return {
      ...s,
      listPrice: cfg?.listPrice ?? s.listPrice,
      promoFree: cfg?.promoFree ?? s.promoFree,
    };
  };

  const planDef = planView(plan);
  const estimate = useMemo(
    () =>
      computeOrderEstimate({
        plan,
        months,
        addonSeats,
        services,
        pricing,
        planPriceMonthly: planDef.price_monthly,
      }),
    [plan, months, addonSeats, services, pricing, planDef.price_monthly],
  );

  // Diskon voucher dihitung terhadap komposisi pesanan saat itu — begitu
  // paket/durasi/kapasitas/layanan berubah, voucher perlu diverifikasi ulang.
  const resetVoucher = () => {
    setVoucher(null);
    setVoucherError(null);
  };

  const discount = voucher?.discountAmount ?? 0;
  const payable = Math.max(0, estimate.total - discount);

  // Validasi silang ukuran tim vs kuota paket: jawaban langkah 2 dipakai untuk
  // menyarankan paket minimum dan mengingatkan bila kursi kurang.
  const requiredUsers = REQUIRED_USERS[formData.teamSize];
  const recommendedPlanKey = SELF_SERVE_PLAN_KEYS.find((k) => planView(k).max_users >= requiredUsers) ?? null;
  const planCapacity = planDef.max_users + addonSeats;
  const capacityShort = planCapacity < requiredUsers;
  const suggestedAddonSeats = Math.min(pricing.maxSeats, Math.max(0, requiredUsers - planDef.max_users));

  const checkVoucher = async () => {
    setCheckingVoucher(true);
    setVoucherError(null);
    const res = await validateSignupVoucher({
      code: voucherInput,
      plan,
      months,
      addonSeats,
      services,
    });
    setCheckingVoucher(false);
    if (!res.success) {
      setVoucher(null);
      setVoucherError(res.error);
      return;
    }
    setVoucher(res.data);
  };

  const pw = formData.password;
  const pwHasLen = pw.length >= 12;
  const pwHasMix = /[a-zA-Z]/.test(pw) && /[0-9]/.test(pw);
  const pwStrong = pwHasLen && pwHasMix;
  const pwMatch = pw.length > 0 && pw === formData.passwordConfirm;

  const step1Valid = !!formData.name && !!formData.email && pwStrong && pwMatch;
  const step2Valid = !!formData.shopName && formData.subdomain.length >= 3 && formData.consentAccepted;

  const autoGenerateSubdomain = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

  const toggleService = (key: ServiceKey) => {
    resetVoucher();
    setServices((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const handleNext = () => {
    setError(null);
    if (step === 1 && !step1Valid) return;
    if (step === 2 && !step2Valid) return;
    if (step === 5) {
      void submitRegistration();
      return;
    }
    setStep((s) => Math.min(s + 1, 6));
  };

  const handleBack = () => setStep((s) => Math.max(s - 1, 1));

  const mobileStep = Math.min(step, STEPS.length - 1);
  const mobileStepLabel = step >= STEPS.length ? "Selesai" : STEPS[step - 1].title;

  const submitRegistration = async () => {
    setIsLoading(true);
    setError(null);
    const res = await registerTenant({
      ownerName: formData.name,
      email: formData.email,
      phone: formData.phone || undefined,
      password: formData.password,
      shopName: formData.shopName,
      subdomain: formData.subdomain,
      address: formData.address || undefined,
      plan,
      teamSize: formData.teamSize,
      consentAccepted: formData.consentAccepted,
      months,
      addonSeats,
      services,
      voucherCode: voucher?.code,
    });
    if (!res.success) {
      setIsLoading(false);
      setError(res.error);
      return;
    }
    setOwnerUsername(res.data.ownerUsername);
    setVerificationRequired(res.data.verificationRequired);
    setInvoice({ number: res.data.invoiceNumber, amount: res.data.invoiceAmount, dueDate: res.data.invoiceDueDate });
    setFormData((f) => ({ ...f, subdomain: res.data.slug }));
    if (!res.data.verificationRequired) {
      await signIn("credentials", {
        redirect: false,
        workspace: res.data.slug,
        username: res.data.ownerUsername,
        password: formData.password,
      });
    }
    setIsLoading(false);
    setStep(6);
  };

  return (
    <div className="min-h-screen bg-base flex flex-col font-sans">
      <header className="h-20 border-b border-border/50 flex items-center px-6 sm:px-8">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Image src="/PRINT_PILOT_LOGO.png" alt="Print Pilot Logo" width={32} height={32} priority className="h-8 w-8 object-contain" />
          <span className="font-bold text-xl text-primary tracking-tight whitespace-nowrap">
            Print Pilot<span className="text-accent-teal">.id</span>
          </span>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent-teal/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-status-blue/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="w-full max-w-5xl flex flex-col md:flex-row gap-12 relative z-10">
          {/* Kolom Kiri: Progress */}
          <div className="md:w-1/3 space-y-8">
            <div className="mb-10">
              <h1 className="text-3xl font-bold text-primary mb-2">Buat Workspace.</h1>
              <span className="inline-block mb-3 px-2.5 py-1 rounded-full bg-accent-teal/10 text-accent-teal text-xs font-bold">
                Paket {planDef.name} — {rupiahShort(planDef.price_monthly)}/bln
              </span>
              <p className="text-muted text-sm">
                Siapkan workspace percetakan Anda dalam {STEPS.length - 1} langkah utama.
                <br />
                Tanpa kartu kredit, bisa batal kapan saja.
              </p>
            </div>

            <div className="space-y-6 relative before:absolute before:left-4 before:-translate-x-1/2 before:top-4 before:bottom-4 before:w-0.5 before:bg-border before:-z-10 hidden md:block">
              {STEPS.map((item) => (
                <div key={item.s} className="flex gap-4 items-start">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold border-2 transition-all duration-500",
                      step > item.s
                        ? "bg-accent-teal border-accent-teal text-white"
                        : step === item.s
                        ? "bg-base border-accent-teal text-accent-teal"
                        : "bg-base border-border text-muted"
                    )}
                  >
                    {step > item.s ? <CheckCircle2 className="h-4 w-4" /> : item.s}
                  </div>
                  <div>
                    <h3 className={cn("text-sm font-bold", step >= item.s ? "text-primary" : "text-muted")}>
                      {item.title}
                    </h3>
                    <p className="text-xs text-muted mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Kolom Kanan: Wizard */}
          <div className="md:w-2/3">
            <div className="md:hidden mb-4 rounded-2xl border border-border bg-card/80 px-4 py-3">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-bold text-primary">Langkah {mobileStep} dari 5</span>
                <span className="truncate text-muted">{mobileStepLabel}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-accent-teal transition-all duration-500"
                  style={{ width: `${(mobileStep / 5) * 100}%` }}
                />
              </div>
            </div>
            <div className="bg-card/80 backdrop-blur-xl border border-border p-8 rounded-3xl shadow-2xl relative overflow-hidden min-h-[480px] flex flex-col">
              {error && (
                <div className="mb-5 rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-2.5 text-xs font-semibold text-status-red">
                  {error}
                </div>
              )}

              {/* STEP 1: AKUN OWNER */}
              {step === 1 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500 flex-1 flex flex-col">
                  <div className="mb-8">
                    <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                      <User className="h-5 w-5 text-accent-teal" /> 1. Buat Akun Owner
                    </h2>
                    <p className="text-xs text-muted mt-1">
                      Akun ini menjadi pemilik (Owner) dengan akses penuh ke percetakan.
                    </p>
                  </div>

                  <div className="space-y-5 flex-1">
                    <InputField
                      label="Nama Lengkap"
                      icon={User}
                      autoComplete="name"
                      placeholder="Budi Santoso"
                      value={formData.name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                    <InputField
                      label="Alamat Email"
                      icon={Mail}
                      type="email"
                      autoComplete="email"
                      placeholder="budi@contoh.com"
                      value={formData.email}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                    />
                    <InputField
                      label="No. WhatsApp (opsional)"
                      icon={Phone}
                      type="tel"
                      autoComplete="tel"
                      placeholder="0812…"
                      value={formData.phone}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <InputField
                        label="Kata Sandi"
                        icon={Lock}
                        type="password"
                        autoComplete="new-password"
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                      />
                      <InputField
                        label="Ulangi Kata Sandi"
                        icon={Lock}
                        type="password"
                        autoComplete="new-password"
                        placeholder="••••••••"
                        value={formData.passwordConfirm}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setFormData({ ...formData, passwordConfirm: e.target.value })
                        }
                      />
                    </div>

                    {formData.password.length > 0 && (
                      <ul className="text-[11px] space-y-1 -mt-1">
                        <li className={cn("flex items-center gap-1.5", pwHasLen ? "text-status-green" : "text-muted")}>
                          <CheckCircle2 className="h-3 w-3" /> Minimal 12 karakter
                        </li>
                        <li className={cn("flex items-center gap-1.5", pwHasMix ? "text-status-green" : "text-muted")}>
                          <CheckCircle2 className="h-3 w-3" /> Mengandung huruf dan angka
                        </li>
                        <li
                          className={cn(
                            "flex items-center gap-1.5",
                            formData.passwordConfirm.length === 0
                              ? "text-muted"
                              : pwMatch
                              ? "text-status-green"
                              : "text-status-red"
                          )}
                        >
                          <CheckCircle2 className="h-3 w-3" /> Kedua kata sandi cocok
                        </li>
                      </ul>
                    )}
                  </div>

                  <div className="mt-8 flex items-center justify-between">
                    <p className="text-xs text-muted">
                      Sudah punya akun?{" "}
                      <Link href="/login" className="text-accent-teal hover:underline font-bold">
                        Masuk di sini
                      </Link>
                    </p>
                    <button
                      onClick={handleNext}
                      disabled={isLoading || !step1Valid}
                      className="h-11 px-6 rounded-xl bg-accent-teal text-white font-bold flex items-center gap-2 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      Lanjutkan <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: PROFIL PERCETAKAN */}
              {step === 2 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500 flex-1 flex flex-col">
                  <button
                    onClick={handleBack}
                    className="text-muted hover:text-primary mb-4 flex items-center gap-1 text-xs font-semibold w-fit"
                  >
                    <ArrowLeft className="h-3 w-3" /> Kembali
                  </button>
                  <div className="mb-8">
                    <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-accent-teal" /> 2. Identitas Percetakan
                    </h2>
                    <p className="text-xs text-muted mt-1">Buat workspace khusus untuk toko Anda.</p>
                  </div>

                  <div className="space-y-5 flex-1">
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-muted">Nama Percetakan</label>
                      <input
                        placeholder="Contoh: Maju Jaya Print"
                        value={formData.shopName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            shopName: e.target.value,
                            subdomain: autoGenerateSubdomain(e.target.value),
                          })
                        }
                        className="w-full bg-base border border-border rounded-xl h-11 px-4 text-sm text-primary placeholder:text-muted/50 focus:border-accent-teal outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-muted">Alamat Subdomain</label>
                      <div className="flex bg-base border border-border rounded-xl overflow-hidden focus-within:border-accent-teal transition-all">
                        <span className="flex items-center justify-center px-4 bg-elevated border-r border-border text-muted text-xs sm:text-sm font-mono shrink-0">
                          https://
                        </span>
                        <input
                          value={formData.subdomain}
                          onChange={(e) =>
                            setFormData({ ...formData, subdomain: autoGenerateSubdomain(e.target.value) })
                          }
                          className="w-full bg-transparent h-11 px-3 text-sm text-accent-teal font-bold font-mono outline-none"
                        />
                        <span className="flex items-center justify-center px-4 bg-elevated border-l border-border text-muted text-xs sm:text-sm font-mono shrink-0">
                          .printpilot.id
                        </span>
                      </div>
                      <p className="text-[10px] text-muted">
                        URL tempat Anda dan karyawan login. Huruf kecil &amp; angka, 3–30 karakter.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-muted">Kota / Alamat (opsional)</label>
                      <textarea
                        rows={2}
                        placeholder="Jl. Raya Cetak No. 12, Jakarta"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full bg-base border border-border rounded-xl p-3 text-sm text-primary placeholder:text-muted/50 focus:border-accent-teal outline-none transition-all resize-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-muted">Anda menjalankan sendiri atau dengan tim?</label>

                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { team: false, label: "Saya sendiri", icon: User },
                          { team: true, label: "Dengan tim", icon: Users },
                        ].map((opt) => {
                          const selected = (formData.teamSize !== "solo") === opt.team;
                          return (
                            <button
                              key={opt.label}
                              type="button"
                              onClick={() =>
                                setFormData({ ...formData, teamSize: opt.team ? (formData.teamSize === "solo" ? "small" : formData.teamSize) : "solo" })
                              }
                              className={cn(
                                "flex items-center gap-2 rounded-xl border p-3 text-left transition-all",
                                selected ? "border-accent-teal bg-accent-teal/5" : "border-border hover:border-accent-teal/40"
                              )}
                            >
                              <opt.icon className={cn("h-4 w-4 shrink-0", selected ? "text-accent-teal" : "text-muted")} />
                              <span className={cn("text-sm font-bold", selected ? "text-primary" : "text-muted")}>{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {formData.teamSize !== "solo" && (
                        <div className="grid gap-2">
                          {TEAM_SIZE_OPTIONS.filter((o) => o.value !== "solo").map((opt) => {
                            const selected = formData.teamSize === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setFormData({ ...formData, teamSize: opt.value })}
                                className={cn(
                                  "flex items-start gap-3 rounded-xl border p-3 text-left transition-all",
                                  selected
                                    ? "border-accent-teal bg-accent-teal/5"
                                    : "border-border hover:border-accent-teal/40"
                                )}
                              >
                                <span
                                  className={cn(
                                    "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                                    selected ? "bg-accent-teal/15 text-accent-teal" : "bg-elevated text-muted"
                                  )}
                                >
                                  <opt.icon className="h-4 w-4" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className={cn("block text-sm font-bold", selected ? "text-primary" : "text-muted")}>
                                    {opt.label}
                                  </span>
                                  <span className="block text-[11px] text-muted mt-0.5 leading-relaxed">{opt.hint}</span>
                                </span>
                                <span
                                  className={cn(
                                    "mt-1 h-4 w-4 shrink-0 rounded-full border-2 transition-all",
                                    selected ? "border-accent-teal bg-accent-teal" : "border-muted/40"
                                  )}
                                />
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <p className="text-[10px] text-muted">
                        Menentukan tampilan awal (menu &amp; beranda) dan default kebijakan alur kerja untuk akun Owner.
                        Izin tetap berbasis role. Bisa diubah kapan saja di <b>Pengaturan Toko</b>.
                      </p>
                    </div>
                  </div>

                  <label className="mt-6 flex items-start gap-2.5 text-xs text-muted cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formData.consentAccepted}
                      onChange={(e) => setFormData({ ...formData, consentAccepted: e.target.checked })}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-accent-teal cursor-pointer"
                    />
                    <span>
                      Saya menyetujui{" "}
                      <Link href="/syarat-ketentuan" target="_blank" className="text-accent-teal hover:underline font-semibold">
                        Syarat &amp; Ketentuan
                      </Link>{" "}
                      dan{" "}
                      <Link href="/kebijakan-privasi" target="_blank" className="text-accent-teal hover:underline font-semibold">
                        Kebijakan Privasi
                      </Link>{" "}
                      Print Pilot.
                    </span>
                  </label>

                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={handleNext}
                      disabled={!step2Valid}
                      className="h-11 px-8 rounded-xl bg-accent-teal text-white font-bold flex items-center gap-2 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      Lanjutkan <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: PILIH PAKET */}
              {step === 3 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500 flex-1 flex flex-col">
                  <button
                    onClick={handleBack}
                    className="text-muted hover:text-primary mb-4 flex items-center gap-1 text-xs font-semibold w-fit"
                  >
                    <ArrowLeft className="h-3 w-3" /> Kembali
                  </button>
                  <div className="mb-6">
                    <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5 text-accent-teal" /> 3. Pilih Paket Langganan
                    </h2>
                    <p className="text-xs text-muted mt-1">
                      Pilih paket, durasi, dan layanan. Invoice pertama terbit otomatis dengan jatuh tempo 3 hari.
                    </p>
                  </div>

                  <div className="grid gap-3 flex-1">
                    {SELF_SERVE_PLAN_KEYS.map((key) => {
                      const def = planView(key);
                      const selected = plan === key;
                      const popular = key === "pro";
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            resetVoucher();
                            setPlan(key);
                          }}
                          className={cn(
                            "rounded-2xl border p-4 text-left transition-all",
                            selected ? "border-accent-teal bg-accent-teal/5" : "border-border hover:border-accent-teal/40"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-primary flex items-center gap-2">
                                {def.name}
                                {popular && (
                                  <span className="rounded-full bg-accent-teal px-2 py-0.5 text-[9px] font-bold text-white">
                                    PALING POPULER
                                  </span>
                                )}
                                {key === recommendedPlanKey && (
                                  <span className="rounded-full bg-status-green/15 px-2 py-0.5 text-[9px] font-bold text-status-green">
                                    CUKUP UNTUK TIM ANDA
                                  </span>
                                )}
                              </p>
                              <p className="text-[11px] text-muted mt-0.5">{def.tagline}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-lg font-extrabold text-primary">{rupiahShort(def.price_monthly)}</p>
                              <p className="text-[10px] text-muted">/bulan</p>
                            </div>
                          </div>
                          <ul className="mt-3 grid sm:grid-cols-2 gap-x-4 gap-y-1">
                            {def.highlights.slice(0, 4).map((h) => (
                              <li key={h} className="flex items-start gap-1.5 text-[11px] text-muted">
                                <CheckCircle2 className="h-3 w-3 text-accent-teal shrink-0 mt-0.5" /> {h}
                              </li>
                            ))}
                          </ul>
                          <p className="mt-3 text-[10px] text-muted">
                            {def.max_users} user{def.max_orders_per_month ? ` · ${def.max_orders_per_month} order/bulan` : " · order tanpa batas"}
                          </p>
                          {def.max_users < requiredUsers && (
                            <p className="mt-1.5 text-[10px] font-semibold text-status-yellow-text">
                              Kuota {def.max_users} user — tim Anda sekitar {requiredUsers}+ orang. Tambah kursi di langkah
                              berikutnya atau pilih paket lebih besar.
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={handleNext}
                      className="h-11 px-8 rounded-xl bg-accent-teal text-white font-bold flex items-center gap-2 hover:brightness-110 transition-all"
                    >
                      Lanjutkan <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: DURASI & KAPASITAS */}
              {step === 4 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500 flex-1 flex flex-col">
                  <button
                    onClick={handleBack}
                    className="text-muted hover:text-primary mb-4 flex items-center gap-1 text-xs font-semibold w-fit"
                  >
                    <ArrowLeft className="h-3 w-3" /> Kembali
                  </button>
                  <div className="mb-6">
                    <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                      <Clock3 className="h-5 w-5 text-accent-teal" /> 4. Durasi &amp; Kapasitas
                    </h2>
                    <p className="text-xs text-muted mt-1">
                      Makin lama durasinya, makin tenang operasionalnya. 12 bulan bayar 10.
                    </p>
                  </div>

                  <div className="space-y-5 flex-1">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                      {SUBSCRIPTION_TERMS.map((t0) => {
                        const t = termView(t0);
                        const selected = months === t.months;
                        const perMonth = (planDef.price_monthly * t.paidMonths) / t.months;
                        return (
                          <button
                            key={t.months}
                            type="button"
                            onClick={() => {
                              resetVoucher();
                              setMonths(t.months);
                            }}
                            className={cn(
                              "rounded-xl border p-3 text-left transition-all relative",
                              selected ? "border-accent-teal bg-accent-teal/5" : "border-border hover:border-accent-teal/40"
                            )}
                          >
                            {t.badge && (
                              <span className="absolute -top-2 right-2 rounded-full bg-status-yellow px-2 py-0.5 text-[8px] font-bold text-status-yellow-text">
                                {t.badge}
                              </span>
                            )}
                            <p className="text-sm font-bold text-primary">{t.label}</p>
                            <p className="text-[10px] text-muted mt-0.5 leading-snug">{t.description}</p>
                            <p className="mt-2 text-xs font-bold text-accent-teal">≈ {rupiahShort(perMonth)}/bln</p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="rounded-xl border border-border p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-bold text-primary flex items-center gap-2">
                            <UserPlus className="h-4 w-4 text-accent-teal" /> Kursi user tambahan
                          </p>
                          <p className="text-[11px] text-muted mt-0.5">
                            Paket {planDef.name} sudah termasuk {planDef.max_users} user. Tambahan{" "}
                            {rupiah(pricing.seatPriceMonthly)}/user/bulan.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              resetVoucher();
                              setAddonSeats((n) => Math.max(0, n - 1));
                            }}
                            className="h-8 w-8 rounded-lg border border-border flex items-center justify-center text-muted hover:border-accent-teal hover:text-accent-teal transition-all"
                            aria-label="Kurangi kursi"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-8 text-center text-sm font-bold text-primary">{addonSeats}</span>
                          <button
                            type="button"
                            onClick={() => {
                              resetVoucher();
                              setAddonSeats((n) => Math.min(pricing.maxSeats, n + 1));
                            }}
                            className="h-8 w-8 rounded-lg border border-border flex items-center justify-center text-muted hover:border-accent-teal hover:text-accent-teal transition-all"
                            aria-label="Tambah kursi"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      {addonSeats > 0 && (
                        <p className="mt-3 text-[11px] font-semibold text-accent-teal">
                          Total kapasitas {planDef.max_users + addonSeats} user ·{" "}
                          {rupiah(addonSeats * pricing.seatPriceMonthly * estimate.paidMonths)} per {estimate.paidMonths} bulan
                        </p>
                      )}
                      {planDef.max_users < requiredUsers && (
                        <div className="mt-3 rounded-lg border border-status-yellow/40 bg-status-yellow/10 p-2.5 space-y-2">
                          <p className="text-[11px] font-semibold text-status-yellow-text">
                            Tim Anda sekitar {requiredUsers}+ orang, sedangkan paket ini {planDef.max_users} kursi.
                            Tambah minimal {suggestedAddonSeats} kursi supaya semua orang bisa login.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              resetVoucher();
                              setAddonSeats(suggestedAddonSeats);
                            }}
                            className="h-8 px-3 rounded-lg bg-status-yellow text-white text-[11px] font-bold hover:brightness-110"
                          >
                            Tambah {suggestedAddonSeats} kursi otomatis
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={handleNext}
                      className="h-11 px-8 rounded-xl bg-accent-teal text-white font-bold flex items-center gap-2 hover:brightness-110 transition-all"
                    >
                      Lanjutkan <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 5: LAYANAN & RINGKASAN */}
              {step === 5 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500 flex-1 flex flex-col">
                  <button
                    onClick={handleBack}
                    className="text-muted hover:text-primary mb-4 flex items-center gap-1 text-xs font-semibold w-fit"
                  >
                    <ArrowLeft className="h-3 w-3" /> Kembali
                  </button>
                  <div className="mb-6">
                    <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                      <GraduationCap className="h-5 w-5 text-accent-teal" /> 5. Layanan &amp; Ringkasan
                    </h2>
                    <p className="text-xs text-muted mt-1">
                      Layanan tambahan gratis selama masa promo Print Pilot.
                    </p>
                  </div>

                  <div className="space-y-4 flex-1">
                    <div className="grid sm:grid-cols-2 gap-3">
                      {SERVICE_OPTIONS.map((s0) => {
                        const s = serviceView(s0);
                        const selected = services.includes(s.key);
                        const free = pricing.servicePromoActive && s.promoFree;
                        return (
                          <button
                            key={s.key}
                            type="button"
                            onClick={() => toggleService(s.key)}
                            className={cn(
                              "rounded-xl border p-4 text-left transition-all",
                              selected ? "border-accent-teal bg-accent-teal/5" : "border-border hover:border-accent-teal/40"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-bold text-primary">{s.name}</p>
                              {free && (
                                <span className="shrink-0 rounded-full bg-status-green/15 px-2 py-0.5 text-[9px] font-bold text-status-green">
                                  GRATIS
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted mt-1 leading-relaxed">{s.description}</p>
                            <p className="mt-2 text-xs">
                              {free ? (
                                <>
                                  <span className="text-muted line-through">{rupiah(s.listPrice)}</span>{" "}
                                  <span className="font-bold text-status-green">Rp 0 (promo)</span>
                                </>
                              ) : (
                                <span className="font-bold text-primary">{rupiah(s.listPrice)}</span>
                              )}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="rounded-xl border border-border bg-elevated p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Kode Voucher</p>
                      <div className="flex gap-2">
                        <input
                          value={voucherInput}
                          onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
                          placeholder="Masukkan kode voucher"
                          className="flex-1 bg-base border border-border rounded-lg h-10 px-3 text-sm text-primary font-mono placeholder:text-muted/50 focus:border-accent-teal outline-none transition-all"
                        />
                        <button
                          type="button"
                          onClick={checkVoucher}
                          disabled={checkingVoucher || !voucherInput.trim()}
                          className="h-10 px-4 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          {checkingVoucher ? "Memeriksa…" : "Gunakan"}
                        </button>
                      </div>
                      {voucherError && <p className="mt-2 text-[11px] font-semibold text-status-red">{voucherError}</p>}
                      {voucher && (
                        <p className="mt-2 text-[11px] font-semibold text-status-green">
                          Voucher {voucher.code} aktif — potongan {voucher.label} ({rupiah(voucher.discountAmount)}).
                        </p>
                      )}
                    </div>

                    <div className="rounded-xl border border-border bg-elevated p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Ringkasan Pesanan</p>
                      <div className="space-y-2">
                        {estimate.lines.map((line) => (
                          <div key={line.label} className="flex items-start justify-between gap-3 text-xs">
                            <div className="min-w-0">
                              <p className="font-semibold text-primary">{line.label}</p>
                              {line.detail && <p className="text-[10px] text-muted">{line.detail}</p>}
                            </div>
                            <div className="text-right shrink-0">
                              {line.free && <p className="text-[10px] text-muted line-through">{rupiah(line.unitPrice)}</p>}
                              <p className={cn("font-bold", line.free ? "text-status-green" : "text-primary")}>
                                {line.free ? "Gratis" : rupiah(line.amount)}
                              </p>
                            </div>
                          </div>
                        ))}
                        {estimate.serviceListTotal > 0 && estimate.serviceSubtotal === 0 && (
                          <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
                            <span className="text-muted">Hemat dari promo layanan</span>
                            <span className="font-bold text-status-green">- {rupiah(estimate.serviceListTotal)}</span>
                          </div>
                        )}
                        {discount > 0 && (
                          <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
                            <span className="text-muted">Diskon voucher {voucher?.code}</span>
                            <span className="font-bold text-status-green">- {rupiah(discount)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-2 border-t border-border">
                          <span className="text-sm font-bold text-primary">Total tagihan pertama</span>
                          <span className="text-lg font-extrabold text-primary">{rupiah(payable)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] pt-2 border-t border-border">
                          <span className="text-muted">Kapasitas user</span>
                          <span className={capacityShort ? "font-bold text-status-red" : "font-bold text-primary"}>
                            {planCapacity} kursi · tim {requiredUsers}+ orang
                          </span>
                        </div>
                        {capacityShort && (
                          <p className="text-[10px] font-semibold text-status-red">
                            Kursi kurang {requiredUsers - planCapacity}. Kembali ke langkah Durasi &amp; Kapasitas untuk
                            menambah kursi, atau pilih paket lebih besar.
                          </p>
                        )}
                      </div>
                      <p className="mt-3 text-[10px] text-muted leading-relaxed">
                        Invoice pertama diterbitkan otomatis dengan jatuh tempo 3 hari. Akses aplikasi dibuka penuh
                        setelah pembayaran diverifikasi tim Print Pilot.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={handleNext}
                      disabled={isLoading}
                      className="h-11 px-8 rounded-xl bg-status-green text-white font-bold flex items-center gap-2 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buat Workspace"}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 6: SELESAI */}
              {step === 6 && (
                <div className="animate-in zoom-in duration-500 flex-1 flex flex-col items-center justify-center text-center pb-6">
                  <div className="w-20 h-20 bg-status-green/10 rounded-full flex items-center justify-center mb-6 relative">
                    <div className="absolute inset-0 bg-status-green/20 rounded-full animate-ping opacity-50" />
                    <CheckCircle2 className="h-10 w-10 text-status-green" />
                  </div>
                  <h2 className="text-2xl font-bold text-primary mb-2">
                    {verificationRequired ? "Cek Email untuk Mengaktifkan Workspace" : "Workspace Berhasil Dibuat!"}
                  </h2>
                  <p className="text-muted text-sm max-w-sm mb-4">
                    {verificationRequired
                      ? "Kami mengirim tautan verifikasi ke email owner. Akun baru dapat masuk setelah tautan tersebut diklik."
                      : <>Workspace Anda siap di{" "}<span className="text-accent-teal font-mono font-bold">{formData.subdomain}.printpilot.id</span>. Selesaikan pembayaran invoice pertama untuk membuka akses penuh.</>}
                  </p>
                  <div className="mb-8 rounded-xl border border-border bg-elevated px-4 py-3 text-xs text-muted max-w-sm space-y-1 text-left">
                    <p>
                      Workspace:{" "}
                      <span className="font-mono font-bold text-primary">{formData.subdomain}</span>
                    </p>
                    <p>
                      Username Owner:{" "}
                      <span className="font-mono font-bold text-primary">{ownerUsername}</span>
                    </p>
                    <p className="pt-1">
                      Paket: <span className="font-bold text-primary">{planDef.name}</span> · {estimate.months} bulan ·{" "}
                      {planDef.max_users + estimate.addonSeats} user
                    </p>
                    <p>
                      Invoice pertama:{" "}
                      <span className="font-mono font-bold text-primary">{invoice?.number ?? "sedang disiapkan"}</span>
                      {invoice?.amount != null && (
                        <>
                          {" "}· <span className="font-bold text-primary">{rupiah(invoice.amount)}</span>
                        </>
                      )}
                    </p>
                    {invoice?.dueDate && (
                      <p>
                        Jatuh tempo:{" "}
                        <span className="font-bold text-primary">
                          {new Date(invoice.dueDate).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}
                        </span>
                      </p>
                    )}
                    <p className="pt-1">Simpan keduanya — dipakai bersama untuk login berikutnya.</p>
                  </div>

                  <a
                    href={verificationRequired ? "/login" : "/owner/billing"}
                    className="h-12 px-8 rounded-xl bg-primary text-base font-bold flex items-center gap-2 text-white hover:scale-105 transition-transform"
                  >
                    {verificationRequired ? "Ke halaman masuk" : "Lihat Invoice & Bayar"} <ChevronRight className="h-4 w-4" />
                  </a>
                </div>
              )}
            </div>

            <div className="mt-6 text-center flex flex-wrap items-center justify-center gap-2.5">
              <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-[11px] text-muted">
                <Lock className="h-3 w-3" /> Kata sandi di-hash (bcrypt)
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-[11px] text-muted">
                <ShieldCheck className="h-3 w-3" /> Data tiap tenant terisolasi
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
