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

const CUSTOMER_APP_URL = 'https://lunara-customer-web.vercel.app/';
const CUSTOMER_APP_QR_SRC = '/images/lunara_qr.png';
const RIDER_APP_QR_SRC = '/images/lunara_rider_qr_code.png';

const STEPS = [
  { label: 'Business', description: 'Shop and owner details' },
  { label: 'Branding', description: 'Your own app, or ours' },
  { label: 'Agreement', description: 'Pricing and terms' },
  { label: 'Commitments', description: 'What we ask in return' },
  { label: 'Contact', description: 'Where we reach you' },
] as const;

const RESERVATION_FEE_POINTS = [
  'Reserves one (1) municipality or one (1) city',
  'Is valid for twelve (12) months',
  'Is non-refundable',
  'Is non-transferable',
  'Does not constitute a franchise fee',
  'Does not grant ownership of the Lunara brand',
];

const PARTNER_COMMITMENTS = [
  {
    title: 'Maintain Active Participation',
    points: [
      'Keep services active on the platform',
      'Accept customer bookings whenever operationally feasible',
      'Update order statuses accurately',
      'Maintain current business information',
    ],
  },
  {
    title: 'Promote Platform Adoption',
    intro: 'The Partner agrees to make reasonable efforts to:',
    points: [
      'Encourage customers to use the Lunara App',
      'Display Lunara promotional materials',
      'Participate in launch activities and campaigns',
    ],
  },
  {
    title: 'Provide Feedback',
    intro: 'The Founding Partner agrees to provide operational feedback that may assist in improving:',
    points: ['Customer experience', 'Rider operations', 'Partner dashboard features', 'Overall platform performance'],
  },
];

const TERRITORIAL_PARTNER_RESPONSIBILITIES = [
  {
    title: 'Business Development',
    points: [
      'Promote Lunara within the assigned territory.',
      'Recruit new laundry partners.',
      'Introduce Lunara to local business owners.',
      'Participate in business events and networking activities.',
    ],
  },
  {
    title: 'Partner Support',
    points: [
      'Assist new partners during onboarding.',
      'Coordinate training sessions.',
      'Help partners understand the Lunara platform.',
      'Assist in resolving operational concerns.',
    ],
  },
  {
    title: 'Marketing',
    points: [
      'Distribute Lunara promotional materials.',
      'Conduct local marketing campaigns.',
      'Promote customer downloads of the Lunara App.',
    ],
  },
  {
    title: 'Relationship Management',
    intro: 'Maintain professional relationships with:',
    points: ['Laundry owners', 'Riders', 'Customers', 'Local organizations', 'Business associations'],
  },
];

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

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
}

