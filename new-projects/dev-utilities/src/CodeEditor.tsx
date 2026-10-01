import { useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { yaml } from "@codemirror/lang-yaml";
import { javascript } from "@codemirror/lang-javascript";
import {
  Decoration,
  EditorView,
  keymap,
  type DecorationSet,
} from "@codemirror/view";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
import { lintGutter, setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import type { Lang } from "./prefs";
export type Language = "json" | "yaml" | "typescript" | "text";
export type Range = { from: number; to: number };

// Query matches are drawn as marks; they are replaced as a whole on each update.
const setMarks = StateEffect.define<Range[]>();
const matchMark = Decoration.mark({ class: "cm-query-match" });
const marksField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(marks, tr) {
    marks = marks.map(tr.changes);
    for (const effect of tr.effects)
      if (effect.is(setMarks))
        marks = Decoration.set(
          effect.value
            .filter((r) => r.to > r.from && r.to <= tr.state.doc.length)
            .map((r) => matchMark.range(r.from, r.to)),
          true,
        );
    return marks;
  },
  provide: (field) => EditorView.decorations.from(field),
});
const languages = {
  json: () => [json()],
  yaml: () => [yaml()],
  typescript: () => [javascript({ typescript: true })],
  text: () => [],
};

export type EditorHandle = {
  focusRange: (offset: number, length?: number, focus?: boolean) => void;
};
// Colours come from the theme tokens, so one editor theme serves both modes.
const theme = EditorView.theme({
  "&": {
    backgroundColor: "var(--surface)",
    color: "var(--text)",
    fontSize: "13px",
    height: "100%",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
    lineHeight: "20px",
    overflow: "auto",
  },
  ".cm-content": { padding: "8px 0", caretColor: "var(--text)" },
  ".cm-line": { padding: "0 12px 0 8px" },
  ".cm-gutters": {
    backgroundColor: "var(--surface)",
    color: "var(--text-3)",
    border: "none",
    fontSize: "12px",
  },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 6px 0 12px" },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
    color: "var(--text)",
  },
  ".cm-activeLine": { backgroundColor: "var(--editor-active-line)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection":
    { backgroundColor: "var(--editor-selection) !important" },
  ".cm-cursor": { borderLeftColor: "var(--text)", borderLeftWidth: "1.5px" },
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--hover)",
    color: "var(--text-2)",
    border: "none",
    padding: "0 4px",
  },
  ".cm-foldGutter .cm-gutterElement": { color: "var(--text-3)" },
  ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
    backgroundColor: "var(--accent-soft-2)",
    outline: "none",
  },
  ".cm-selectionMatch": { backgroundColor: "var(--accent-soft)" },
  ".cm-query-match": {
    backgroundColor: "var(--accent-soft)",
    boxShadow: "inset 0 -2px 0 var(--accent)",
    borderRadius: "2px",
  },
  ".cm-searchMatch": { backgroundColor: "var(--editor-match)" },
  ".cm-searchMatch-selected": { outline: "1px solid var(--warn)" },
  ".cm-panels": {
    backgroundColor: "var(--surface-2)",
    color: "var(--text)",
    fontFamily: "var(--font-ui)",
  },
  ".cm-panels-top": { borderBottom: "1px solid var(--line)" },
  ".cm-panels-bottom": { borderTop: "1px solid var(--line)" },
  ".cm-panel input, .cm-panel button, .cm-panel label": { fontSize: "12.5px" },
  ".cm-textfield": {
    border: "1px solid var(--control-edge)",
    borderRadius: "4px",
    backgroundColor: "var(--surface)",
    color: "var(--text)",
    padding: "2px 6px",
  },
  ".cm-button": {
    backgroundImage: "none",
    backgroundColor: "var(--surface)",
    border: "1px solid var(--line-2)",
    borderRadius: "4px",
    color: "var(--text)",
    padding: "2px 8px",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--surface)",
    border: "1px solid var(--line-2)",
    borderRadius: "6px",
    color: "var(--text)",
    boxShadow: "var(--shadow-pop)",
    fontFamily: "var(--font-ui)",
  },
  ".cm-diagnostic": { padding: "4px 10px" },
  ".cm-diagnostic-error": { borderLeft: "3px solid var(--err)" },
  ".cm-lintRange-error": {
    backgroundImage: "none",
    textDecoration: "underline wavy var(--err)",
    textDecorationSkipInk: "none",
    textUnderlineOffset: "3px",
  },
  ".cm-lint-marker-error": { content: "none" },
  ".cm-gutter-lint": { width: "10px" },
  ".cm-gutter-lint .cm-gutterElement": { padding: "0" },
});
const highlights = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.propertyName, color: "var(--syn-key)" },
    { tag: tags.string, color: "var(--syn-string)" },
    { tag: tags.number, color: "var(--syn-number)" },
    { tag: [tags.bool, tags.null], color: "var(--syn-literal)" },
    { tag: [tags.keyword, tags.modifier], color: "var(--syn-literal)" },
    { tag: [tags.typeName, tags.className], color: "var(--syn-number)" },
    {
      tag: [tags.definition(tags.propertyName), tags.attributeName],
      color: "var(--syn-key)",
    },
    {
      tag: [tags.comment, tags.meta],
      color: "var(--text-3)",
      fontStyle: "italic",
    },
    {
      tag: [tags.punctuation, tags.separator, tags.brace, tags.squareBracket],
      color: "var(--syn-punct)",
    },
  ]),
);
const ruPhrases = EditorState.phrases.of({
  Find: "Найти",
  Replace: "Заменить",
  next: "далее",
  previous: "назад",
  all: "все",
  "match case": "учитывать регистр",
  regexp: "рег. выражение",
  "by word": "слово целиком",
  replace: "заменить",
  "replace all": "заменить все",
  close: "закрыть",
  "current match": "текущее совпадение",
  "on line": "в строке",
  "Go to line": "Перейти к строке",
  go: "перейти",
  "Folded lines": "Свёрнутые строки",
  "Unfolded lines": "Развёрнутые строки",
  to: "до",
  "folded code": "свёрнутый код",
  unfold: "развернуть",
  "Fold line": "Свернуть строку",
  "Unfold line": "Развернуть строку",
  Diagnostics: "Ошибки",
  "No diagnostics": "Ошибок нет",
});
const NO_MARKS: Range[] = [];
export function CodeEditor({
  value,
  onChange,
  label,
  lang = "en",
  diagnostics = [],
  onRun,
  handle,
  onCursor,
  language = "json",
  readOnly = false,
  marks = NO_MARKS,
}: {
  value: string;
  onChange: (s: string) => void;
  label: string;
  lang?: Lang;
  diagnostics?: Diagnostic[];
  onRun?: () => void;
  handle?: (h: EditorHandle) => void;
  onCursor?: (line: number, column: number) => void;
  language?: Language;
  readOnly?: boolean;
  marks?: Range[];
}) {
  const [view, setView] = useState<EditorView | null>(null);
  const refs = useRef({ onRun, onCursor });
  refs.current = { onRun, onCursor };
  const extensions = useMemo(
    () => [
      ...languages[language](),
      marksField,
      ...(readOnly ? [EditorState.readOnly.of(true)] : []),
      theme,
      highlights,
      EditorView.lineWrapping,
      lintGutter(),
      ...(lang === "ru" ? [ruPhrases] : []),
      EditorView.contentAttributes.of({ "aria-label": label }),
      keymap.of([
        {
          key: "Mod-Enter",
          run: () => {
            refs.current.onRun?.();
            return true;
          },
        },
      ]),
      EditorView.updateListener.of((update) => {
        if (update.selectionSet || update.docChanged) {
          const head = update.state.selection.main.head;
          const line = update.state.doc.lineAt(head);
          refs.current.onCursor?.(line.number, head - line.from + 1);
        }
      }),
    ],
    [label, lang, language, readOnly],
  );
  useEffect(() => {
    if (view) view.dispatch({ effects: setMarks.of(marks) });
  }, [view, marks]);
  useEffect(() => {
    if (view) {
      view.dispatch(
        setDiagnostics(
          view.state,
          diagnostics.map((d) => ({
            ...d,
            from: Math.min(d.from, view.state.doc.length),
            to: Math.min(d.to, view.state.doc.length),
          })),
        ),
      );
    }
  }, [view, diagnostics]);
  useEffect(() => {
    if (view && handle)
      handle({
        focusRange: (offset, length = 0, focus = true) => {
          const from = Math.max(0, Math.min(offset, view.state.doc.length));
          view.dispatch({
            selection: {
              anchor: from,
              head: Math.min(from + length, view.state.doc.length),
            },
            effects: EditorView.scrollIntoView(from, { y: "center" }),
          });
          if (focus) view.focus();
        },
      });
  }, [view, handle]);
  return (
    <CodeMirror
      value={value}
      height="100%"
      theme="none"
      extensions={extensions}
      onChange={onChange}
      onCreateEditor={setView}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: true,
        highlightActiveLineGutter: true,
        autocompletion: false,
        bracketMatching: true,
        closeBrackets: !readOnly,
        searchKeymap: true,
        highlightSelectionMatches: true,
        history: true,
      }}
    />
  );
}
