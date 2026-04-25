export function PikkukirjaLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-label="Pikkukirja">
      {/* Book cover */}
      <rect x="2" y="2" width="24" height="24" rx="4.5" fill="currentColor" className="text-primary" />
      {/* Spine divider */}
      <rect x="8.5" y="2" width="2.5" height="24" fill="white" opacity="0.18" />
      {/* Ruled lines */}
      <line x1="13.5" y1="9"    x2="22.5" y2="9"    stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.78" />
      <line x1="13.5" y1="13.5" x2="22.5" y2="13.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.78" />
      <line x1="13.5" y1="18"   x2="19.5" y2="18"   stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.78" />
    </svg>
  );
}
