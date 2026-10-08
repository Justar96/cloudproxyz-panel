import { BRAND_MARK_PATH, BRAND_MARK_VIEWBOX } from '@/assets/brandMark';

interface BrandMarkProps {
  size?: number;
  className?: string;
  /** Accessible name when the mark stands alone; omit when the brand name is printed beside it. */
  label?: string;
}

/** The CloudProxyz cloud, drawn in the current text colour so it follows the theme. */
export function BrandMark({ size = 28, className, label }: BrandMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={BRAND_MARK_VIEWBOX}
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      focusable="false"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <path d={BRAND_MARK_PATH} />
    </svg>
  );
}
