import React, { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import CharacterCount from '@tiptap/extension-character-count';
import Highlight from '@tiptap/extension-highlight';
import MediaLibrary from './MediaLibrary.jsx';
import { IconCheck } from './Icons.jsx';

const Btn = ({ active, onClick, title, children, disabled }) => (
  <button
    type="button"
    title={title}
    disabled={disabled}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={`grid h-9 w-9 place-items-center rounded-lg text-sm font-bold transition-colors ${
      active ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-brand-50 hover:text-brand-700'
    } disabled:opacity-40`}
  >
    {children}
  </button>
);

const Sep = () => <span className="mx-1 h-6 w-px bg-ink-100" />;


export default function RichTextEditor({ value, onChange, placeholder = 'Rédigez votre article…' }) {
  const [libOpen, setLibOpen] = useState(false);
  const [libMode, setLibMode] = useState('image');
  const [preview, setPreview] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
      Underline,
      Highlight,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer' }
      }),
      Image.configure({ allowBase64: false }),
      Placeholder.configure({ placeholder }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      CharacterCount
    ],
    content: value || '',
    editorProps: {
      attributes: { class: 'prose-editor min-h-[340px] max-w-none px-6 py-5 text-[15px] leading-relaxed text-ink-800 focus:outline-none' }
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML())
  });

  if (!editor) return <div className="min-h-[340px] animate-pulse rounded-2xl bg-ink-50" />;

  const words = editor.storage.characterCount.words();
  const chars = editor.storage.characterCount.characters();

  const setLink = (url) => {
    if (!url) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
    setLinkUrl('');
  };

  const insertPdf = (url, filename = '') => {
    const selected = editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to,
      ' '
    ).trim();
    const base = String(filename || 'Document').replace(/\.pdf$/i, '');
    if (selected) {
      editor.chain().focus().extendMarkRange('link').setLink({
        href: url,
        target: '_blank',
        class: 'doc-pdf'
      }).run();
      return;
    }
    const label = `📄 ${base} (PDF)`;
    const safeUrl = String(url).replace(/"/g, '&quot;');
    const safeLabel = String(label)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    editor.chain().focus().insertContent(
      `<p><a href="${safeUrl}" class="doc-pdf" target="_blank" rel="noopener noreferrer">${safeLabel}</a></p>`
    ).run();
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white">
      {}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-ink-100 bg-cream/60 px-3 py-2">
        <Btn title="Titre" active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Btn>
        <Btn title="Sous-titre" active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</Btn>
        <Sep />
        <Btn title="Gras" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <span className="font-black">G</span>
        </Btn>
        <Btn title="Italique" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <span className="italic font-serif">I</span>
        </Btn>
        <Btn title="Souligné" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <span className="underline">S</span>
        </Btn>
        <Btn title="Barré" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <span className="line-through">B</span>
        </Btn>
        <Btn title="Surligner" active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight().run()}>
          <span className="rounded bg-accent-200 px-1">A</span>
        </Btn>
        <Btn title="Texte en code" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>
          &lt;/&gt;
        </Btn>
        <Sep />
        <Btn title="Liste à puces" active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}>•≡</Btn>
        <Btn title="Liste numérotée" active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</Btn>
        <Btn title="Citation" active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝</Btn>
        <Btn title="Bloc de code" active={editor.isActive('codeBlock')}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}>{"{ }"}</Btn>
        <Btn title="Ligne de séparation" onClick={() => editor.chain().focus().setHorizontalRule().run()}>—</Btn>
        <Sep />
        <Btn title="Aligner à gauche" active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}>⯇</Btn>
        <Btn title="Centrer" active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}>≡</Btn>
        <Btn title="Aligner à droite" active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}>⯈</Btn>
        <Sep />
        <Btn title="Insérer un lien" active={editor.isActive('link')}
          onClick={() => {
            if (editor.isActive('link')) setLink('');
            else {
              const url = prompt('URL du lien (https://…) :', 'https://');
              if (url && url !== 'https://') setLink(url);
            }
          }}>
          🔗
        </Btn>
        <button
          type="button"
          title="Insérer une image depuis la bibliothèque"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { setLibMode('image'); setLibOpen(true); }}
          className="rounded-lg px-2.5 py-2 text-sm font-bold text-ink-600 hover:bg-brand-50 hover:text-brand-700"
        >
          🖼 Image
        </button>
        <button
          type="button"
          title="Importer un PDF et insérer son lien"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { setLibMode('pdf'); setLibOpen(true); }}
          className="rounded-lg px-2.5 py-2 text-sm font-bold text-ink-600 hover:bg-brand-50 hover:text-brand-700"
        >
          📄 PDF
        </button>
        <button
          type="button"
          title="Insérer une image par URL"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const url = prompt('URL de l\'image (https://…) :', 'https://');
            if (!url || url === 'https://') return;
            const alt = prompt('Texte alternatif (accessibilité) :', '') || '';
            editor
              .chain()
              .focus()
              .setImage({ src: url, alt: alt || undefined, class: 'rounded-2xl shadow-soft' })
              .run();
          }}
          className="rounded-lg px-2.5 py-2 text-xs font-bold text-ink-600 hover:bg-brand-50 hover:text-brand-700"
        >
          Image URL
        </button>
        <Sep />
        <Btn title="Annuler" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>↺</Btn>
        <Btn title="Rétablir" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>↻</Btn>
        <div className="ml-auto flex items-center gap-2">
          <span className="pr-2 text-[11px] font-semibold text-ink-400">{words} mots · {chars} car.</span>
          <button
            type="button"
            onClick={() => setPreview((v) => !v)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
              preview ? 'bg-brand-600 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:ring-brand-300'
            }`}
          >
            {preview ? '✎ Éditer' : '👁 Aperçu'}
          </button>
        </div>
      </div>

      {}
      {editor.isActive('link') && (
        <div className="flex items-center gap-2 border-b border-ink-100 bg-accent-50 px-4 py-2">
          <span className="text-xs font-bold text-accent-800">Lien :</span>
          <input
            className="input !w-72 !px-3 !py-1.5 text-sm"
            defaultValue={editor.getAttributes('link').href || ''}
            placeholder="https://…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); setLink(e.target.value); }
              if (e.key === 'Escape') setLink('');
            }}
          />
          <button type="button" onClick={() => setLink('')} className="text-xs font-bold text-red-600 hover:underline">
            Retirer le lien
          </button>
        </div>
      )}

      {}
      {preview ? (
        <div className="prose-adi min-h-[340px] max-w-none px-6 py-5" dangerouslySetInnerHTML={{ __html: editor.getHTML() || '<p class="italic">Aperçu : rien à afficher pour le moment.</p>' }} />
      ) : (
        <EditorContent editor={editor} />
      )}

      {}
      <MediaLibrary
        open={libOpen}
        onClose={() => setLibOpen(false)}
        accept={libMode}
        onPick={(url, extra) => {
          if (libMode === 'pdf') insertPdf(url, extra);
          else {
            editor
              .chain()
              .focus()
              .setImage({ src: url, alt: extra || undefined, class: 'rounded-2xl shadow-soft' })
              .run();
          }
          setLibOpen(false);
        }}
      />
    </div>
  );
}
