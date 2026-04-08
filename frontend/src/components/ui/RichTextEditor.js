'use client'
import { useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TiptapLink from '@tiptap/extension-link'
import TiptapImage from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import {
  RiBold, RiItalic, RiStrikethrough, RiUnderline,
  RiListUnordered, RiListOrdered,
  RiLink, RiLinkUnlink,
  RiImage2Line, RiSeparator,
  RiDoubleQuotesL, RiCodeLine, RiCodeBoxLine,
  RiArrowGoBackLine, RiArrowGoForwardLine,
} from 'react-icons/ri'
import styles from './RichTextEditor.module.css'
 
// ── Sub-components ────────────────────────────────────────────────────────────
function ToolBtn({ onClick, active, title, children, disabled }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={e => { e.preventDefault(); onClick() }}
      className={`${styles.toolBtn} ${active ? styles.toolBtnActive : ''}`}
    >
      {children}
    </button>
  )
}
 
function HeadingBtn({ editor, level }) {
  const active = editor.isActive('heading', { level })
  return (
    <button
      type="button"
      title={`Heading ${level}`}
      onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level }).run() }}
      className={`${styles.toolBtn} ${active ? styles.toolBtnActive : ''}`}
    >
      H{level}
    </button>
  )
}
 
function Sep() {
  return <div className={styles.sep} />
}
 
// ── Main export ───────────────────────────────────────────────────────────────
export default function RichTextEditor({
  content,
  onChange,
  minHeight = 200,
  placeholder = 'Start writing…',
  fullPage = false,
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TiptapLink.configure({ openOnClick: false, autolink: true }),
      TiptapImage.configure({ inline: false, allowBase64: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: content || '',
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })
 
  const handleLink = useCallback(() => {
    if (!editor) return
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run()
    } else {
      const url = window.prompt('Enter URL (e.g. https://example.com):')
      if (url?.trim()) editor.chain().focus().setLink({ href: url.trim(), target: '_blank' }).run()
    }
  }, [editor])
 
  const handleImage = useCallback(() => {
    if (!editor) return
    const url = window.prompt('Paste image URL:')
    if (url?.trim()) editor.chain().focus().setImage({ src: url.trim() }).run()
  }, [editor])
 
  if (!editor) return null
 
  const toolbarClass = fullPage
    ? `${styles.toolbar} ${styles.toolbarFull}`
    : styles.toolbar
 
  const editorAreaClass = fullPage
    ? `${styles.editorArea} ${styles.editorAreaFull}`
    : styles.editorArea
 
  return (
    <div className={styles.wrapper}>
      {/* ── Toolbar ── */}
      <div className={toolbarClass}>
 
        {/* History */}
        <ToolBtn title="Undo (Ctrl+Z)" active={false}
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}>
          <RiArrowGoBackLine size={14} />
        </ToolBtn>
        <ToolBtn title="Redo (Ctrl+Shift+Z)" active={false}
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}>
          <RiArrowGoForwardLine size={14} />
        </ToolBtn>
 
        <Sep />
 
        {/* Text format */}
        <ToolBtn title="Bold (Ctrl+B)" active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}>
          <RiBold size={14} />
        </ToolBtn>
        <ToolBtn title="Italic (Ctrl+I)" active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}>
          <RiItalic size={14} />
        </ToolBtn>
        <ToolBtn title="Underline (Ctrl+U)" active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <RiUnderline size={14} />
        </ToolBtn>
        <ToolBtn title="Strikethrough" active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}>
          <RiStrikethrough size={14} />
        </ToolBtn>
 
        <Sep />
 
        {/* Headings */}
        <HeadingBtn editor={editor} level={1} />
        <HeadingBtn editor={editor} level={2} />
        <HeadingBtn editor={editor} level={3} />
 
        <Sep />
 
        {/* Lists */}
        <ToolBtn title="Bullet list" active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <RiListUnordered size={15} />
        </ToolBtn>
        <ToolBtn title="Numbered list" active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <RiListOrdered size={15} />
        </ToolBtn>
 
        <Sep />
 
        {/* Blocks */}
        <ToolBtn title="Blockquote" active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <RiDoubleQuotesL size={14} />
        </ToolBtn>
        <ToolBtn title="Inline code" active={editor.isActive('code')}
          onClick={() => editor.chain().focus().toggleCode().run()}>
          <RiCodeLine size={14} />
        </ToolBtn>
        <ToolBtn title="Code block" active={editor.isActive('codeBlock')}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          <RiCodeBoxLine size={14} />
        </ToolBtn>
        <ToolBtn title="Horizontal rule" active={false}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <RiSeparator size={14} />
        </ToolBtn>
 
        <Sep />
 
        {/* Link / Image */}
        <ToolBtn
          title={editor.isActive('link') ? 'Remove link' : 'Add link'}
          active={editor.isActive('link')}
          onClick={handleLink}>
          {editor.isActive('link') ? <RiLinkUnlink size={14} /> : <RiLink size={14} />}
        </ToolBtn>
        <ToolBtn title="Insert image (URL)" active={false} onClick={handleImage}>
          <RiImage2Line size={14} />
        </ToolBtn>
      </div>
 
      {/* ── Editor area ── */}
      <div
        className={editorAreaClass}
        style={{ minHeight }}
        onClick={() => editor.commands.focus()}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}