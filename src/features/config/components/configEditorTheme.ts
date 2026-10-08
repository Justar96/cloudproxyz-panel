import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { tags } from '@lezer/highlight';

// CodeMirror 主题：全部取自 CSS 主题 token，明暗主题共用同一份声明（token 自己切换）。
// 语法高亮保持石墨单色系：键名主色、字符串次级色、注释与标点最弱，只靠明度与字重区分。

const MONO =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', monospace";

const baseTheme = (dark: boolean) =>
  EditorView.theme(
    {
      '&': {
        height: '100%',
        backgroundColor: 'var(--bg-tertiary)',
        color: 'var(--text-primary)',
        fontSize: '13px',
      },
      '&.cm-focused': {
        outline: 'none',
      },
      '.cm-scroller': {
        fontFamily: MONO,
        lineHeight: '20px',
      },
      '.cm-content': {
        padding: '12px 0',
        caretColor: 'var(--text-primary)',
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: 'var(--text-primary)',
      },
      '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection':
        {
          backgroundColor: 'var(--chart-fill)',
        },
      '.cm-gutters': {
        backgroundColor: 'var(--bg-tertiary)',
        color: 'var(--text-quaternary)',
        border: 'none',
      },
      '.cm-lineNumbers .cm-gutterElement': {
        minWidth: '40px',
        padding: '0 8px 0 16px',
        fontVariantNumeric: 'tabular-nums',
      },
      '.cm-foldGutter .cm-gutterElement': {
        color: 'var(--text-quaternary)',
      },
      '.cm-activeLine': {
        backgroundColor: 'var(--accent-soft)',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'var(--accent-soft)',
        color: 'var(--text-primary)',
      },
      '.cm-selectionMatch': {
        backgroundColor: 'var(--bg-active)',
      },
      '.cm-searchMatch': {
        backgroundColor: 'var(--chart-fill)',
        outline: '1px solid var(--border-strong)',
        borderRadius: '2px',
      },
      '.cm-searchMatch.cm-searchMatch-selected': {
        backgroundColor: 'var(--accent-fill)',
        color: 'var(--accent-contrast)',
      },
      '.cm-searchMatch.cm-searchMatch-selected *': {
        color: 'var(--accent-contrast) !important',
      },
      '.cm-matchingBracket, .cm-nonmatchingBracket': {
        backgroundColor: 'var(--bg-active)',
        outline: 'none',
      },
      '.cm-foldPlaceholder': {
        border: 'none',
        borderRadius: '4px',
        backgroundColor: 'var(--bg-active)',
        color: 'var(--text-secondary)',
        padding: '0 6px',
      },
      '.cm-placeholder': {
        color: 'var(--text-quaternary)',
      },
      '.cm-panels': {
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
      },
      '.cm-panels.cm-panels-bottom': {
        borderTop: '1px solid var(--border-color)',
      },
      '.cm-panels.cm-panels-top': {
        borderBottom: '1px solid var(--border-color)',
      },
      '.cm-panel.cm-search': {
        padding: '8px 12px',
        fontFamily: 'inherit',
        fontSize: '13px',
      },
      '.cm-textfield': {
        border: 'none',
        borderRadius: '8px',
        padding: '4px 8px',
        backgroundColor: 'var(--bg-tertiary)',
        color: 'var(--text-primary)',
        fontSize: '13px',
      },
      '.cm-button': {
        border: 'none',
        borderRadius: '8px',
        padding: '4px 10px',
        backgroundImage: 'none',
        backgroundColor: 'var(--bg-tertiary)',
        color: 'var(--text-primary)',
        fontSize: '13px',
      },
      '.cm-tooltip': {
        border: 'none',
        borderRadius: '8px',
        backgroundColor: 'var(--floating-surface)',
        boxShadow: 'var(--floating-shadow)',
      },
    },
    { dark }
  );

const highlightStyle = HighlightStyle.define([
  {
    tag: [tags.propertyName, tags.definition(tags.propertyName)],
    color: 'var(--text-primary)',
    fontWeight: '500',
  },
  { tag: [tags.string, tags.special(tags.string), tags.content], color: 'var(--text-secondary)' },
  {
    tag: [tags.number, tags.bool, tags.null, tags.atom, tags.keyword],
    color: 'var(--text-primary)',
  },
  {
    tag: [tags.comment, tags.lineComment, tags.blockComment],
    color: 'var(--text-quaternary)',
    fontStyle: 'italic',
  },
  {
    tag: [tags.punctuation, tags.separator, tags.operator, tags.meta],
    color: 'var(--text-quaternary)',
  },
  { tag: [tags.labelName, tags.typeName, tags.tagName], color: 'var(--text-secondary)' },
  { tag: tags.invalid, color: 'var(--status-danger-text)' },
]);

const lightTheme: Extension = [baseTheme(false), syntaxHighlighting(highlightStyle)];
const darkTheme: Extension = [baseTheme(true), syntaxHighlighting(highlightStyle)];

export function configEditorTheme(theme: 'light' | 'dark'): Extension {
  return theme === 'dark' ? darkTheme : lightTheme;
}
