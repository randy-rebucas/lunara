'use client';

import { useState } from 'react';
import { Bike, FileText, IdCard, MapPin, MessageSquare, Siren, User } from 'lucide-react';
import { resolveApiV1BaseUrl } from '@lunara/hooks';
import { Button } from '@lunara/ui';
import { MarketingContentPage } from '../../../../components/marketing/marketing-content-page';
import { MarketingBackLink } from '../../../../components/marketing/marketing-design';
import { Card, CardBody, CardSectionHeader } from '../../../../components/ui/card';
import { DocumentUploadField } from '../../../../components/ui/document-upload-field';
import { FormLabel, Input } from '../../../../components/ui/input';

const VEHICLE_TYPES = [
  { value: 'motorcycle', label: 'Motorcycle' },
  { value: 'bicycle', label: 'Bicycle' },
  { value: 'car', label: 'Car' },
  { value: 'van', label: 'Van' },
] as const;

const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
] as const;

const CIVIL_STATUSES = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'widowed', label: 'Widowed' },
  { value: 'separated', label: 'Separated' },
  { value: 'divorced', label: 'Divorced' },
] as const;

const DOCUMENT_FIELDS = [
  { key: 'governmentId', label: 'Government-issued ID' },
  { key: 'driversLicense', label: "Driver's License" },
  { key: 'orReceipt', label: 'OR (Official Receipt)' },
  { key: 'crCertificate', label: 'CR (Certificate of Registration)' },
  { key: 'nbiPoliceClearance', label: 'NBI/Police Clearance' },
  { key: 'brgyClearance', label: 'Barangay Clearance' },
  { key: 'selfiePhoto', label: 'Selfie Photo' },
  { key: 'vehiclePhoto', label: 'Vehicle Photo' },
] as const;

type DocumentKey = (typeof DOCUMENT_FIELDS)[number]['key'];

const INITIAL_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  gender: 'male',
  civilStatus: 'single',
  address: {
    street: '',
    barangay: '',
    cityMunicipality: '',
    province: '',
    postalCode: '',
  },
  emergencyContact: {
    fullName: '',
    relationship: '',
    contactNumber: '',
    address: '',
  },
  vehicle: {
    type: 'motorcycle',
    make: '',
    model: '',
    color: '',
    plateNumber: '',
    yearModel: '',
  },
  license: {
    number: '',
    expirationDate: '',
    restrictionCode: '',
  },
  message: '',
  declarationAccepted: false,
};

const INITIAL_FILES: Record<DocumentKey, File | null> = {
  governmentId: null,
  driversLicense: null,
  orReceipt: null,
  crCertificate: null,
  nbiPoliceClearance: null,
  brgyClearance: null,
  selfiePhoto: null,
  vehiclePhoto: null,
};

