'use client';

import { History, RotateCcw } from 'lucide-react';
import type { PartnerAppConfig } from '@lunara/types';
import { Card, CardBody } from '../ui/card';

function VersionList({
  versions,
  rollingBackVersion,
  onRollback,
}: {
  versions: PartnerAppConfig[];
  rollingBackVersion: number | null;
  onRollback: (version: number) => void;
}) {
  return (
    <>
      {versions.length === 0 ? (
        <p className="text-sm text-muted">No published versions yet.</p>
      ) : (
        <ul className="space-y-2">
          {versions.map((v, i) => (
            <li
              key={v.version}
              className="flex items-center justify-between rounded-lg border border-border/60 bg-white px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">
                  v{v.version} {i === 0 && <span className="text-primary">(current)</span>}
                </p>
                <p className="text-[11px] text-muted">{v.screens.length} screen(s)</p>
              </div>
              {i !== 0 && (
                <button
                  type="button"
                  onClick={() => onRollback(v.version)}
                  disabled={rollingBackVersion !== null}
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {rollingBackVersion === v.version ? 'Rolling back…' : 'Roll back'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function VersionHistoryPanel({
  versions,
  rollingBackVersion,
  onRollback,
  bare,
}: {
  versions: PartnerAppConfig[];
  rollingBackVersion: number | null;
  onRollback: (version: number) => void;
  bare?: boolean;
}) {
  if (bare) {
    return <VersionList versions={versions} rollingBackVersion={rollingBackVersion} onRollback={onRollback} />;
  }

  return (
    <Card>
      <CardBody className="space-y-3">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          <History className="h-3.5 w-3.5" /> Version history
        </h3>
        <VersionList versions={versions} rollingBackVersion={rollingBackVersion} onRollback={onRollback} />
      </CardBody>
    </Card>
  );
}
