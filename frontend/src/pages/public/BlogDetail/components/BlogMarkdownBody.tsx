import type { ReactNode } from "react";

interface BlogMarkdownBodyProps {
  markdown: string;
}

function formatInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

function renderMarkdownLines(markdown: string) {
  if (!markdown) return null;
  const lines = markdown.split(/\r?\n/);
  const elements: ReactNode[] = [];
  let currentBulletList: string[] = [];
  let currentNumberedList: string[] = [];
  let currentQuote: string[] = [];

  const flushBulletList = () => {
    if (currentBulletList.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="vh-blog-prose-ul">
          {currentBulletList.map((it, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(it) }} />
          ))}
        </ul>
      );
      currentBulletList = [];
    }
  };

  const flushNumberedList = () => {
    if (currentNumberedList.length > 0) {
      elements.push(
        <ol key={`ol-${elements.length}`} className="vh-blog-prose-ol">
          {currentNumberedList.map((it, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(it) }} />
          ))}
        </ol>
      );
      currentNumberedList = [];
    }
  };

  const flushQuote = () => {
    if (currentQuote.length > 0) {
      elements.push(
        <blockquote key={`quote-${elements.length}`} className="vh-blog-prose-blockquote">
          {currentQuote.map((it, i) => (
            <p key={i} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(it) }} />
          ))}
        </blockquote>
      );
      currentQuote = [];
    }
  };

  const flushAll = () => {
    flushBulletList();
    flushNumberedList();
    flushQuote();
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushAll();
      return;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      flushNumberedList();
      flushQuote();
      currentBulletList.push(trimmed.substring(2));
    } else if (/^\d+\.\s+/.test(trimmed)) {
      flushBulletList();
      flushQuote();
      currentNumberedList.push(trimmed.replace(/^\d+\.\s+/, ""));
    } else if (trimmed.startsWith(">")) {
      flushBulletList();
      flushNumberedList();
      currentQuote.push(trimmed.replace(/^>\s*/, ""));
    } else {
      flushAll();
      if (trimmed.startsWith("# ")) {
        elements.push(<h1 key={index} className="vh-blog-prose-h1" dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(trimmed.replace(/^#\s+/, "")) }} />);
      } else if (trimmed.startsWith("## ")) {
        elements.push(<h2 key={index} className="vh-blog-prose-h2" dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(trimmed.replace(/^##\s+/, "")) }} />);
      } else if (trimmed.startsWith("### ")) {
        elements.push(<h3 key={index} className="vh-blog-prose-h3" dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(trimmed.replace(/^###\s+/, "")) }} />);
      } else if (trimmed.startsWith("#### ")) {
        elements.push(<h4 key={index} className="vh-blog-prose-h4" dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(trimmed.replace(/^####\s+/, "")) }} />);
      } else {
        elements.push(<p key={index} className="vh-blog-prose-p" dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(trimmed) }} />);
      }
    }
  });

  flushAll();
  return elements;
}

export function BlogMarkdownBody({ markdown }: BlogMarkdownBodyProps) {
  return <div className="vh-blog-markdown-prose">{renderMarkdownLines(markdown)}</div>;
}