export default function RiderApplyPage() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [files, setFiles] = useState(INITIAL_FILES);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function update<K extends keyof typeof INITIAL_FORM>(key: K, value: (typeof INITIAL_FORM)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateGroup<K extends 'address' | 'emergencyContact' | 'vehicle' | 'license'>(
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
      formData.append('firstName', form.firstName);
      formData.append('lastName', form.lastName);
      formData.append('email', form.email);
      formData.append('phone', form.phone);
      formData.append('gender', form.gender);
      formData.append('civilStatus', form.civilStatus);
      formData.append('address', JSON.stringify(form.address));
      formData.append('emergencyContact', JSON.stringify(form.emergencyContact));
      formData.append('vehicle', JSON.stringify(form.vehicle));
      formData.append('license', JSON.stringify(form.license));
      formData.append('declarationAccepted', String(form.declarationAccepted));
      if (form.message) formData.append('message', form.message);
      for (const doc of DOCUMENT_FIELDS) {
        const file = files[doc.key];
        if (file) formData.append(doc.key, file);
      }

      const res = await fetch(`${resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL)}/rider-applications`, {
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
        description="Our operations team will review your application and reach out within a few days."
        narrow
      >
        <Card elevated>
          <CardBody className="text-center">
            <p className="text-sm leading-relaxed text-muted">
              Keep an eye on your email and phone for next steps, including document verification.
            </p>
          </CardBody>
        </Card>
        <MarketingBackLink href="/riders" label="← Back to rider info" />
      </MarketingContentPage>
    );
  }

  return (
    <MarketingContentPage
      badge="For riders"
      title="Apply to drive"
      description="Tell us about yourself, your vehicle, and upload your documents. Our operations team will review your application and follow up with onboarding steps."
      narrow
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card elevated>
          <CardBody className="space-y-4">
            <CardSectionHeader icon={User} title="Personal Information" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FormLabel htmlFor="firstName">First name</FormLabel>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => update('firstName', e.target.value)}
                  required
                  maxLength={80}
                />
              </div>
              <div>
                <FormLabel htmlFor="lastName">Last name</FormLabel>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => update('lastName', e.target.value)}
                  required
                  maxLength={80}
                />
              </div>
              <div>
                <FormLabel htmlFor="gender">Gender</FormLabel>
                <select
                  id="gender"
                  className="input-field"
                  value={form.gender}
                  onChange={(e) => update('gender', e.target.value)}
                  required
                >
                  {GENDERS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FormLabel htmlFor="civilStatus">Civil status</FormLabel>
                <select
                  id="civilStatus"
                  className="input-field"
                  value={form.civilStatus}
                  onChange={(e) => update('civilStatus', e.target.value)}
                  required
                >
                  {CIVIL_STATUSES.map((option) => (
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
            <CardSectionHeader icon={MapPin} title="Address" />
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
            <CardSectionHeader icon={Siren} title="Emergency Contact" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FormLabel htmlFor="emergencyFullName">Full name</FormLabel>
                <Input
                  id="emergencyFullName"
                  value={form.emergencyContact.fullName}
                  onChange={(e) => updateGroup('emergencyContact', 'fullName', e.target.value)}
                  required
                  maxLength={160}
                />
              </div>
              <div>
                <FormLabel htmlFor="emergencyRelationship">Relationship</FormLabel>
                <Input
                  id="emergencyRelationship"
                  value={form.emergencyContact.relationship}
                  onChange={(e) => updateGroup('emergencyContact', 'relationship', e.target.value)}
                  required
                  maxLength={80}
                />
              </div>
              <div>
                <FormLabel htmlFor="emergencyContactNumber">Contact number</FormLabel>
                <Input
                  id="emergencyContactNumber"
                  type="tel"
                  value={form.emergencyContact.contactNumber}
                  onChange={(e) => updateGroup('emergencyContact', 'contactNumber', e.target.value)}
                  required
                  maxLength={20}
                />
              </div>
              <div>
                <FormLabel htmlFor="emergencyAddress">Complete address</FormLabel>
                <Input
                  id="emergencyAddress"
                  value={form.emergencyContact.address}
                  onChange={(e) => updateGroup('emergencyContact', 'address', e.target.value)}
                  required
                  maxLength={300}
                />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card elevated>
          <CardBody className="space-y-4">
            <CardSectionHeader icon={Bike} title="Vehicle Information" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FormLabel htmlFor="vehicleType">Type</FormLabel>
                <select
                  id="vehicleType"
                  className="input-field"
                  value={form.vehicle.type}
                  onChange={(e) => updateGroup('vehicle', 'type', e.target.value)}
                  required
                >
                  {VEHICLE_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FormLabel htmlFor="vehicleMake">Make</FormLabel>
                <Input
                  id="vehicleMake"
                  value={form.vehicle.make}
                  onChange={(e) => updateGroup('vehicle', 'make', e.target.value)}
                  required
                  maxLength={80}
                />
              </div>
              <div>
                <FormLabel htmlFor="vehicleModel">Model</FormLabel>
                <Input
                  id="vehicleModel"
                  value={form.vehicle.model}
                  onChange={(e) => updateGroup('vehicle', 'model', e.target.value)}
                  required
                  maxLength={80}
                />
              </div>
              <div>
                <FormLabel htmlFor="vehicleColor">Color</FormLabel>
                <Input
                  id="vehicleColor"
                  value={form.vehicle.color}
                  onChange={(e) => updateGroup('vehicle', 'color', e.target.value)}
                  required
                  maxLength={40}
                />
              </div>
              <div>
                <FormLabel htmlFor="vehiclePlateNumber">Plate number</FormLabel>
                <Input
                  id="vehiclePlateNumber"
                  value={form.vehicle.plateNumber}
                  onChange={(e) => updateGroup('vehicle', 'plateNumber', e.target.value)}
                  required
                  maxLength={20}
                />
              </div>
              <div>
                <FormLabel htmlFor="vehicleYearModel">Year model</FormLabel>
                <Input
                  id="vehicleYearModel"
                  value={form.vehicle.yearModel}
                  onChange={(e) => updateGroup('vehicle', 'yearModel', e.target.value)}
                  required
                  maxLength={10}
                />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card elevated>
          <CardBody className="space-y-4">
            <CardSectionHeader icon={IdCard} title="License Information" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FormLabel htmlFor="licenseNumber">License number</FormLabel>
                <Input
                  id="licenseNumber"
                  value={form.license.number}
                  onChange={(e) => updateGroup('license', 'number', e.target.value)}
                  required
                  maxLength={40}
                />
              </div>
              <div>
                <FormLabel htmlFor="licenseExpirationDate">Expiration date</FormLabel>
                <Input
                  id="licenseExpirationDate"
                  type="date"
                  value={form.license.expirationDate}
                  onChange={(e) => updateGroup('license', 'expirationDate', e.target.value)}
                  required
                />
              </div>
              <div>
                <FormLabel htmlFor="licenseRestrictionCode">Restriction code</FormLabel>
                <Input
                  id="licenseRestrictionCode"
                  value={form.license.restrictionCode}
                  onChange={(e) => updateGroup('license', 'restrictionCode', e.target.value)}
                  maxLength={20}
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
                the best of my knowledge, and I consent to Lunara verifying them as part of the rider
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

      <MarketingBackLink href="/riders" label="← Back to rider info" />
    </MarketingContentPage>
  );
}
