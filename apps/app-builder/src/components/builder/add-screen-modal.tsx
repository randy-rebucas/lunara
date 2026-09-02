'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@lunara/ui';
import { Card, CardBody } from '../ui/card';
import { ScreenTemplatePicker } from './screen-template-picker';

export function AddScreenModal({
  existingKeys,
  onClose,
  onAdd,
}: {
  existingKeys: string[];
  onClose: () => void;
  onAdd: (keys: string[]) => void;
}) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  function toggle(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-screen-title"
    >
      <Card elevated className="w-full max-w-lg">
        <CardBody className="space-y-4">
          <div className="flex items-start justify-between">
            <h2 id="add-screen-title" className="text-lg font-semibold text-slate-900">
              Add a screen
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-muted-foreground hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto editor-scrollbar pr-1">
            <ScreenTemplatePicker selectedKeys={selectedKeys} onToggle={toggle} excludeKeys={existingKeys} />
          </div>
          <Button className="w-full" disabled={selectedKeys.size === 0} onClick={() => onAdd([...selectedKeys])}>
            {selectedKeys.size > 0 ? `Add ${selectedKeys.size} screen${selectedKeys.size > 1 ? 's' : ''}` : 'Add screen'}
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
