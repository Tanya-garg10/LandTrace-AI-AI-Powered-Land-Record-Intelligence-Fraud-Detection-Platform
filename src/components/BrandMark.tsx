export function BrandLogo({
  size = 'md',
  variant = 'dark',
  showTagline = false,
}: {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'dark' | 'light';
  showTagline?: boolean;
}) {
  const iconSize = size === 'lg' ? 'w-10 h-10' : size === 'sm' ? 'w-7 h-7' : 'w-8 h-8';
  const titleSize = size === 'lg' ? 'text-xl' : size === 'sm' ? 'text-sm' : 'text-[15px]';
  const textColor = variant === 'light' ? 'text-white' : 'text-[#242B27]';
  const subColor = variant === 'light' ? 'text-[#C8DBD3]' : 'text-[#626E68]';

  return (
    <div className="flex items-center gap-2.5 shrink-0">
      <svg
        viewBox="0 0 36 36"
        fill="none"
        className={`${iconSize} shrink-0`}
        aria-hidden="true"
      >
        <rect
          width="36"
          height="36"
          rx="9"
          fill={variant === 'light' ? '#235947' : '#173F32'}
        />
        {/* Geometric parcel boundary */}
        <path
          d="M9.5 14.5L18 9L26.5 13L25 24L12.5 27L9.5 14.5Z"
          stroke="#EAF0E9"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        {/* Location marker node */}
        <circle cx="18" cy="15.5" r="2.75" fill="#C4A36A" />
        {/* Verification trace check */}
        <path
          d="M14.2 21.5L16.8 23.8L22.2 18.2"
          stroke="#5BB995"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="min-w-0">
        <span className={`font-display font-bold tracking-tight block leading-none whitespace-nowrap ${titleSize} ${textColor}`}>
          LandTrace <span className={variant === 'light' ? 'text-[#C4A36A]' : 'text-[#398568]'}>AI</span>
        </span>
        {showTagline && (
          <span className={`text-[11px] block mt-1 truncate ${subColor}`}>
            Every Parcel Has a Story. Every Change Leaves a Trace.
          </span>
        )}
      </div>
    </div>
  );
}
