import { Blockquote, Checkbox, Code, Em, Kbd, Text } from "@radix-ui/themes";
import { memo, useMemo } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PluggableList } from "unified";
import { CodeBlock } from "./CodeBlock";
import { Divider } from "./Divider";
import { List, ListItem } from "./List";

interface MarkdownRendererProps {
  content: string;
  remarkPluginsOverride?: PluggableList;
}

function preprocessMarkdown(content: string): string {
  return content.replace(/\n([^\n].*)\n(---+|___+|\*\*\*+)\n/g, "\n$1\n\n$2\n");
}

const HeadingText = ({ children }: { children: React.ReactNode }) => (
  <Text as="p" size="2" mb="3" style={{ color: "var(--accent-11)" }}>
    <strong>{children}</strong>
  </Text>
);

export const baseComponents: Components = {
  h1: ({ children }) => <HeadingText>{children}</HeadingText>,
  h2: ({ children }) => <HeadingText>{children}</HeadingText>,
  h3: ({ children }) => <HeadingText>{children}</HeadingText>,
  h4: ({ children }) => <HeadingText>{children}</HeadingText>,
  h5: ({ children }) => <HeadingText>{children}</HeadingText>,
  h6: ({ children }) => <HeadingText>{children}</HeadingText>,
  p: ({ children, node }) => {
    const isStrongOnly =
      node?.children?.length === 1 &&
      node.children[0].type === "element" &&
      node.children[0].tagName === "strong";
    return (
      <Text as="p" size="1" mb={isStrongOnly ? "2" : "3"}>
        {children}
      </Text>
    );
  },
  blockquote: ({ children }) => (
    <Blockquote size="1" mb="3" style={{ borderColor: "var(--accent-6)" }}>
      {children}
    </Blockquote>
  ),
  code: ({ children, className }) => {
    const isInline = !className?.includes("language-");
    if (isInline) {
      return (
        <Code size="1" variant="ghost" style={{ color: "var(--accent-11)" }}>
          {children}
        </Code>
      );
    }
    return <code>{children}</code>;
  },
  pre: ({ children }) => <CodeBlock size="1">{children}</CodeBlock>,
  em: ({ children }) => (
    <Em style={{ fontSize: "var(--font-size-1)" }}>{children}</Em>
  ),
  i: ({ children }) => (
    <i style={{ fontSize: "var(--font-size-1)" }}>{children}</i>
  ),
  strong: ({ children }) => (
    <strong
      style={{ fontSize: "var(--font-size-1)", color: "var(--accent-11)" }}
    >
      {children}
    </strong>
  ),
  del: ({ children }) => (
    <del style={{ textDecoration: "line-through", color: "var(--gray-9)" }}>
      {children}
    </del>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        fontSize: "var(--font-size-1)",
        display: "inline-flex",
        alignItems: "center",
        gap: "2px",
        color: "var(--accent-11)",
        textDecoration: "underline",
      }}
    >
      {children}
    </a>
  ),
  kbd: ({ children }) => <Kbd size="1">{children}</Kbd>,
  ul: ({ children }) => <List as="ul">{children}</List>,
  ol: ({ children }) => <List as="ol">{children}</List>,
  li: ({ children }) => <ListItem>{children}</ListItem>,
  hr: () => <Divider size="3" />,
  input: ({ type, checked }) => {
    if (type === "checkbox") {
      return (
        <Checkbox
          checked={checked}
          size="1"
          style={{ marginRight: "var(--space-2)", verticalAlign: "middle" }}
        />
      );
    }
    return <input type={type} />;
  },
  table: ({ children }) => (
    <table
      className="mb-3"
      style={{ fontSize: "var(--font-size-1)", borderCollapse: "collapse" }}
    >
      {children}
    </table>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr style={{ borderBottom: "1px solid var(--gray-6)" }}>{children}</tr>
  ),
  th: ({ children, style }) => (
    <th
      style={{
        ...style,
        padding: "4px 8px",
        textAlign: "left",
        color: "var(--gray-11)",
      }}
    >
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td style={{ ...style, padding: "4px 8px", color: "var(--gray-12)" }}>
      {children}
    </td>
  ),
};

export const defaultRemarkPlugins = [remarkGfm];

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  remarkPluginsOverride,
}: MarkdownRendererProps) {
  const processedContent = useMemo(
    () => preprocessMarkdown(content),
    [content],
  );
  const plugins = remarkPluginsOverride ?? defaultRemarkPlugins;
  return (
    <ReactMarkdown remarkPlugins={plugins} components={baseComponents}>
      {processedContent}
    </ReactMarkdown>
  );
});
