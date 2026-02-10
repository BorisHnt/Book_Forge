import test from "node:test";
import assert from "node:assert/strict";

import { createDefaultDocument } from "../core/document.js";
import {
  isPdfImportedPage,
  centerImportedFramesOnPage,
  createImportedClipboardSnapshot,
  pasteImportedSnapshot,
  removeImportedPdfContentFromPage
} from "../ui/pageContextMenu.js";

test("isPdfImportedPage détecte une page importée PDF", () => {
  const doc = createDefaultDocument();
  const page = doc.pages[0];
  page.imported = { source: "pdf" };

  assert.equal(isPdfImportedPage(page), true);
});

test("centerImportedFramesOnPage centre uniquement les cadres PDF importés", () => {
  const doc = createDefaultDocument();
  const page = doc.pages[0];
  page.frames = [
    { id: "f-pdf", type: "image", x: 1, y: 2, w: 92, h: 86, importedFrom: "pdf" },
    { id: "f-user", type: "text", x: 10, y: 12, w: 30, h: 10, importedFrom: "" }
  ];

  const moved = centerImportedFramesOnPage(page);

  assert.equal(moved, 1);
  assert.equal(page.frames[0].x, 4);
  assert.equal(page.frames[0].y, 7);
  assert.equal(page.frames[1].x, 10);
  assert.equal(page.frames[1].y, 12);
});

test("pasteImportedSnapshot colle des cadres importés avec nouveaux ids", () => {
  const doc = createDefaultDocument();
  const source = doc.pages[0];
  source.frames = [
    { id: "orig", type: "image", x: 4, y: 4, w: 92, h: 92, importedFrom: "pdf", src: "data:image/jpeg;base64,abc" }
  ];
  source.backgroundReference = {
    sourceType: "application/pdf",
    sourceName: "sample.pdf",
    pageNumber: 1,
    dataUrl: "data:image/jpeg;base64,abc"
  };

  const target = doc.pages[1];
  const snapshot = createImportedClipboardSnapshot(source);
  const result = pasteImportedSnapshot(target, snapshot, { offset: 2 });

  assert.equal(result.insertedFrames, 1);
  assert.ok(result.lastFrameId);
  assert.notEqual(target.frames[0].id, "orig");
  assert.equal(target.frames[0].importedFrom, "pdf");
  assert.ok(target.backgroundReference);
});

test("removeImportedPdfContentFromPage retire cadres et fond PDF", () => {
  const doc = createDefaultDocument();
  const page = doc.pages[0];
  page.frames = [
    { id: "pdf", type: "image", x: 4, y: 4, w: 92, h: 92, importedFrom: "pdf" },
    { id: "keep", type: "text", x: 10, y: 10, w: 20, h: 10, importedFrom: "" }
  ];
  page.backgroundReference = {
    sourceType: "application/pdf",
    dataUrl: "data:image/jpeg;base64,abc"
  };

  const result = removeImportedPdfContentFromPage(page);

  assert.equal(result.removedFrames, 1);
  assert.equal(result.removedReference, true);
  assert.equal(page.frames.length, 1);
  assert.equal(page.frames[0].id, "keep");
  assert.equal(page.backgroundReference, null);
});
