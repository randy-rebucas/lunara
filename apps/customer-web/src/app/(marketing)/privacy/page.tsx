import type { Metadata } from 'next';
import Link from 'next/link';
import { appConfig } from '@lunara/config';
import { PublicShell } from '../../../components/public-shell';

export const metadata: Metadata = {
  title: `Privacy Policy — ${appConfig.name}`,
  description: `How ${appConfig.name} collects, uses, and protects your personal information.`,
};

const LAST_UPDATED = 'June 8, 2026';

export default function PrivacyPage() {
  return (
    <PublicShell
      badge="Legal"
      title="Privacy Policy"
      description={`Last updated: ${LAST_UPDATED}`}
    >
      <p>
        {appConfig.name} (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates a laundry booking
        platform that connects customers with partner laundry shops and delivery riders. This policy
        explains what information we collect, how we use it, and the choices you have when you use our
        website, mobile app, and related services (collectively, the &quot;Service&quot;).
      </p>

      <h2>Information we collect</h2>
      <p>We collect information you provide and data generated when you use the Service:</p>
      <ul>
        <li>
          <strong>Account information</strong> — name, email address, phone number, and profile photo
          when you register or update your profile.
        </li>
        <li>
          <strong>Addresses</strong> — pickup and delivery addresses, including optional GPS coordinates
          when you pin a location on a map.
        </li>
        <li>
          <strong>Order information</strong> — booking details, service type, schedule, order status,
          photos related to your laundry (e.g. proof of delivery), signatures, and support or refund
          requests.
        </li>
        <li>
          <strong>Payment information</strong> — payment method selection, transaction status, and wallet
          balance. Card and e-wallet payments are processed by third-party payment providers; we do not
          store full card numbers on our servers.
        </li>
        <li>
          <strong>Communications</strong> — messages you send through support tickets, reviews, and
          lost-item reports.
        </li>
        <li>
          <strong>Device and usage data</strong> — push notification tokens, app and browser type, and
          log data needed to operate and secure the Service.
        </li>
        <li>
          <strong>Location</strong> — only when you grant permission to pin an address or when riders
          share live location during an active delivery assigned to your order.
        </li>
      </ul>

      <h2>How we use your information</h2>
      <p>We use personal information to:</p>
      <ul>
        <li>Create and manage your account and authenticate you (including one-time passwords).</li>
        <li>Process laundry bookings, payments, refunds, and wallet transactions.</li>
        <li>Assign partner shops and riders to fulfill pickup and delivery.</li>
        <li>Send order updates, notifications, and support responses.</li>
        <li>Improve the Service, prevent fraud, and comply with legal obligations.</li>
      </ul>

      <h2>How we share information</h2>
      <p>We share information only as needed to run the Service:</p>
      <ul>
        <li>
          <strong>Partner laundry shops</strong> — order and contact details required to process your
          laundry.
        </li>
        <li>
          <strong>Riders</strong> — name, phone (e.g. last digits for handoff verification), and
          addresses for pickup and delivery.
        </li>
        <li>
          <strong>Service providers</strong> — payment processors, cloud hosting, SMS/OTP providers,
          push notification services (e.g. Firebase), and analytics tools under contract.
        </li>
        <li>
          <strong>Legal requirements</strong> — when required by law or to protect rights, safety, and
          security.
        </li>
      </ul>
      <p>We do not sell your personal information.</p>

      <h2>Data retention</h2>
      <p>
        We keep your information while your account is active and as needed to provide the Service,
        resolve disputes, enforce agreements, and meet legal requirements. You may request account
        deletion by contacting us; some records may be retained where required by law or for legitimate
        business purposes (e.g. completed order and payment records).
      </p>

      <h2>Security</h2>
      <p>
        We use technical and organizational measures to protect your data, including encryption in
        transit (HTTPS) and access controls. No method of transmission or storage is completely secure;
        please use a strong password and keep your login credentials private.
      </p>

      <h2>Your choices and rights</h2>
      <ul>
        <li>Update your profile and saved addresses in the app or website.</li>
        <li>Manage notification preferences in your device settings and in-app settings where available.</li>
        <li>
          Request access, correction, or deletion of your personal data by emailing{' '}
          <a href={`mailto:${appConfig.supportEmail}`}>{appConfig.supportEmail}</a>.
        </li>
        <li>
          Withdraw location permission in your device settings; some features (address pinning) may not
          work without it.
        </li>
      </ul>
      <p>
        If you are in the Philippines, you may have additional rights under the Data Privacy Act of 2012.
        Contact us to exercise them.
      </p>

      <h2>Children</h2>
      <p>
        The Service is not directed to children under 13. We do not knowingly collect personal
        information from children. Contact us if you believe a child has provided us data.
      </p>

      <h2>International transfers</h2>
      <p>
        Your data may be processed on servers located outside your country. We take steps to ensure
        appropriate safeguards when data is transferred internationally.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this policy from time to time. We will post the revised version on this page and
        update the &quot;Last updated&quot; date. Continued use of the Service after changes means you
        accept the updated policy.
      </p>

      <h2>Contact us</h2>
      <p>
        Questions about this policy or your data? Email{' '}
        <a href={`mailto:${appConfig.supportEmail}`}>{appConfig.supportEmail}</a> or visit{' '}
        <Link href="/support">Support</Link> when signed in.
      </p>
    </PublicShell>
  );
}
