export function Divider({ size = "2" }: { size?: string }) {
  const margin =
    size === "1"
      ? "var(--space-2)"
      : size === "3"
        ? "var(--space-4)"
        : "var(--space-3)";

  return (
    <hr
      style={{
        border: "none",
        borderTop: "1px solid var(--gray-6)",
        marginTop: margin,
        marginBottom: margin,
      }}
    />
  );
}
