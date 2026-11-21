import type { ReactNode } from 'react';
import styles from './PluginList.module.scss';

export function PluginListReveal({ children }: { children: ReactNode }) {
  return <div className={styles.listArea}>{children}</div>;
}
