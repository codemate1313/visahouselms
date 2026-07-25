import type { ReactNode } from "react";

interface BlogMarkdownBodyProps {
  markdown: string;
}

function formatInlineMarkdown(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>");
}

function renderMarkdownLines(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  const elements: ReactNode[] = [];
  let currentList: string[] = [];

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`}>
          {currentList.map((it, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(it) }} />
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }

    if (trimmed.startsWith("- ")) {
      currentList.push(trimmed.substring(2));
    } else {
      flushList();
      if (trimmed.startsWith("# ")) {
        elements.push(<h1 key={index} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(trimmed.replace(/^#\s+/, "")) }} />);
      } else if (trimmed.startsWith("## ")) {
        elements.push(<h2 key={index} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(trimmed.replace(/^##\s+/, "")) }} />);
      } else if (trimmed.startsWith("### ")) {
        elements.push(<h3 key={index} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(trimmed.replace(/^###\s+/, "")) }} />);
      } else {
        elements.push(<p key={index} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(trimmed) }} />);
      }
    }
  });

  flushList();
  return elements;
}

export function BlogMarkdownBody({ markdown }: BlogMarkdownBodyProps) {
  return <div className="blog-markdown-body">{renderMarkdownLines(markdown)}</div>;
}
