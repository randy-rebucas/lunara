'use client';

import { useCallback, useState } from 'react';
import { AuthLoading } from '../../../components/auth-loading';
import { DataPageStatus } from '../../../components/data-page-status';
import { PageHeader } from '../../../components/ui/page-header';
import { useRequirePartner } from '../../../hooks/use-protected-page';
import { listCampaigns, sendCampaign, type PartnerCampaign } from '../../../lib/partner-api';
import { usePartnerQuery } from '../../../lib/use-partner-query';

const TITLE_MAX = 65;
const BODY_MAX = 240;

export default function MarketingCampaignsPage() {
  const { ready } = useRequirePartner();

  const loadCampaigns = useCallback(() => listCampaigns(), []);
  const { data: campaigns, loading, error, reload } = usePartnerQuery(loadCampaigns, []);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setSuccessMessage('');
    setSending(true);
    try {
      const result = await sendCampaign({ title: title.trim(), body: body.trim() });
      setSuccessMessage(`Sent to ${result.sentCount} of ${result.recipientCount} customers.`);
      setTitle('');
      setBody('');
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to send campaign');
    } finally {
      setSending(false);
    }
  }

  if (!ready) return <AuthLoading message="Loading campaigns…" />;

  const campaignList: PartnerCampaign[] = campaigns ?? [];

  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Send a push notification to every customer who's ordered at your shop."
      />

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-slate-900">New campaign</h2>

        {successMessage && (
          <div className="alert-success mt-3" role="status">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSend} className="card mt-3 space-y-3 p-4">
          {formError && <div className="alert-error" role="alert">{formError}</div>}
          <div>
            <label className="form-label" htmlFor="camp-title">
              Title <span className="text-muted-foreground">({title.length}/{TITLE_MAX})</span>
            </label>
            <input
              id="camp-title"
              className="input-field"
              placeholder="We miss you!"
              value={title}
              maxLength={TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="form-label" htmlFor="camp-body">
              Message <span className="text-muted-foreground">({body.length}/{BODY_MAX})</span>
            </label>
            <textarea
              id="camp-body"
              className="input-field min-h-24"
              placeholder="Come back for 10% off your next order this week."
              value={body}
              maxLength={BODY_MAX}
              onChange={(e) => setBody(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={sending || !title.trim() || !body.trim()} className="btn-primary btn-sm">
            {sending ? 'Sending…' : 'Send to my customers'}
          </button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-slate-900">Sent campaigns</h2>

        <div className="mt-3">
          <DataPageStatus loading={loading} error={error} loadingMessage="Loading campaigns…" onRetry={reload} />
        </div>

        {!loading && !error && campaignList.length === 0 && (
          <div className="card mt-3 p-6 text-center text-sm text-muted">No campaigns sent yet.</div>
        )}

        {campaignList.length > 0 && (
          <div className="section-panel mt-3 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Message</th>
                    <th>Recipients</th>
                    <th>Sent</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignList.map((c) => (
                    <tr key={c._id}>
                      <td className="font-medium text-slate-900">{c.title}</td>
                      <td className="max-w-xs truncate text-muted" title={c.body}>
                        {c.body}
                      </td>
                      <td className="text-muted">{c.recipientCount}</td>
                      <td className="text-muted">{c.sentCount}</td>
                      <td className="text-muted">{new Date(c.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
