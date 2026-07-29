import type { TextBlock, TextBlockStyle } from "@/lib/pdf/paginator";
import { getPageBlocks, type PaginatedPage } from "@/lib/pdf/paginator";

function BlockView({
  block,
  fontSize,
}: {
  block: TextBlock;
  fontSize: number;
}) {
  const style: TextBlockStyle = block.style;

  if (style === "title") {
    return (
      <h2 className="book-title" style={{ fontSize: fontSize + 4 }}>
        {block.text}
      </h2>
    );
  }

  if (style === "subtitle") {
    return (
      <p className="book-subtitle" style={{ fontSize: fontSize + 1 }}>
        {block.text}
      </p>
    );
  }

  if (style === "list-item") {
    return (
      <p className="book-list-item" style={{ fontSize }}>
        {block.text}
      </p>
    );
  }

  if (style === "heading") {
    return (
      <h2 className="book-heading" style={{ fontSize: fontSize + 3 }}>
        {block.text}
      </h2>
    );
  }

  return (
    <p
      className={block.continued ? "book-para book-para-continued" : "book-para"}
      style={{ fontSize }}
    >
      {block.text}
    </p>
  );
}

export function PageContent({
  page,
  fontSize,
}: {
  page: PaginatedPage | null;
  fontSize: number;
}) {
  if (!page) return null;

  const blocks = getPageBlocks(page);
  return (
    <>
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} fontSize={fontSize} />
      ))}
    </>
  );
}
