'use client';

import { useParams } from 'next/navigation';
import { PageHeader } from '../../../components/ui/page-header';
import { ConversationPane } from '../../../components/conversation-pane';

export default function AdminConversationPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="shrink-0 border-b border-border/60 px-4 py-4 sm:px-6">
        <PageHeader title="Conversation" backHref="/messages" backLabel="All messages" />
      </div>
      <div className="min-h-0 flex-1">
        <ConversationPane conversationId={id} />
      </div>
    </div>
  );
}
