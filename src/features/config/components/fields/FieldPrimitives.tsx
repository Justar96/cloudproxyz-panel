import type { CSSProperties, ReactNode } from 'react';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { configFieldDomId } from '../../searchIndex';
import { useConfigFieldState } from './fieldState';
import styles from './Field.module.scss';

/** 搜索跳转的脉冲高亮 class（useFieldJump 命令式挂载/移除）。 */
export const FIELD_HIGHLIGHT_CLASS: string = styles.fieldHighlightActive;

/**
 * 表单控件宿主 class：设置行（label + 说明在左、控件在右）与嵌套表单块的作用域根。
 * SectionCard 的内容区自动挂载；脱离卡片渲染表单块（如 Modal 内容）时手动挂。
 */
export const FIELDS_ROOT_CLASS: string = styles.fieldsRoot;

export type ToggleRowProps = {
  title: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
};

/** 开关设置行：标题 + 说明在左，ToggleSwitch 在右（移动端同样保持并排）。 */
export function ToggleRow({ title, description, checked, disabled, onChange }: ToggleRowProps) {
  return (
    <div className={`${styles.row} ${styles.toggleRow}`}>
      <div className={styles.rowCopy}>
        <div className={styles.rowLabel}>{title}</div>
        {description ? <div className={styles.rowHint}>{description}</div> : null}
      </div>
      <div className={styles.toggleControl}>
        <ToggleSwitch checked={checked} onChange={onChange} disabled={disabled} ariaLabel={title} />
      </div>
    </div>
  );
}

/** 字段列表容器（历史上是双列网格；现为带分隔线的单列设置行）。 */
export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className={styles.fieldList}>{children}</div>;
}

export function FieldStack({ children }: { children: ReactNode }) {
  return <div className={styles.fieldList}>{children}</div>;
}

/** 设置行之间已有发丝分隔线；保留组件以兼容既有分区结构，不再额外渲染分隔。 */
export function Divider() {
  return null;
}

// Stable, stateless anchor around a searchable field. Search jumps target its DOM id
// (see searchIndex.ts) and the highlight pulse is applied to it imperatively.
// 每个锚点是一条设置行：顶部发丝分隔线；已修改时左侧琥珀点 + 标签后的「已修改」文案。
export function FieldAnchor({
  fieldId,
  children,
}: {
  fieldId: string;
  /** 旧双列网格的跨列标记；单列设置行布局下不再需要，保留以兼容调用方。 */
  wide?: boolean;
  children: ReactNode;
}) {
  const { dirtyFieldIds, modifiedLabel } = useConfigFieldState();
  const dirty = dirtyFieldIds.has(fieldId);
  const style = dirty
    ? ({ '--cfg-modified-label': JSON.stringify(modifiedLabel) } as CSSProperties)
    : undefined;
  return (
    <div
      id={configFieldDomId(fieldId)}
      className={styles.fieldAnchor}
      data-dirty={dirty ? 'true' : undefined}
      style={style}
    >
      {children}
    </div>
  );
}

/** 字段组：小标题 + 说明，下面是组内的设置行或区块编辑器。title 可省略只留容器。 */
export function FieldGroup({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.group}>
      {title ? (
        <div className={styles.groupHeader}>
          <h3 className={styles.groupTitle}>{title}</h3>
          {description ? <p className={styles.groupDescription}>{description}</p> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/** 独立的小组标题行（如 Claude / Codex 请求头小节标题）。 */
export function FieldGroupHeading({ title }: { title: string }) {
  return (
    <div className={`${styles.groupHeader} ${styles.groupHeading}`}>
      <h3 className={styles.groupTitle}>{title}</h3>
    </div>
  );
}

/** 设置行外壳：label + 说明在左，控件 + 校验错误在右；窄容器内自动堆叠。 */
export function FieldShell({
  label,
  labelId,
  htmlFor,
  hint,
  hintId,
  error,
  errorId,
  children,
}: {
  label: string;
  labelId?: string;
  htmlFor?: string;
  hint?: string;
  hintId?: string;
  error?: string;
  errorId?: string;
  children: ReactNode;
}) {
  return (
    <div className={`${styles.row} ${styles.fieldShell}`}>
      <div className={styles.rowCopy}>
        <label id={labelId} htmlFor={htmlFor} className={`${styles.rowLabel} ${styles.fieldLabel}`}>
          {label}
        </label>
        {hint ? (
          <div id={hintId} className={styles.rowHint}>
            {hint}
          </div>
        ) : null}
      </div>
      <div className={styles.rowControl}>
        {children}
        {error ? (
          <div id={errorId} className={styles.fieldError}>
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** 独立的字段提示行（FieldShell 之外的裸 hint）。 */
export function FieldHint({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <div id={id} className={styles.fieldHint}>
      {children}
    </div>
  );
}

/** 数字输入右侧的「已禁用」pill 宿主（流式 keepalive 的 0/空 提示）。 */
export function FieldControl({ children }: { children: ReactNode }) {
  return <div className={styles.fieldControl}>{children}</div>;
}

/** FieldControl 内的内联 pill。 */
export function InlinePill({ children }: { children: ReactNode }) {
  return <span className={styles.inlinePill}>{children}</span>;
}
