'use client';

import { useState } from 'react';
import { Building2, FileText, MapPin, MessageSquare, Store } from 'lucide-react';
import { resolveApiV1BaseUrl } from '@lunara/hooks';
import { Button } from '@lunara/ui';
import { MarketingContentPage } from '../../../../components/marketing/marketing-content-page';
import { MarketingBackLink } from '../../../../components/marketing/marketing-design';
import { Card, CardBody, CardSectionHeader } from '../../../../components/ui/card';
import { DocumentUploadField } from '../../../../components/ui/document-upload-field';
import { FormLabel, Input } from '../../../../components/ui/input';

const BUSINESS_TYPES = [
  { value: 'sole_proprietorship', label: 'Sole Proprietorship' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'corporation', label: 'Corporation' },
] as const;

const DOCUMENT_FIELDS = [
  { key: 'businessPermit', label: "Mayor's / Business Permit" },
  { key: 'dtiSecRegistration', label: 'DTI or SEC Registration' },
  { key: 'birCertificate', label: 'BIR Certificate of Registration (COR)' },
  { key: 'ownerValidId', label: 'Owner Valid ID' },
  { key: 'shopPhoto', label: 'Shop Photo' },
] as const;

type DocumentKey = (typeof DOCUMENT_FIELDS)[number]['key'];

const INITIAL_FORM = {
  businessName: '',
  ownerFullName: '',
  email: '',
  phone: '',
  businessType: 'sole_proprietorship',
  address: {
    street: '',
    barangay: '',
    cityMunicipality: '',
    province: '',
    postalCode: '',
  },
  operations: {
    dailyCapacityKg: '',
    serviceRadiusKm: '',
    operatingHours: '',
  },
  message: '',
  declarationAccepted: false,
};

const INITIAL_FILES: Record<DocumentKey, File | null> = {
  businessPermit: null,
  dtiSecRegistration: null,
  birCertificate: null,
  ownerValidId: null,
  shopPhoto: null,
};

