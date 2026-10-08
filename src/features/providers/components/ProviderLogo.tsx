import type { ProviderBrandLogo } from '../brandLogos';
import styles from './ProviderLogo.module.scss';

interface ProviderLogoProps {
  logo?: ProviderBrandLogo;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASS = {
  sm: styles.sizeSm,
  md: styles.sizeMd,
  lg: styles.sizeLg,
} as const;

/** Brand logo tile; brand colours stay in the artwork, the tile itself is neutral. */
export function ProviderLogo({ logo, size = 'md' }: ProviderLogoProps) {
  if (!logo) return null;
  const base = [
    styles.logo,
    SIZE_CLASS[size],
    logo.transparent ? styles.transparent : '',
    logo.themeSurface ? styles.themeSurface : '',
  ];
  const lightClassName = [
    ...base,
    logo.darkSrc ? styles.themeLight : '',
    logo.invertOnDark ? styles.invertOnDark : '',
  ]
    .filter(Boolean)
    .join(' ');
  const darkClassName = [...base, styles.themeDark].filter(Boolean).join(' ');

  return (
    <>
      <img src={logo.src} alt="" aria-hidden="true" className={lightClassName} />
      {logo.darkSrc ? (
        <img src={logo.darkSrc} alt="" aria-hidden="true" className={darkClassName} />
      ) : null}
    </>
  );
}
