import type { ReactNode } from 'react';
import { FIELDS_ROOT_CLASS } from './fields/FieldPrimitives';
import styles from './SectionCard.module.scss';

export type SectionCardProps = {
  title: ReactNode;
  description?: ReactNode;
  /** 仅首载入场为 true（页面挂载时用 useState 捕获），tab 切换零动画不重播。 */
  animateIn?: boolean;
  children: ReactNode;
};

/**
 * 分区卡片：无描边的抬升表面（--bg-primary / 18px 圆角），16/600 标题 + 简短说明，
 * 下面是以发丝线分隔的设置行。
 */
export function SectionCard({ title, description, animateIn = false, children }: SectionCardProps) {
  return (
    <section className={`${styles.card} ${animateIn ? styles.cardEnter : ''}`}>
      <header className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {description ? <p className={styles.description}>{description}</p> : null}
      </header>
      <div className={`${styles.content} ${FIELDS_ROOT_CLASS}`}>{children}</div>
    </section>
  );
}