export default function PartnerApplyPage() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [files, setFiles] = useState(INITIAL_FILES);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function update<K extends keyof typeof INITIAL_FORM>(key: K, value: (typeof INITIAL_FORM)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateGroup<K extends 'address' | 'operations'>(
    group: K,
    field: keyof (typeof INITIAL_FORM)[K],
    value: string,
  ) {
    setForm((prev) => ({ ...prev, [group]: { ...prev[group], [field]: value } }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const missingDoc = DOCUMENT_FIELDS.find((doc) => !files[doc.key]);
    if (missingDoc) {
      setError(`${missingDoc.label} is required`);
      return;
    }
    if (!form.declarationAccepted) {
      setError('You must accept the declaration to submit your application');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('businessName', form.businessName);
      formData.append('ownerFullName', form.ownerFullName);
      formData.append('email', form.email);
      formData.append('phone', form.phone);
      formData.append('businessType', form.businessType);
      formData.append('address', JSON.stringify(form.address));
      formData.append('operations', JSON.stringify(form.operations));
      formData.append('declarationAccepted', String(form.declarationAccepted));
      if (form.message) formData.append('message', form.message);
      for (const doc of DOCUMENT_FIELDS) {
        const file = files[doc.key];
        if (file) formData.append(doc.key, file);
      }

      const res = await fetch(`${resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL)}/partner-applications`, {
        method: 'POST',
        body: formData,
      });
      const body = await res.json();
      if (!res.ok || body?.success === false) {
        const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
        throw new Error(message ?? 'Could not submit your application');
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your application');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <MarketingContentPage
        badge="Application received"
        title="Thanks for applying"
        description="Our partnerships team will review your application and reach out within a few days."
        narrow
      >
        <Card elevated>
          <CardBody className="text-center">
            <p className="text-sm leading-relaxed text-muted">
              Keep an eye on your email and phone for next steps, including document verification and
              onboarding.
            </p>
          </CardBody>
        </Card>
        <MarketingBackLink href="/partners" label="← Back to partner info" />
      </MarketingContentPage>
    );
  }

  return (
    <MarketingContentPage
      badge="For laundry shops"
      title="Apply to become a partner"
      description="Tell us about your laundry shop and daily capacity, and upload your business documents. Our partnerships team will review your application and follow up with onboarding steps."
      narrow
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card elevated>
          <CardBody className="space-y-4">
            <CardSectionHeader icon={Building2} title="Business Information" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FormLabel htmlFor="businessName">Business name</FormLabel>
                <Input
                  id="businessName"
                  value={form.businessName}
                  onChange={(e) => update('businessName', e.target.value)}
                  required
                  maxLength={160}
                />
              </div>
              <div>
                <FormLabel htmlFor="ownerFullName">Owner full name</FormLabel>
                <Input
                  id="ownerFullName"
                  value={form.ownerFullName}
                  onChange={(e) => update('ownerFullName', e.target.value)}
                  required
                  maxLength={160}
                />
              </div>
              <div>
                <FormLabel htmlFor="businessType">Business type</FormLabel>
                <select
                  id="businessType"
                  className="input-field"
                  value={form.businessType}
                  onChange={(e) => update('businessType', e.target.value)}
                  required
                >
                  {BUSINESS_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FormLabel htmlFor="phone">Mobile number</FormLabel>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  required
                  maxLength={20}
                />
              </div>
              <div>
                <FormLabel htmlFor="email">Email</FormLabel>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  required
                  maxLength={120}
                />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card elevated>
          <CardBody className="space-y-4">
            <CardSectionHeader icon={MapPin} title="Shop Address" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FormLabel htmlFor="street">Street</FormLabel>
                <Input
                  id="street"
                  value={form.address.street}
                  onChange={(e) => updateGroup('address', 'street', e.target.value)}
                  required
                  maxLength={160}
                />
              </div>
              <div>
                <FormLabel htmlFor="barangay">Barangay</FormLabel>
                <Input
                  id="barangay"
                  value={form.address.barangay}
                  onChange={(e) => updateGroup('address', 'barangay', e.target.value)}
                  required
                  maxLength={80}
                />
              </div>
              <div>
                <FormLabel htmlFor="cityMunicipality">City/Municipality</FormLabel>
                <Input
                  id="cityMunicipality"
                  value={form.address.cityMunicipality}
                  onChange={(e) => updateGroup('address', 'cityMunicipality', e.target.value)}
                  required
                  maxLength={80}
                />
              </div>
              <div>
                <FormLabel htmlFor="province">Province</FormLabel>
                <Input
                  id="province"
                  value={form.address.province}
                  onChange={(e) => updateGroup('address', 'province', e.target.value)}
                  required
                  maxLength={80}
                />
              </div>
              <div>
                <FormLabel htmlFor="postalCode">Postal code</FormLabel>
                <Input
                  id="postalCode"
                  value={form.address.postalCode}
                  onChange={(e) => updateGroup('address', 'postalCode', e.target.value)}
                  required
                  maxLength={20}
                />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card elevated>
          <CardBody className="space-y-4">
            <CardSectionHeader icon={Store} title="Operations" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FormLabel htmlFor="dailyCapacityKg">Daily capacity (kg)</FormLabel>
                <Input
                  id="dailyCapacityKg"
                  type="number"
                  min={1}
                  value={form.operations.dailyCapacityKg}
                  onChange={(e) => updateGroup('operations', 'dailyCapacityKg', e.target.value)}
                  required
                />
              </div>
              <div>
                <FormLabel htmlFor="serviceRadiusKm">Service radius (km)</FormLabel>
                <Input
                  id="serviceRadiusKm"
                  type="number"
                  min={1}
                  value={form.operations.serviceRadiusKm}
                  onChange={(e) => updateGroup('operations', 'serviceRadiusKm', e.target.value)}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <FormLabel htmlFor="operatingHours">Operating hours</FormLabel>
                <Input
                  id="operatingHours"
                  placeholder="e.g. Mon–Sat, 8:00 AM – 6:00 PM"
                  value={form.operations.operatingHours}
                  onChange={(e) => updateGroup('operations', 'operatingHours', e.target.value)}
                  required
                  maxLength={160}
                />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card elevated>
          <CardBody className="space-y-4">
            <CardSectionHeader icon={FileText} title="Documents" />
            <p className="text-sm text-muted">Upload clear photos of the following. JPEG, PNG, or WebP, max 5 MB each.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {DOCUMENT_FIELDS.map((doc) => (
                <DocumentUploadField
                  key={doc.key}
                  label={doc.label}
                  file={files[doc.key]}
                  onChange={(file) => setFiles((prev) => ({ ...prev, [doc.key]: file }))}
                />
              ))}
            </div>
          </CardBody>
        </Card>

        <Card elevated>
          <CardBody className="space-y-4">
            <CardSectionHeader icon={MessageSquare} title="Additional Notes" />
            <div>
              <FormLabel htmlFor="message">Anything else we should know? (optional)</FormLabel>
              <textarea
                id="message"
                className="input-field min-h-24 resize-none"
                value={form.message}
                onChange={(e) => update('message', e.target.value)}
                maxLength={1000}
              />
            </div>

            <label htmlFor="declarationAccepted" className="flex items-start gap-3 text-sm text-muted">
              <input
                id="declarationAccepted"
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-border/60 text-primary focus:ring-primary"
                checked={form.declarationAccepted}
                onChange={(e) => update('declarationAccepted', e.target.checked)}
                required
              />
              <span>
                I certify that the information and documents I have provided are true and accurate to
                the best of my knowledge, and I consent to Lunara verifying them as part of the partner
                application review.
              </span>
            </label>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit application'}
            </Button>
          </CardBody>
        </Card>
      </form>

      <MarketingBackLink href="/partners" label="← Back to partner info" />
    </MarketingContentPage>
  );
}
