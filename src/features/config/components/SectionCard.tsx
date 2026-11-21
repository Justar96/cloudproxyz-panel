import type { ReactNode } from 'react';
import { InfoTip } from '@/components/ui/Tooltip';
import { FIELDS_ROOT_CLASS } from './fields/FieldPrimitives';
import styles from './SectionCard.module.scss';

export type SectionCardProps = {
  title: ReactNode;
  /** 分区说明：默认收进标题后的 InfoTip，不占版面。 */
  description?: ReactNode;
  /** 让分区说明作为可见段落留在标题下方，而不是收进 InfoTip。 */
  keepDescriptionVisible?: boolean;
  children: ReactNode;
};

/**
 * 分区卡片：无描边的抬升表面（--bg-primary / 18px 圆角），16/600 标题 + 简短说明，
 * 下面是以发丝线分隔的设置行。
 */
export function SectionCard({
  title,
  description,
  keepDescriptionVisible = false,
  children,
}: SectionCardProps) {
  return (
    <section className={styles.card}>
      <header className={styles.header}>
        <div className={styles.titleLine}>
          <h2 className={styles.title}>{title}</h2>
          {description && !keepDescriptionVisible ? (
            <InfoTip content={description} label={typeof title === 'string' ? title : undefined} />
          ) : null}
        </div>
        {description && keepDescriptionVisible ? (
          <p className={styles.description}>{description}</p>
        ) : null}
      </header>
      <div className={`${styles.content} ${FIELDS_ROOT_CLASS}`}>{children}</div>
    </section>
  );
}
