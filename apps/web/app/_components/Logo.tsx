export function Logo({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect width="32" height="32" rx="7" fill="#1e7a47" />
      <rect x="6" y="8.5" width="13" height="1.75" rx="0.875" fill="#86c39e" />
      <rect x="6" y="13.5" width="9" height="1.75" rx="0.875" fill="#86c39e" />
      <rect x="6" y="18.5" width="14" height="1.75" rx="0.875" fill="#86c39e" />
      <path
        d="M5 25 L12 20 L17 22 L27 7"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22 7 L27 7 L27 12"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
