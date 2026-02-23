import type { ReactNode } from "react";

export function List({
  children,
  as = "ul",
}: {
  children: ReactNode;
  as?: "ul" | "ol";
  size?: string;
}) {
  const Component = as;
  return (
    <Component
      style={{
        margin: 0,
        marginTop: "var(--space-2)",
        paddingLeft: as === "ol" ? "var(--space-5)" : "var(--space-4)",
        marginBottom: "var(--space-3)",
        listStyleType: as === "ol" ? "decimal" : "disc",
        listStylePosition: "outside",
      }}
    >
      {children}
    </Component>
  );
}

export function ListItem({ children }: { children: ReactNode; size?: string }) {
  return (
    <li
      style={{
        fontSize: "var(--font-size-1)",
        lineHeight: "var(--line-height-1)",
        marginBottom: "var(--space-1)",
        color: "var(--gray-12)",
      }}
    >
      {children}
    </li>
  );
}
