"use client"

import { Fragment, type ReactNode } from "react"

interface MarkdownPreviewProps {
  content: string
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }

    const token = match[0]
    if (token.startsWith("**")) {
      nodes.push(<strong key={`${match.index}-strong`}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith("`")) {
      nodes.push(
        <code className="rounded bg-subtle px-1 py-0.5 text-copy-primary" key={`${match.index}-code`}>
          {token.slice(1, -1)}
        </code>
      )
    } else {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)
      if (linkMatch) {
        nodes.push(
          <a
            className="text-brand underline underline-offset-2"
            href={linkMatch[2]}
            key={`${match.index}-link`}
            rel="noreferrer"
            target="_blank"
          >
            {linkMatch[1]}
          </a>
        )
      } else {
        nodes.push(token)
      }
    }

    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const lines = content.replace(/\r\n/g, "\n").split("\n")
  const blocks: ReactNode[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (!line.trim()) {
      index += 1
      continue
    }

    if (line.startsWith("```")) {
      const codeLines: string[] = []
      index += 1
      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index])
        index += 1
      }
      index += 1
      blocks.push(
        <pre
          className="overflow-x-auto rounded-xl border border-surface-border bg-subtle p-3 text-copy-primary"
          key={`code-${index}`}
        >
          <code>{codeLines.join("\n")}</code>
        </pre>
      )
      continue
    }

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(line)
    if (headingMatch) {
      const level = headingMatch[1].length
      const text = headingMatch[2]
      const className =
        level === 1
          ? "text-lg font-semibold text-copy-primary"
          : level === 2
            ? "text-base font-semibold text-copy-primary"
            : "text-sm font-semibold text-copy-primary"

      blocks.push(
        <p className={className} key={`heading-${index}`}>
          {renderInlineMarkdown(text)}
        </p>
      )
      index += 1
      continue
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^[-*]\s+/, ""))
        index += 1
      }

      blocks.push(
        <ul className="list-disc space-y-1 pl-5 text-copy-secondary" key={`ul-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={`ul-item-${itemIndex}`}>{renderInlineMarkdown(item)}</li>
          ))}
        </ul>
      )
      continue
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\.\s+/, ""))
        index += 1
      }

      blocks.push(
        <ol className="list-decimal space-y-1 pl-5 text-copy-secondary" key={`ol-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={`ol-item-${itemIndex}`}>{renderInlineMarkdown(item)}</li>
          ))}
        </ol>
      )
      continue
    }

    const paragraphLines: string[] = [line]
    index += 1
    while (index < lines.length && lines[index].trim() && !/^(#{1,3}\s|[-*]\s+|\d+\.\s+|```)/.test(lines[index])) {
      paragraphLines.push(lines[index])
      index += 1
    }

    blocks.push(
      <p className="text-copy-secondary" key={`p-${index}`}>
        {paragraphLines.map((paragraphLine, paragraphIndex) => (
          <Fragment key={`p-line-${paragraphIndex}`}>
            {paragraphIndex > 0 ? <br /> : null}
            {renderInlineMarkdown(paragraphLine)}
          </Fragment>
        ))}
      </p>
    )
  }

  return <div className="space-y-3 text-sm">{blocks}</div>
}
