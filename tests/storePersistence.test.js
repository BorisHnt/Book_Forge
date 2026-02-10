import test from "node:test";
import assert from "node:assert/strict";

import { createDefaultDocument } from "../core/document.js";
import { sanitizeDocumentForStorage } from "../core/store.js";

function makeDataUrl(char, size = 200_000) {
  return `data:image/png;base64,${char.repeat(size)}`;
}

test("sanitizeDocumentForStorage supprime les rasters PDF persistés", () => {
  const doc = createDefaultDocument();
  doc.pages[0].imported = { source: "pdf" };
  doc.pages[0].backgroundReference = {
    mode: "reference",
    dataUrl: makeDataUrl("A")
  };
  doc.pages[0].frames = [
    {
      id: "frame-pdf",
      type: "image",
      x: 5,
      y: 5,
      w: 90,
      h: 90,
      src: makeDataUrl("B"),
      importedFrom: "pdf"
    }
  ];

  const result = sanitizeDocumentForStorage(doc);

  assert.equal(result.document.pages[0].backgroundReference.dataUrl, "");
  assert.equal(result.document.pages[0].frames[0].src, "");
  assert.ok(result.stats.droppedDataUrls >= 2);
});

test("sanitizeDocumentForStorage conserve les petites dataUrl non PDF", () => {
  const doc = createDefaultDocument();
  doc.pages[0].frames = [
    {
      id: "frame-inline",
      type: "image",
      x: 5,
      y: 5,
      w: 90,
      h: 90,
      src: "data:image/png;base64,abc123"
    }
  ];

  const result = sanitizeDocumentForStorage(doc);

  assert.equal(result.document.pages[0].frames[0].src, "data:image/png;base64,abc123");
  assert.equal(result.stats.droppedDataUrls, 0);
});

test("sanitizeDocumentForStorage dropAllDataUrls supprime toutes les dataUrl", () => {
  const doc = createDefaultDocument();
  doc.pages[0].frames = [
    {
      id: "frame-inline",
      type: "image",
      x: 5,
      y: 5,
      w: 90,
      h: 90,
      src: "data:image/png;base64,abc123"
    }
  ];

  const result = sanitizeDocumentForStorage(doc, { dropAllDataUrls: true });

  assert.equal(result.document.pages[0].frames[0].src, "");
  assert.ok(result.stats.droppedDataUrls >= 1);
});
