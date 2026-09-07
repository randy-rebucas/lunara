'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import brandIcon from '@lunara/brand/icon';
import { Icon, ICONS } from '../../components/ui/icon';
import { BubbleField, DARK_PANEL_BUBBLES, LIGHT_PANEL_BUBBLES } from '../../components/bubble-field';
import { SignupAddressEditor, type SignupAddressValue } from '../../components/signup-address-editor';
import { PhonePreviewMockup } from '../../components/phone-preview-mockup';
import { getRecaptchaToken } from '../../lib/recaptcha';
import { signupPartner } from '../../lib/onboarding-api';

const MAIL_ICON =
  'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75';
const PHONE_ICON =
  'M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z';
const CHECK_ICON = 'M4.5 12.75l6 6 9-13.5';

const STEPS = [
  { label: 'Business', description: 'Shop and owner details' },
  { label: 'Branding', description: 'Your own app, or ours' },
  { label: 'Contact', description: 'Where we reach you' },
] as const;

const BENEFITS = [
  {
    icon: ICONS.receipt,
    title: 'Live in Minutes',
    description: 'No paperwork or waiting — start taking orders as soon as you verify your email',
  },
  {
    icon: ICONS.tag,
    title: 'Your Own Branded App',
    description: 'Give customers a laundry app with your logo instead of the default Lunara look',
  },
  {
    icon: ICONS.scale,
    title: 'One Dashboard, Full Control',
    description: 'Orders, staff, inventory, and payouts — everything in a single partner portal',
  },
];

const emptyAddress: SignupAddressValue = {
  line1: '',
  city: '',
  province: '',
  postalCode: '',
  latitude: 14.5995,
  longitude: 120.9842,
};

