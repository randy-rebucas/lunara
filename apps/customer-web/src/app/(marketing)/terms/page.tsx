import type { Metadata } from 'next';
import Link from 'next/link';
import { appConfig } from '@lunara/config';
import { PublicShell } from '../../../components/public-shell';
import { buildPageMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Terms of Service',
  description: `The terms that govern your use of the ${appConfig.name} laundry booking platform.`,
  path: '/terms',
});

const LAST_UPDATED = 'June 8, 2026';

export default function TermsPage() {
  return (
    <PublicShell
      badge="Legal"
      title="Terms of Service"
      description={`Last updated: ${LAST_UPDATED}`}
    >
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of {appConfig.name}
        &apos;s website, mobile apps, and related services (collectively, the &quot;Service&quot;), which
        connect customers with partner laundry shops and delivery riders. By creating an account or
        using the Service, you agree to these Terms. If you do not agree, do not use the Service.
      </p>

      <h2>Eligibility and accounts</h2>
      <p>
        You must be able to form a binding contract to use the Service and provide accurate registration
        information (name, phone number, and email or other verification). You are responsible for
        keeping your login credentials and one-time passwords confidential, and for all activity under
        your account. Notify us immediately of any unauthorized use.
      </p>

      <h2>Bookings and orders</h2>
      <ul>
        <li>
          When you book a laundry pickup, you authorize {appConfig.name} to assign a partner shop and/or
          rider to fulfill the order based on availability, service area, and your selections.
        </li>
        <li>
          Order details (service type, estimated weight or piece count, schedule, and pricing) are shown
          at checkout. Final pricing may be adjusted after the partner shop weighs or inspects the items,
          subject to the pricing terms shown in the app.
        </li>
        <li>
          You are responsible for accurately describing garments, disclosing special-care items, and
          removing valuables from pockets before pickup. {appConfig.name} and its partners are not
          liable for items left in garments.
        </li>
        <li>
          Orders may be rescheduled or cancelled subject to the cancellation windows and fees shown in
          the app at the time of booking.
        </li>
      </ul>

      <h2>Payments, wallet, and refunds</h2>
      <ul>
        <li>
          Payments may be made by card, e-wallet, cash on pickup/delivery, or Lunara wallet balance,
          depending on what is offered for your order. Card and e-wallet payments are processed by
          third-party payment providers under their own terms.
        </li>
        <li>
          Refunds for disputed, damaged, lost, or cancelled orders are handled through the in-app refund
          request process and are subject to review. Approved refunds are credited to your Lunara wallet
          unless otherwise stated.
        </li>
        <li>
          Promotional codes and discounts are subject to their own eligibility rules and may be modified
          or withdrawn at any time.
        </li>
      </ul>

      <h2>Partner shops and riders</h2>
      <p>
        Partner laundry shops and delivery riders are independent businesses or independent contractors,
        not employees of {appConfig.name}. {appConfig.name} facilitates the connection and payment
        between you and these providers but does not itself perform laundry or delivery services. We
        require partners and riders to meet onboarding and conduct standards, and we investigate reports
        of service issues, but we do not guarantee the acts or omissions of independent partners and
        riders beyond the remedies described in our refund and support processes.
      </p>

      <h2>Lost, damaged, or delayed items</h2>
      <p>
        If an item is lost, damaged, or significantly delayed, report it through Support as soon as
        possible so we can investigate with the responsible partner or rider. Remedies may include
        reprocessing, a partial or full refund, or compensation up to the limits stated in the app for
        the affected order, at our discretion following investigation.
      </p>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service for unlawful, fraudulent, or abusive purposes.</li>
        <li>Interfere with, disrupt, or attempt to gain unauthorized access to the Service or its systems.</li>
        <li>Submit false information, fraudulent payments, or abusive refund/support requests.</li>
        <li>Harass, threaten, or abuse partner staff, riders, or {appConfig.name} support agents.</li>
      </ul>
      <p>
        Violation of these Terms may result in suspension or termination of your account and, where
        applicable, referral to law enforcement.
      </p>

      <h2>Reviews and content</h2>
      <p>
        If you submit reviews, photos, or other content through the Service, you grant {appConfig.name} a
        non-exclusive, royalty-free license to use, display, and reproduce that content in connection with
        operating and promoting the Service. You are responsible for content you submit and must not post
        content that is false, defamatory, or infringes another person&apos;s rights.
      </p>

      <h2>Disclaimers and limitation of liability</h2>
      <p>
        The Service is provided &quot;as is&quot; without warranties of any kind, to the fullest extent
        permitted by law. {appConfig.name} is not liable for indirect, incidental, or consequential
        damages arising from your use of the Service. Our aggregate liability for any claim relating to
        an order is limited to the amount you paid for that order, except where such limitation is not
        permitted by law.
      </p>

      <h2>Changes to the Service and these Terms</h2>
      <p>
        We may update, suspend, or discontinue parts of the Service, and may revise these Terms from time
        to time. We will post the revised Terms on this page and update the &quot;Last updated&quot; date.
        Continued use of the Service after changes take effect means you accept the updated Terms.
      </p>

      <h2>Termination</h2>
      <p>
        You may stop using the Service and close your account at any time. We may suspend or terminate
        your access if you violate these Terms, engage in fraudulent or abusive activity, or where
        required by law.
      </p>

      <h2>Governing law</h2>
      <p>
        These Terms are governed by the laws of the Republic of the Philippines, without regard to
        conflict-of-law principles, except where local law requires otherwise for consumers in your
        jurisdiction.
      </p>

      <h2>Contact us</h2>
      <p>
        Questions about these Terms? Email{' '}
        <a href={`mailto:${appConfig.supportEmail}`}>{appConfig.supportEmail}</a> or visit{' '}
        <Link href="/support">Support</Link> when signed in. See also our{' '}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </PublicShell>
  );
}
