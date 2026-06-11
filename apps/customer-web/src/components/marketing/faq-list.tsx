const FAQ_ITEMS = [
  {
    question: 'How do I book laundry pickup?',
    answer:
      'Sign up with your mobile number, add a pickup address, choose a service (wash, dry clean, or express), pick a time slot, and confirm your order. A rider will collect your laundry at the scheduled time.',
  },
  {
    question: 'Which areas does Lunara serve?',
    answer:
      'We currently operate in Metro Manila with partner branches in Makati, Quezon City, and BGC. Each branch covers nearby neighborhoods within its service radius. Enter your address when booking to see if pickup and delivery are available.',
  },
  {
    question: 'How can I track my order?',
    answer:
      'Open your order from the dashboard to see live status updates — from rider dispatch and shop processing to out for delivery and delivered. You will also receive notifications when key steps change.',
  },
  {
    question: 'What payment methods are accepted?',
    answer:
      'You can pay with GCash, credit or debit card, your Lunara wallet, or cash on pickup or delivery. Available options are shown at checkout.',
  },
  {
    question: 'How long does laundry take?',
    answer:
      'Standard wash-and-fold orders typically return within 24–48 hours depending on service type and branch capacity. Express options may be available at checkout for faster turnaround.',
  },
  {
    question: 'Can I cancel or reschedule an order?',
    answer:
      'You may cancel or reschedule before a rider is dispatched for pickup. Once pickup is in progress, contact support through the app for help with changes or refunds.',
  },
  {
    question: 'What if something is missing or damaged?',
    answer:
      'Report issues from your order details or contact support@lunara.app. We work with partner shops to investigate and process refunds when appropriate.',
  },
  {
    question: 'How do I delete my account?',
    answer:
      'Go to Profile → Account settings and request account deletion. We will process your request in line with our Privacy Policy.',
  },
  {
    question: 'How do I become a Lunara partner or rider?',
    answer:
      'Laundry shops can apply on our Partners page. Delivery riders can learn more on our Riders page and contact operations to get onboarded.',
  },
] as const;

export function FaqList() {
  return (
    <div className="faq-list">
      {FAQ_ITEMS.map((item) => (
        <details key={item.question} className="faq-item group">
          <summary className="faq-question">{item.question}</summary>
          <p className="faq-answer">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
