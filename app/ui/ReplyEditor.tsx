'use client';
import { useEffect, useId } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TableKit } from '@tiptap/extension-table';
import Placeholder from '@tiptap/extension-placeholder';

type Props = { label: string; value: string; onChange: (value: string) => void; autoFocus?: boolean; placeholder?: string };
export default function ReplyEditor({ label, value, onChange, autoFocus, placeholder }: Props) {
  const labelId = useId();
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ link: { openOnClick: false } }), TableKit, Markdown, Placeholder.configure({ placeholder: placeholder || 'Write here...' })],
    content: value, contentType: 'markdown', autofocus: autoFocus ? 'end' : false,
    editorProps: { attributes: { role: 'textbox', 'aria-multiline': 'true', 'aria-labelledby': labelId, 'aria-describedby': `${labelId}-count` } },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : editor.getMarkdown()),
  });
  const state = useEditorState({ editor, selector: ctx => ({
    bold: ctx.editor?.isActive('bold') ?? false, italic: ctx.editor?.isActive('italic') ?? false,
    bullet: ctx.editor?.isActive('bulletList') ?? false, ordered: ctx.editor?.isActive('orderedList') ?? false,
    table: ctx.editor?.isActive('table') ?? false,
  }) });
  useEffect(() => {
    if (editor && value !== editor.getMarkdown()) editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false });
  }, [value, editor]);
  if (!editor) return <div className='reply-editor'><label>{label}</label></div>;
  return <div className='reply-editor'>
    <label id={labelId}>{label}</label>
    <div className='format-toolbar' role='toolbar' aria-label='Text formatting'>
      <button type='button' aria-label='Bold' aria-pressed={state?.bold} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleBold().run()}><strong>B</strong></button>
      <button type='button' aria-label='Italic' aria-pressed={state?.italic} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleItalic().run()}><em>I</em></button>
      <button type='button' aria-label='Bulleted list' aria-pressed={state?.bullet} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</button>
      <button type='button' aria-label='Numbered list' aria-pressed={state?.ordered} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</button>
      <button type='button' disabled={state?.table} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run()}>Table</button>
      {state?.table && <><button type='button' onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().addRowAfter().run()}>Add row</button><button type='button' onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().addColumnAfter().run()}>Add column</button><button type='button' onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().deleteTable().run()}>Remove table</button></>}
    </div>
    <EditorContent editor={editor} className='visual-editor' />
    <div className='editor-meta'>
      <span id={`${labelId}-count`} className={value.length > 2000 ? 'editor-count over-limit' : 'editor-count'}>{value.length.toLocaleString()} / 2,000 · {value.length > 2000 ? `${(value.length - 2000).toLocaleString()} over` : `${(2000 - value.length).toLocaleString()} remaining`}</span>
    </div>
  </div>;
}