function StepTracker({ step }: { step: number }) {
  return (
    <ol className="relative mt-8 space-y-5">
      {STEPS.map((s, i) => {
        const state = i < step ? 'done' : i === step ? 'current' : 'upcoming';
        return (
          <li key={s.label} className="relative flex items-start gap-3">
            {i < STEPS.length - 1 && (
              <span
                className={`absolute left-[13px] top-7 h-5 w-px ${i < step ? 'bg-sky-300' : 'bg-white/15'}`}
                aria-hidden
              />
            )}
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1 ${
                state === 'done'
                  ? 'bg-sky-300 text-[#04142e] ring-sky-300'
                  : state === 'current'
                    ? 'bg-white/10 text-white ring-2 ring-sky-300'
                    : 'bg-transparent text-slate-500 ring-white/15'
              }`}
            >
              {state === 'done' ? <Icon d={CHECK_ICON} className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <div className="pt-0.5">
              <p className={`text-sm font-semibold ${state === 'upcoming' ? 'text-slate-500' : 'text-white'}`}>
                {s.label}
              </p>
              <p className="text-xs text-slate-400">{s.description}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function PartnerSignupPage() {
  const [step, setStep] = useState(0);
  const [ownerFullName, setOwnerFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState<SignupAddressValue>(emptyAddress);
  const [wantsBranding, setWantsBranding] = useState<boolean | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | undefined>(undefined);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function handleLogoChange(file: File | null) {
    setLogo(file);
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    setLogoPreviewUrl(file ? URL.createObjectURL(file) : undefined);
  }

  function canAdvanceFromStep1() {
    return (
      ownerFullName.trim().length >= 2 &&
      businessName.trim().length >= 2 &&
      address.line1.trim() &&
      address.city.trim() &&
      address.province.trim()
    );
  }

  function canAdvanceFromStep2() {
    return wantsBranding !== null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const recaptchaToken = await getRecaptchaToken('partner_signup');
      await signupPartner(
        {
          ownerFullName: ownerFullName.trim(),
          businessName: businessName.trim(),
          address: {
            line1: address.line1.trim(),
            city: address.city.trim(),
            province: address.province.trim(),
            postalCode: address.postalCode.trim() || undefined,
            coordinates: [address.longitude, address.latitude],
          },
          wantsBranding: Boolean(wantsBranding),
          email: email.trim(),
          phone: phone.trim(),
          recaptchaToken,
        },
        wantsBranding && logo ? logo : undefined,
      );
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-6 py-12">
        <div className="w-full max-w-md text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon d={CHECK_ICON} className="h-7 w-7" />
          </span>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">
            Application received!
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Your account has been created. We&apos;ve sent your temporary password to{' '}
            <span className="font-medium text-slate-900">{email}</span>. Please check your inbox
            and verify your email before signing in.
          </p>
          <Link href="/login" className="btn-primary mt-8 inline-flex w-full justify-center py-3">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <div
        className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-[#04142e] bg-cover bg-center px-12 py-12 text-white lg:flex"
        style={{ backgroundImage: "url('/images/background.png')" }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(7,33,66,0.55), rgba(6,24,54,0.6) 45%, rgba(3,12,30,0.78)), radial-gradient(60% 50% at 30% 20%, rgba(37,99,235,0.35), transparent), radial-gradient(50% 40% at 80% 80%, rgba(6,182,212,0.28), transparent)',
          }}
          aria-hidden
        />

        <BubbleField bubbles={DARK_PANEL_BUBBLES} className="login-bubble" />

        <div className="relative flex items-center gap-2.5">
          <Image
            src={brandIcon}
            alt=""
            width={40}
            height={40}
            className="shrink-0 rounded-xl shadow-lg"
            aria-hidden
            priority
          />
          <div>
            <p className="text-sm font-bold tracking-wide">LUNARA</p>
            <p className="text-xs text-slate-400">Become a partner</p>
          </div>
        </div>

        <div className="relative">
          <h2 className="text-3xl font-bold leading-tight sm:text-4xl">
            Grow Your Shop
            <br />
            <span className="text-sky-300">Without the Overhead</span>
          </h2>
          <p className="mt-4 max-w-sm text-sm text-slate-300">
            Join the laundry shops running their business on Lunara — from first order to
            everyday operations.
          </p>

          <ul className="mt-8 space-y-5">
            {BENEFITS.map(({ icon, title, description }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sky-200 ring-1 ring-white/10">
                  <Icon d={icon} className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-sm text-slate-400">{description}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-10 border-t border-white/10 pt-8">
            <StepTracker step={step} />
          </div>
        </div>

        <p className="relative text-xs text-slate-500">
          © {new Date().getFullYear()} Lunara. All rights reserved.
        </p>
      </div>

      <div className="relative flex w-full flex-1 items-center justify-center overflow-hidden bg-surface px-6 py-12 sm:px-12">
        <BubbleField bubbles={LIGHT_PANEL_BUBBLES} className="login-bubble-light" />

        <div className="relative w-full max-w-2xl">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <Image src={brandIcon} alt="" width={36} height={36} className="shrink-0 rounded-xl shadow-sm" priority />
            <div>
              <p className="text-sm font-bold tracking-wide text-slate-900">LUNARA</p>
              <p className="text-xs text-muted-foreground">Become a partner</p>
            </div>
          </div>

          <div className="mb-8 flex items-center justify-between lg:hidden">
            {STEPS.map((s, i) => (
              <div key={s.label} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                      i <= step ? 'bg-primary text-white' : 'bg-slate-100 text-muted-foreground'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`mx-2 h-0.5 flex-1 ${i < step ? 'bg-primary' : 'bg-slate-100'}`} />
                )}
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {step === 0 && (
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tell us about your shop</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Basic details so we can set up your laundry shop.
                </p>

                <div className="mt-8 grid items-start gap-x-8 gap-y-2 sm:grid-cols-[minmax(0,220px)_1fr]">
                  <div className="pt-2.5">
                    <label htmlFor="owner-name" className="text-sm font-medium text-slate-900">
                      Business owner
                    </label>
                    <p className="mt-0.5 text-xs text-muted-foreground">Full name on your ID</p>
                  </div>
                  <input
                    id="owner-name"
                    className="input-field"
                    value={ownerFullName}
                    onChange={(e) => setOwnerFullName(e.target.value)}
                    placeholder="Juan Dela Cruz"
                    required
                  />
                </div>

                <div className="mt-6 grid items-start gap-x-8 gap-y-2 border-t border-border/60 pt-6 sm:grid-cols-[minmax(0,220px)_1fr]">
                  <div className="pt-2.5">
                    <label htmlFor="business-name" className="text-sm font-medium text-slate-900">
                      Laundry shop name
                    </label>
                    <p className="mt-0.5 text-xs text-muted-foreground">Shown to your customers</p>
                  </div>
                  <input
                    id="business-name"
                    className="input-field"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. CleanWash Laundry"
                    required
                  />
                </div>

                <div className="mt-6 grid items-start gap-x-8 gap-y-2 border-t border-border/60 pt-6 sm:grid-cols-[minmax(0,220px)_1fr]">
                  <div className="pt-2.5">
                    <label className="text-sm font-medium text-slate-900">Shop address</label>
                    <p className="mt-0.5 text-xs text-muted-foreground">Where orders get picked up</p>
                  </div>
                  <SignupAddressEditor value={address} onChange={setAddress} />
                </div>

                <button
                  type="button"
                  disabled={!canAdvanceFromStep1()}
                  onClick={() => setStep(1)}
                  className="btn-primary mt-8 w-full py-3"
                >
                  Continue
                </button>
              </div>
            )}

            {step === 1 && (
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Want your own branded app?
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Give your customers a laundry app with your own logo, instead of the default
                  Lunara look.
                </p>

                <div className="mt-8 grid items-start gap-x-8 gap-y-2 sm:grid-cols-[minmax(0,220px)_1fr]">
                  <div className="pt-2.5">
                    <label className="text-sm font-medium text-slate-900">App branding</label>
                    <p className="mt-0.5 text-xs text-muted-foreground">You can change this later</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setWantsBranding(true)}
                      aria-pressed={wantsBranding === true}
                      className={`rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors ${
                        wantsBranding === true
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/40'
                      }`}
                    >
                      Yes, brand my app
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setWantsBranding(false);
                        handleLogoChange(null);
                      }}
                      aria-pressed={wantsBranding === false}
                      className={`rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors ${
                        wantsBranding === false
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/40'
                      }`}
                    >
                      No, use default Lunara
                    </button>
                  </div>
                </div>

                {wantsBranding && (
                  <div className="mt-6 grid items-start gap-x-8 gap-y-2 border-t border-border/60 pt-6 sm:grid-cols-[minmax(0,220px)_1fr]">
                    <div className="pt-2.5">
                      <label htmlFor="logo-upload" className="text-sm font-medium text-slate-900">
                        Upload your logo
                      </label>
                      <p className="mt-0.5 text-xs text-muted-foreground">PNG, JPEG, or WebP — up to 5MB</p>
                    </div>
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => handleLogoChange(e.target.files?.[0] ?? null)}
                      className="input-field file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary"
                    />
                  </div>
                )}

                {wantsBranding && (
                  <div className="mt-6 border-t border-border/60 pt-6">
                    <PhonePreviewMockup logoUrl={logoPreviewUrl} businessName={businessName} />
                  </div>
                )}

                <div className="mt-8 flex gap-3">
                  <button type="button" onClick={() => setStep(0)} className="btn-secondary flex-1 py-3">
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={!canAdvanceFromStep2()}
                    onClick={() => setStep(2)}
                    className="btn-primary flex-1 py-3"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">How can we reach you?</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  We&apos;ll send your temporary password here.
                </p>

                <div className="mt-8 grid items-start gap-x-8 gap-y-2 sm:grid-cols-[minmax(0,220px)_1fr]">
                  <div className="pt-2.5">
                    <label htmlFor="signup-email" className="text-sm font-medium text-slate-900">
                      Email
                    </label>
                    <p className="mt-0.5 text-xs text-muted-foreground">Your temporary password goes here</p>
                  </div>
                  <div className="relative">
                    <Icon
                      d={MAIL_ICON}
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground"
                    />
                    <input
                      id="signup-email"
                      type="email"
                      className="input-field pl-11"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@shop.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div className="mt-6 grid items-start gap-x-8 gap-y-2 border-t border-border/60 pt-6 sm:grid-cols-[minmax(0,220px)_1fr]">
                  <div className="pt-2.5">
                    <label htmlFor="signup-phone" className="text-sm font-medium text-slate-900">
                      Phone number
                    </label>
                    <p className="mt-0.5 text-xs text-muted-foreground">For order and delivery updates</p>
                  </div>
                  <div className="relative">
                    <Icon
                      d={PHONE_ICON}
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground"
                    />
                    <input
                      id="signup-phone"
                      type="tel"
                      className="input-field pl-11"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="09XX XXX XXXX"
                      autoComplete="tel"
                      required
                    />
                  </div>
                </div>

                {error && (
                  <div className="alert-error mt-6" role="alert">
                    {error}
                  </div>
                )}

                <div className="mt-8 flex gap-3">
                  <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1 py-3">
                    Back
                  </button>
                  <button type="submit" disabled={submitting} className="btn-primary flex-1 py-3">
                    {submitting ? 'Creating your account…' : 'Create account'}
                  </button>
                </div>
              </div>
            )}
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="link-primary">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
