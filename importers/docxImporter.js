function stripHtml(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeDocxTextFallback(buffer) {
  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  const cleaned = decoded
    .replace(/[\u0000-\u001F]+/g, " ")
    .replace(/[^\p{L}\p{N}\p{P}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length > 60) {
    return cleaned;
  }

  return "";
}

function splitParagraphs(text) {
  return String(text || "")
    .split(/\n{2,}|\.(?=\s+[A-ZÀ-Ü])/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

function chunkParagraphs(paragraphs, maxChars = 1800) {
  const pages = [];
  let current = [];
  let count = 0;

  paragraphs.forEach((paragraph) => {
    if (count + paragraph.length > maxChars && current.length) {
      pages.push(current);
      current = [];
      count = 0;
    }
    current.push(paragraph);
    count += paragraph.length;
  });

  if (current.length) {
    pages.push(current);
  }

  if (!pages.length) {
    pages.push(["Page importée vide."]);
  }

  return pages;
}

function buildFramesFromParagraphs(paragraphs, options, pageNumber) {
  const joined = paragraphs.join("\n\n");
  const blocks = [];

  const title = paragraphs[0] || `Import page ${pageNumber}`;
  blocks.push({
    id: `frame-${Math.random().toString(36).slice(2, 8)}`,
    type: "text",
    x: 8,
    y: 8,
    w: 84,
    h: 12,
    layer: "text",
    styleId: options.mappedStyle,
    content: title,
    imported: true,
    importedFrom: options.sourceType
  });

  blocks.push({
    id: `frame-${Math.random().toString(36).slice(2, 8)}`,
    type: "text",
    x: 8,
    y: 22,
    w: 84,
    h: 66,
    layer: "text",
    styleId: options.mappedStyle,
    content: joined,
    imported: true,
    importedFrom: options.sourceType
  });

  if (/\|/.test(joined)) {
    blocks.push({
      id: `frame-${Math.random().toString(36).slice(2, 8)}`,
      type: "table",
      x: 8,
      y: 76,
      w: 84,
      h: 16,
      layer: "tables",
      content: "Table détectée",
      imported: true,
      importedFrom: options.sourceType
    });
  }

  const imageTokens = joined.match(/!\[[^\]]*\]\([^)]*\)|\[image\]/gi) || [];
  imageTokens.slice(0, 2).forEach((_, index) => {
    blocks.push({
      id: `frame-${Math.random().toString(36).slice(2, 8)}`,
      type: "image",
      x: 58 + index * 18,
      y: 24,
      w: 16,
      h: 18,
      layer: "images",
      content: `Image ${index + 1}`,
      imported: true,
      importedFrom: options.sourceType
    });
  });

  if (blocks.length > 2) {
    blocks[1].nextFrameId = blocks[2].id;
  }

  return blocks;
}

export async function buildDocxImportPages(file, options) {
  const sourceType = file.name.toLowerCase().endsWith(".docx") ? "docx" : "text";
  let text = "";

  if (/\.html?$/.test(file.name.toLowerCase())) {
    text = stripHtml(await file.text());
  } else if (/\.md$|\.txt$/.test(file.name.toLowerCase())) {
    text = await file.text();
  } else {
    const buffer = await file.arrayBuffer();
    text = decodeDocxTextFallback(buffer);
  }

  if (!text) {
    text = `Contenu importé depuis ${file.name}.`;
  }

  const paragraphs = splitParagraphs(text);
  const pagesContent = chunkParagraphs(paragraphs, 1800);

  const selectedNumbers =
    options.selectedNumbers?.length
      ? options.selectedNumbers.filter((number) => number >= 1 && number <= pagesContent.length)
      : Array.from({ length: pagesContent.length }, (_, index) => index + 1);

  const pages = selectedNumbers.map((pageNumber) => ({
    source: sourceType,
    pageNumber,
    frames: buildFramesFromParagraphs(pagesContent[pageNumber - 1] || ["Page vide"], {
      ...options,
      sourceType
    }, pageNumber),
    backgroundReference: null
  }));

  return {
    estimatedPages: pagesContent.length,
    pages
  };
}
