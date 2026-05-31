'use client';

import QRCode from 'react-qr-code';
import { buildHandoffQrPayload, HANDOFF_QR_KIND } from '@lunara/utils';

interface OrderHandoffQrProps {
  orderId: string;
  receiptCode: string;
}

export function OrderHandoffQr({ orderId, receiptCode }: OrderHandoffQrProps) {
  const payload = buildHandoffQrPayload(
    HANDOFF_QR_KIND.ORDER_HANDOVER,
    orderId,
    receiptCode,
  );

  return (
    <div className="card card-body mt-6 !py-5">
      <h3 className="font-semibold text-slate-900">Order handover QR</h3>
      <p className="mt-1 text-sm text-muted">
        Rider scans this when dropping off laundry. Receipt{' '}
        <span className="font-mono font-semibold text-slate-900">{receiptCode}</span>
      </p>
      <div className="mt-4 inline-flex rounded-xl bg-white p-4 ring-1 ring-border/60">
        <QRCode value={payload} size={200} />
      </div>
    </div>
  );
}
