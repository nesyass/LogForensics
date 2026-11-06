export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="9.5" cy="9.5" r="6.4" stroke="currentColor" strokeWidth="2.05" />
        <path
          d="M14.3 14.3l6.2 6.2"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
        />
        <path
          d="M6.4 7.5h5.9M6.4 9.7h7.4M6.4 11.9h6.3"
          stroke="currentColor"
          strokeWidth="1.55"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}

export function Brand({ subtitle = 'Local log intelligence' }: { subtitle?: string }) {
  return (
    <span className="brand">
      <BrandMark />
      <span className="brand-text">
        <span className="brand-name">LogForensics</span>
        <span className="brand-sub">{subtitle}</span>
      </span>
    </span>
  )
}
