import { createContext, useContext } from 'react';

/**
 * 字段级 UI 状态（只读）：页面把 useVisualConfig 的脏字段换算成 fieldId 集合后下发，
 * FieldAnchor 据此给已修改的设置行挂上「已修改」标记。不参与任何读写逻辑。
 */
export type ConfigFieldState = {
  dirtyFieldIds: ReadonlySet<string>;
  /** 「已修改」标记的可见文案（已翻译）。 */
  modifiedLabel: string;
};

const EMPTY_SET: ReadonlySet<string> = new Set();

export const ConfigFieldStateContext = createContext<ConfigFieldState>({
  dirtyFieldIds: EMPTY_SET,
  modifiedLabel: '',
});

export function useConfigFieldState(): ConfigFieldState {
  return useContext(ConfigFieldStateContext);
}
