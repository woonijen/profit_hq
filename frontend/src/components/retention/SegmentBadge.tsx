import type { ReactNode } from 'react';
import { SEGMENT_LABELS } from '@/features/retention/segments';
import type { CustomerSegment } from '@/features/retention/types';

const SEGMENT_STYLES: Record<CustomerSegment, string> = {
  VIP: 'bg-segment-vip-bg text-segment-vip-fg',
  AT_RISK: 'bg-segment-at-risk-bg text-segment-at-risk-fg',
  CHURNED: 'bg-segment-churned-bg text-segment-churned-fg',
  ACTIVE: 'bg-segment-active-bg text-segment-active-fg',
};

/** Outline icons on a 16px grid, drawn with the badge's text color. */
const SEGMENT_ICONS: Record<CustomerSegment, ReactNode> = {
  // Star
  VIP: <path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z" />,
  // Warning triangle
  AT_RISK: (
    <>
      <path d="M8 2l6.2 11H1.8z" />
      <path d="M8 6.5v3M8 11.4v.1" />
    </>
  ),
  // Person with a minus: gone
  CHURNED: (
    <>
      <circle cx="6" cy="5" r="2.5" />
      <path d="M1.5 13.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4M11.5 6.5h3.5" />
    </>
  ),
  // Pulse line
  ACTIVE: <path d="M1 8.5h3l2-5 3 9 2-4h4" />,
};

interface SegmentBadgeProps {
  segment: CustomerSegment;
  className?: string;
}

/** Segment as color, icon and the segment's name, so it never relies on color alone. */
export function SegmentBadge({ segment, className = '' }: SegmentBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-current/25 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${SEGMENT_STYLES[segment]} ${className}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="size-3.5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {SEGMENT_ICONS[segment]}
      </svg>
      {SEGMENT_LABELS[segment]}
    </span>
  );
}
