'use client';

interface Props {
  children: React.ReactNode;
  onDismiss: () => void;
  className?: string;
}

export default function HintCallout({ children, onDismiss, className = '' }: Props) {
  return (
    <div
      className={`flex items-start gap-2 px-3 py-2 text-xs ${className}`}
      style={{
        background: 'color-mix(in oklch, oklch(0.65 0.14 250) 8%, var(--bg-panel))',
        borderTop: '1px solid color-mix(in oklch, oklch(0.65 0.14 250) 20%, transparent)',
        color: 'var(--text-soft)',
      }}
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-px" style={{ color: 'oklch(0.65 0.14 250)' }}>
        <circle cx="8" cy="8" r="7"/><path d="M8 7v4M8 5v.5"/>
      </svg>
      <span className="flex-1 leading-relaxed">{children}</span>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded transition-opacity opacity-50 hover:opacity-100"
        aria-label="Dismiss hint"
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M7 1L1 7M1 1l6 6"/>
        </svg>
      </button>
    </div>
  );
}
