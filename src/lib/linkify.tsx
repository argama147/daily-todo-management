import type { ReactNode } from "react";

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

export function renderTextWithLinks(text: string | undefined): ReactNode {
  if (!text) return text ?? "";

  const parts = text.split(URL_PATTERN);
  return parts.map((part, index) => {
    if (part.match(URL_PATTERN)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}
