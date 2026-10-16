'use client';

import { Printer } from 'lucide-react';
import { Button } from '../ui';

export function PrintButton({ label = 'Print or save as PDF' }: { label?: string }) {
  return (
    <Button size="sm" variant="outline" onClick={() => window.print()}>
      <Printer className="size-4" /> {label}
    </Button>
  );
}