const emptyAddress: SignupAddressValue = {
  line1: '',
  city: '',
  province: '',
  postalCode: '',
  latitude: 0,
  longitude: 0,
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
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToCommitments, setAgreedToCommitments] = useState(false);
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
      address.province.trim() &&
      (address.latitude !== 0 || address.longitude !== 0)
    );
  }

  function canAdvanceFromStep2() {
    return wantsBranding !== null;
  }

  function canAdvanceFromStep3() {
    return agreedToTerms;
  }

  function canAdvanceFromStep4() {
    return agreedToCommitments;
  }

  function canSubmitStep5() {
    return email.trim().length > 0 && phone.trim().length > 0;
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
            Account created!
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Your account has been created. We&apos;ve sent your temporary password to{' '}
            <span className="font-medium text-slate-900">{email}</span>. Please check your inbox
            and verify your email before signing in.
          </p>
          <Link href={"/login"} className="btn-primary mt-8 inline-flex w-full justify-center py-3">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <div
        className="relative hidden w-[42%] flex-col justify-between overflow-x-hidden overflow-y-auto bg-[#04142e] bg-cover bg-center px-12 py-12 text-white lg:flex"
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
          <h2 className="max-w-sm break-words text-2xl font-bold leading-tight lg:text-3xl">
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

      <div className="relative flex min-h-0 w-full flex-1 items-start justify-center overflow-y-auto bg-surface px-6 py-12 sm:px-12">
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
                  <div>
                    <input
                      id="business-name"
                      className="input-field"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g. CleanWash Laundry"
                      required
                    />
                    {businessName.trim() && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Your shop link: <span className="font-medium text-slate-700">lunara.app/{slugify(businessName) || 'shop'}-••••</span>{' '}
                        <span className="text-muted-foreground/80">(a unique code is added when your account is created)</span>
                      </p>
                    )}
                  </div>
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

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setWantsBranding(true)}
                    aria-pressed={wantsBranding === true}
                    className={`relative flex items-start gap-3 rounded-xl px-4 py-4 text-left shadow-[var(--shadow-card)] ring-1 transition-all ${
                      wantsBranding === true
                        ? 'bg-primary/5 ring-2 ring-primary'
                        : 'bg-surface ring-border/50 hover:ring-primary/30'
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                        wantsBranding === true ? 'bg-primary text-white' : 'bg-primary/10 text-primary'
                      }`}
                    >
                      <Icon d={ICONS.tag} className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">Yes, brand my app</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Your logo, your colors</p>
                    </div>
                    {wantsBranding === true && (
                      <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                        <Icon d={CHECK_ICON} className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWantsBranding(false);
                      handleLogoChange(null);
                    }}
                    aria-pressed={wantsBranding === false}
                    className={`relative flex items-start gap-3 rounded-xl px-4 py-4 text-left shadow-[var(--shadow-card)] ring-1 transition-all ${
                      wantsBranding === false
                        ? 'bg-primary/5 ring-2 ring-primary'
                        : 'bg-surface ring-border/50 hover:ring-primary/30'
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                        wantsBranding === false ? 'bg-primary text-white' : 'bg-primary/10 text-primary'
                      }`}
                    >
                      <Icon d={ICONS.box} className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">No, use default Lunara</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Get started right away</p>
                    </div>
                    {wantsBranding === false && (
                      <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                        <Icon d={CHECK_ICON} className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">You can change this later</p>

                {wantsBranding && (
                  <div className="card card-body mt-6">
                    <label htmlFor="logo-upload" className="text-sm font-medium text-slate-900">
                      Upload your logo
                    </label>
                    <p className="mt-0.5 text-xs text-muted-foreground">PNG, JPEG, or WebP — up to 5MB</p>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 ring-1 ring-border/50">
                        {logoPreviewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={logoPreviewUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Icon d={ICONS.camera} className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <input
                          id="logo-upload"
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(e) => handleLogoChange(e.target.files?.[0] ?? null)}
                          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/15"
                        />
                        {logo && (
                          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="truncate">{logo.name}</span>
                            <button
                              type="button"
                              onClick={() => handleLogoChange(null)}
                              className="font-medium text-primary hover:text-primary/80"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {wantsBranding !== null && (
                  <div className="card card-body mt-6">
                    <PhonePreviewMockup
                      logoUrl={logoPreviewUrl}
                      businessName={businessName}
                      variant={wantsBranding ? 'branded' : 'default'}
                    />
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
              <div key="agreement-step">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Partnership agreement</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {wantsBranding
                    ? 'Your branded app comes with an exclusive territory.'
                    : 'Here is your pricing for using the Lunara brand.'}
                </p>

                <div className="mt-4 rounded-xl bg-primary/5 px-4 py-3 text-xs font-medium text-primary ring-1 ring-primary/20">
                  🎉 We provide a 1-month free trial before billing starts.
                </div>

                {wantsBranding ? (
                  <div className="mt-8 space-y-4">
                    <div className="card card-body flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Monthly subscription</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Your branded app, billed monthly</p>
                      </div>
                      <p className="text-lg font-bold text-slate-900 whitespace-nowrap">₱3,000<span className="text-xs font-medium text-muted-foreground">/mo</span></p>
                    </div>

                    <div className="card card-body">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Territory Reservation Fee</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">One-time fee to reserve your territory</p>
                        </div>
                        <p className="text-lg font-bold text-slate-900 whitespace-nowrap">₱5,000</p>
                      </div>
                      <div className="mt-4 border-t border-border/60 pt-4">
                        <p className="text-xs font-medium text-slate-900">The reservation fee:</p>
                        <ul className="mt-2 space-y-1.5">
                          {RESERVATION_FEE_POINTS.map((point) => (
                            <li key={point} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-8">
                    <div className="card card-body flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Monthly subscription</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Use the default Lunara app and brand</p>
                      </div>
                      <p className="text-lg font-bold text-slate-900 whitespace-nowrap">₱1,299<span className="text-xs font-medium text-muted-foreground">/mo</span></p>
                    </div>
                  </div>
                )}

                <label className="mt-6 flex items-start gap-3 rounded-xl bg-surface px-1 py-2">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border/60 text-primary focus:ring-primary"
                  />
                  <span className="text-xs text-muted-foreground">
                    I have read and agree to the pricing and terms of this partnership agreement.
                  </span>
                </label>

                <div className="mt-8 flex gap-3">
                  <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1 py-3">
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={!canAdvanceFromStep3()}
                    onClick={() => setStep(3)}
                    className="btn-primary flex-1 py-3"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Partner commitments</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  In exchange for the promotional benefits, the Founding Partner agrees to:
                </p>

                <div className="mt-8 space-y-4">
                  {PARTNER_COMMITMENTS.map((section, i) => (
                    <div key={section.title} className="card card-body">
                      <p className="text-sm font-semibold text-slate-900">
                        {i + 1}. {section.title}
                      </p>
                      {section.intro && (
                        <p className="mt-1 text-xs text-muted-foreground">{section.intro}</p>
                      )}
                      <ul className="mt-2 space-y-1.5">
                        {section.points.map((point) => (
                          <li key={point} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                {wantsBranding && (
                  <div className="mt-8">
                    <h2 className="text-lg font-bold tracking-tight text-slate-900">
                      Responsibilities of the Territorial Partner
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Since you&apos;re reserving a territory, the Territorial Partner also agrees to:
                    </p>
                    <div className="mt-4 space-y-4">
                      {TERRITORIAL_PARTNER_RESPONSIBILITIES.map((section) => (
                        <div key={section.title} className="card card-body">
                          <p className="text-sm font-semibold text-slate-900">{section.title}</p>
                          {section.intro && (
                            <p className="mt-1 text-xs text-muted-foreground">{section.intro}</p>
                          )}
                          <ul className="mt-2 space-y-1.5">
                            {section.points.map((point) => (
                              <li key={point} className="flex items-start gap-2 text-xs text-muted-foreground">
                                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                                <span>{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <label className="mt-6 flex items-start gap-3 rounded-xl bg-surface px-1 py-2">
                  <input
                    type="checkbox"
                    checked={agreedToCommitments}
                    onChange={(e) => setAgreedToCommitments(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border/60 text-primary focus:ring-primary"
                  />
                  <span className="text-xs text-muted-foreground">
                    I understand and agree to these partner commitments
                    {wantsBranding ? ' and territorial partner responsibilities' : ''}.
                  </span>
                </label>

                <div className="mt-8 flex gap-3">
                  <button type="button" onClick={() => setStep(2)} className="btn-secondary flex-1 py-3">
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={!canAdvanceFromStep4()}
                    onClick={() => setStep(4)}
                    className="btn-primary flex-1 py-3"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
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

                <div className="card card-body mt-6 flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={CUSTOMER_APP_QR_SRC}
                    alt="QR code to the Lunara customer app"
                    className="h-24 w-24 shrink-0 rounded-lg ring-1 ring-border/50"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">Get the Lunara customer app</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Scan the QR code, or share the mobile-first web app with your customers:
                    </p>
                    <a
                      href={CUSTOMER_APP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link-primary mt-1 block truncate text-xs font-medium"
                    >
                      {CUSTOMER_APP_URL}
                    </a>
                  </div>
                </div>

                <div className="card card-body mt-4 flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={RIDER_APP_QR_SRC}
                    alt="QR code to the Lunara rider app"
                    className="h-24 w-24 shrink-0 rounded-lg ring-1 ring-border/50"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">Get the Lunara rider app</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Scan the QR code to share with riders who&apos;ll be handling your pickups and
                      deliveries.
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="alert-error mt-6" role="alert">
                    {error}
                  </div>
                )}

                <div className="mt-8 flex gap-3">
                  <button type="button" onClick={() => setStep(3)} className="btn-secondary flex-1 py-3">
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !canSubmitStep5()}
                    className="btn-primary flex-1 py-3"
                  >
                    {submitting ? 'Creating your account…' : 'Create account'}
                  </button>
                </div>
              </div>
            )}
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href={"/login"} className="link-primary">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
