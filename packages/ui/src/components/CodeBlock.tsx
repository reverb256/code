import type { ReactNode } from "react";

interface CodeBlockProps {
  children: ReactNode;
  size?: "1" | "2" | "3";
}

export function CodeBlock({ children }: CodeBlockProps) {
  return (
    <pre
      style={{
        margin: 0,
        marginBottom: "var(--space-3)",
        padding: "var(--space-3)",
        backgroundColor: "var(--gray-2)",
        borderRadius: "var(--radius-2)",
        border: "1px solid var(--gray-4)",
        fontFamily: "var(--code-font-family)",
        fontSize: "var(--font-size-1)",
        lineHeight: "var(--line-height-1)",
        color: "var(--gray-12)",
        overflowX: "auto",
        whiteSpace: "pre",
      }}
    >
      {children}
    </pre>
  );
}
