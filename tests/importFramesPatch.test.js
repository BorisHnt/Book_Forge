import test from "node:test";
import assert from "node:assert/strict";

import { createDefaultDocument, getPageSizePx } from "../core/document.js";
import { CommandHistory } from "../core/history.js";
import { buildPdfImportPages } from "../importers/pdfImporter.js";
import { buildDocxImportPages } from "../importers/docxImporter.js";
import {
  ensurePageFrames,
  moveFrame,
  resizeFrame,
  removeFrame,
  findFrame
} from "../layout/frameEngine.js";
import { getMarginGeometryPx } from "../layout/marginOverlay.js";
import { buildPrintableDocument } from "../exporters/pdf.js";

function makeContext(doc, page, side = "right") {
  return {
    doc,
    page,
    side,
    pageSizePx: getPageSizePx(doc)
  };
}

test("page PDF visible après import", async () => {
  const file = new File(["%PDF-1.7\n1 0 obj\n/Type /Page\n"], "sample.pdf", {
    type: "application/pdf"
  });

  const result = await buildPdfImportPages(file, {
    selectedNumbers: [1],
    mappedStyle: "p-body",
    parseMode: "flat",
    placeAsReference: false,
    referenceOpacity: 0.35
  });

  assert.equal(result.pages.length, 1);
  assert.ok(result.pages[0].frames.length > 0);
  assert.equal(result.pages[0].frames[0].type, "image");
});

test("cadres créés après import DOCX/TXT", async () => {
  const file = new File(["Titre\n\nParagraphe 1\n\nParagraphe 2"], "sample.txt", {
    type: "text/plain"
  });

  const result = await buildDocxImportPages(file, {
    selectedNumbers: [1],
    mappedStyle: "p-body"
  });

  assert.equal(result.pages.length, 1);
  assert.ok(result.pages[0].frames.some((frame) => frame.type === "text"));
});

test("déplacement cadre", () => {
  const doc = createDefaultDocument();
  const page = doc.pages[0];
  page.frames = [{ id: "f1", type: "text", x: 10, y: 10, w: 30, h: 20 }];
  ensurePageFrames(page);

  const context = makeContext(doc, page, "right");
  moveFrame(page, "f1", { x: 250, y: 320, w: 200, h: 120 }, context);

  const frame = findFrame(page, "f1");
  assert.ok(frame.x > 10);
  assert.ok(frame.y > 10);
});

test("resize cadre", () => {
  const doc = createDefaultDocument();
  const page = doc.pages[0];
  page.frames = [{ id: "f1", type: "text", x: 12, y: 12, w: 20, h: 20 }];
  ensurePageFrames(page);

  const context = makeContext(doc, page, "right");
  resizeFrame(page, "f1", { x: 120, y: 120, w: 420, h: 360 }, context);

  const frame = findFrame(page, "f1");
  assert.ok(frame.w > 20);
  assert.ok(frame.h > 20);
});

test("snap marges", () => {
  const doc = createDefaultDocument();
  const page = doc.pages[0];
  page.frames = [{ id: "f1", type: "text", x: 10, y: 10, w: 25, h: 15 }];
  ensurePageFrames(page);

  const context = makeContext(doc, page, "right");
  const geom = getMarginGeometryPx(doc, page, "right");

  const nearLeftMargin = geom.px.left + 2;
  moveFrame(page, "f1", { x: nearLeftMargin, y: 180, w: 200, h: 120 }, context);

  const frame = findFrame(page, "f1");
  const leftPx = (frame.x / 100) * context.pageSizePx.width;
  assert.ok(Math.abs(leftPx - geom.px.left) < 0.5);
});

test("mode fond verrouillé", async () => {
  const file = new File(["%PDF-1.7\n/Type /Page"], "locked.pdf", {
    type: "application/pdf"
  });

  const result = await buildPdfImportPages(file, {
    selectedNumbers: [1],
    mappedStyle: "p-body",
    parseMode: "flat",
    placeAsReference: true,
    referenceOpacity: 0.45
  });

  const page = result.pages[0];
  assert.ok(page.backgroundReference);
  assert.equal(page.backgroundReference.locked, true);
  assert.equal(page.backgroundReference.nonPrintable, true);
});

test("suppression cadre", () => {
  const doc = createDefaultDocument();
  const page = doc.pages[0];
  page.frames = [
    { id: "f1", type: "text", x: 10, y: 10, w: 30, h: 20 },
    { id: "f2", type: "image", x: 50, y: 30, w: 25, h: 25 }
  ];
  ensurePageFrames(page);

  const removed = removeFrame(page, "f1");
  assert.ok(removed);
  assert.equal(page.frames.length, 1);
  assert.equal(page.frames[0].id, "f2");
});

test("undo / redo sur mouvement cadre", () => {
  const doc = createDefaultDocument();
  const page = doc.pages[0];
  page.frames = [{ id: "f1", type: "text", x: 10, y: 10, w: 30, h: 20 }];
  ensurePageFrames(page);
  const frame = findFrame(page, "f1");

  const history = new CommandHistory();
  const before = { x: frame.x, y: frame.y };
  const after = { x: 44, y: 55 };

  frame.x = after.x;
  frame.y = after.y;

  history.push({
    undo: () => {
      frame.x = before.x;
      frame.y = before.y;
    },
    redo: () => {
      frame.x = after.x;
      frame.y = after.y;
    }
  });

  history.undo();
  assert.equal(frame.x, before.x);
  assert.equal(frame.y, before.y);

  history.redo();
  assert.equal(frame.x, after.x);
  assert.equal(frame.y, after.y);
});

test("export conserve position des cadres", () => {
  const doc = createDefaultDocument();
  const page = doc.pages[0];
  page.frames = [
    {
      id: "f1",
      type: "text",
      x: 23,
      y: 31,
      w: 42,
      h: 18,
      content: "Position test"
    }
  ];

  const html = buildPrintableDocument(doc, {
    profile: "print",
    colorMode: "CMYK",
    compression: "high",
    bleed: true,
    cropMarks: true,
    embedFonts: true,
    bookmarks: true,
    spreads: false
  });

  assert.ok(html.includes("left:23%"));
  assert.ok(html.includes("top:31%"));
  assert.ok(html.includes("Position test"));
});
