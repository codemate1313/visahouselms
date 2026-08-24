import type { ReactNode } from "react";

interface BlogMarkdownBodyProps {
  markdown: string;
}

const INLINE_MARKDOWN = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|\*([^*]+)\*)/g;

function safeHref(href: string) {
  const trimmed = href.trim();
  if (/^(https?:|mailto:|tel:|\/)/i.test(trimmed)) return trimmed;
  return "#";
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  INLINE_MARKDOWN.lastIndex = 0;

  while ((match = INLINE_MARKDOWN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const key = `${match.index}-${match[0]}`;
    if (match[2]) {
      nodes.push(<strong key={key}>{match[2]}</strong>);
    } else if (match[3]) {
      nodes.push(<code key={key}>{match[3]}</code>);
    } else if (match[4] && match[5]) {
      nodes.push(
        <a key={key} href={safeHref(match[5])} target="_blank" rel="noopener noreferrer">
          {match[4]}
        </a>,
      );
    } else if (match[6]) {
      nodes.push(<em key={key}>{match[6]}</em>);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
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
            <li key={i}>{renderInlineMarkdown(it)}</li>
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
            <li key={i}>{renderInlineMarkdown(it)}</li>
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
            <p key={i}>{renderInlineMarkdown(it)}</p>
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
        elements.push(<h1 key={index} className="vh-blog-prose-h1">{renderInlineMarkdown(trimmed.replace(/^#\s+/, ""))}</h1>);
      } else if (trimmed.startsWith("## ")) {
        elements.push(<h2 key={index} className="vh-blog-prose-h2">{renderInlineMarkdown(trimmed.replace(/^##\s+/, ""))}</h2>);
      } else if (trimmed.startsWith("### ")) {
        elements.push(<h3 key={index} className="vh-blog-prose-h3">{renderInlineMarkdown(trimmed.replace(/^###\s+/, ""))}</h3>);
      } else if (trimmed.startsWith("#### ")) {
        elements.push(<h4 key={index} className="vh-blog-prose-h4">{renderInlineMarkdown(trimmed.replace(/^####\s+/, ""))}</h4>);
      } else {
        elements.push(<p key={index} className="vh-blog-prose-p">{renderInlineMarkdown(trimmed)}</p>);
      }
    }
  });

  flushAll();
  return elements;
}

export function BlogMarkdownBody({ markdown }: BlogMarkdownBodyProps) {
  return <div className="vh-blog-markdown-prose">{renderMarkdownLines(markdown)}</div>;
}
