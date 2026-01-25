import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { Button } from '@/components/ui/button';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  List, 
  ListOrdered,
  Undo,
  Redo
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  className?: string;
  placeholder?: string;
}

export function RichTextEditor({ content, onChange, className, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Underline,
    ],
    content: convertPlainTextToHtml(content),
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(convertHtmlToPlainText(html));
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[200px] p-3 focus:outline-none',
      },
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <div className={cn("border rounded-md bg-background flex flex-col max-h-[70vh]", className)}>
      <div className="flex items-center gap-1 p-2 border-b bg-muted/30 flex-wrap sticky top-0 z-10">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn("h-8 w-8 p-0", editor.isActive('bold') && "bg-muted")}
          data-testid="button-bold"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn("h-8 w-8 p-0", editor.isActive('italic') && "bg-muted")}
          data-testid="button-italic"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={cn("h-8 w-8 p-0", editor.isActive('underline') && "bg-muted")}
          data-testid="button-underline"
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn("h-8 w-8 p-0", editor.isActive('bulletList') && "bg-muted")}
          data-testid="button-bullet-list"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn("h-8 w-8 p-0", editor.isActive('orderedList') && "bg-muted")}
          data-testid="button-ordered-list"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="h-8 w-8 p-0"
          data-testid="button-undo"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="h-8 w-8 p-0"
          data-testid="button-redo"
        >
          <Redo className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground mr-2">
          Roman numerals: i. ii. iii. | Letters: a. b. c.
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function convertPlainTextToHtml(text: string): string {
  if (!text) return '<p></p>';
  
  const lines = text.split('\n');
  let html = '';
  let inList = false;
  let listType = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (/^(i{1,3}|iv|v|vi{0,3}|ix|x)\.\s+/.test(trimmed)) {
      if (!inList || listType !== 'ol') {
        if (inList) html += `</${listType}>`;
        html += '<ol>';
        inList = true;
        listType = 'ol';
      }
      html += `<li>${trimmed.replace(/^(i{1,3}|iv|v|vi{0,3}|ix|x)\.\s+/, '')}</li>`;
    } else if (/^[a-z]\.\s+/.test(trimmed)) {
      if (!inList || listType !== 'ol') {
        if (inList) html += `</${listType}>`;
        html += '<ol>';
        inList = true;
        listType = 'ol';
      }
      html += `<li>${trimmed.replace(/^[a-z]\.\s+/, '')}</li>`;
    } else if (/^[-•]\s+/.test(trimmed)) {
      if (!inList || listType !== 'ul') {
        if (inList) html += `</${listType}>`;
        html += '<ul>';
        inList = true;
        listType = 'ul';
      }
      html += `<li>${trimmed.replace(/^[-•]\s+/, '')}</li>`;
    } else {
      if (inList) {
        html += `</${listType}>`;
        inList = false;
        listType = '';
      }
      if (trimmed) {
        let formattedLine = trimmed
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/\*([^*]+)\*/g, '<em>$1</em>')
          .replace(/__([^_]+)__/g, '<u>$1</u>');
        html += `<p>${formattedLine}</p>`;
      } else {
        html += '<p></p>';
      }
    }
  }
  
  if (inList) {
    html += `</${listType}>`;
  }
  
  return html || '<p></p>';
}

function convertHtmlToPlainText(html: string): string {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  let result = '';
  let romanCounter = 0;
  const romanNumerals = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'];
  
  function processNode(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();
      
      switch (tagName) {
        case 'strong':
        case 'b':
          result += '**';
          element.childNodes.forEach(processNode);
          result += '**';
          break;
        case 'em':
        case 'i':
          result += '*';
          element.childNodes.forEach(processNode);
          result += '*';
          break;
        case 'u':
          result += '__';
          element.childNodes.forEach(processNode);
          result += '__';
          break;
        case 'p':
          element.childNodes.forEach(processNode);
          result += '\n';
          break;
        case 'br':
          result += '\n';
          break;
        case 'ol':
          romanCounter = 0;
          element.childNodes.forEach(child => {
            if ((child as Element).tagName?.toLowerCase() === 'li') {
              const numeral = romanNumerals[romanCounter] || `${romanCounter + 1}`;
              result += `${numeral}. `;
              child.childNodes.forEach(processNode);
              result += '\n';
              romanCounter++;
            }
          });
          break;
        case 'ul':
          element.childNodes.forEach(child => {
            if ((child as Element).tagName?.toLowerCase() === 'li') {
              result += '- ';
              child.childNodes.forEach(processNode);
              result += '\n';
            }
          });
          break;
        case 'li':
          break;
        default:
          element.childNodes.forEach(processNode);
      }
    }
  }
  
  tempDiv.childNodes.forEach(processNode);
  
  return result.trim();
}

export default RichTextEditor;
