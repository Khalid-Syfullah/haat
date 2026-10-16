'use client';

import clsx from 'clsx';
import { useState } from 'react';
import { Modal } from '@/components/ui';
import { dateTime } from '@/lib/format';
import { Thumb } from './bits';
import type { TicketMessage } from './ticket-bits';

/** The conversation as staff see it: the customer on the left, the store on the right. */
export function TicketThread({ messages, customerName }: { messages: TicketMessage[]; customerName: string }) {
  const [photo, setPhoto] = useState<string | null>(null);
  return (
    <>
      <ol className="space-y-4" aria-label="Messages">
        {messages.map((m) => {
          const staff = m.fromStaff;
          return (
            <li key={m.id} className={clsx('flex', staff ? 'justify-end' : 'justify-start')}>
              <div className={clsx('flex max-w-[90%] flex-col sm:max-w-[78%]', staff ? 'items-end' : 'items-start')}>
                <p className="mb-1 px-1 text-xs text-ink-soft">
                  <span className="font-semibold text-ink">{staff ? m.author.name : customerName}</span>
                  {staff ? ' · staff' : ' · customer'} · {dateTime(m.createdAt)}
                </p>
                <div
                  className={clsx(
                    'rounded-xl px-3.5 py-2.5 text-[15px] leading-relaxed text-ink',
                    staff ? 'rounded-br-sm bg-padma-tint' : 'rounded-bl-sm border border-line bg-white',
                  )}
                >
                  <p className="whitespace-pre-line break-words [overflow-wrap:anywhere]">{m.body}</p>
                  {m.images.length > 0 && (
                    <div className={clsx('mt-2 flex flex-wrap gap-1.5', staff && 'justify-end')}>
                      {m.images.map((src, i) => (
                        <button
                          key={src}
                          type="button"
                          onClick={() => setPhoto(src)}
                          className="rounded focus-visible:outline-2 focus-visible:outline-marigold"
                          aria-label={`Open photo ${i + 1} full size`}
                        >
                          <Thumb src={src} size={72} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <Modal open={!!photo} onClose={() => setPhoto(null)} title="Attached photo" wide>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photo && <img src={photo} alt="Photo attached to the ticket" className="mx-auto max-h-[65vh] rounded" />}
      </Modal>
    </>
  );
}
