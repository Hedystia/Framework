/**
 * Provides prepare/layout pipeline for reactive text measurement.
 */

import { memo } from "../signal";
import type { Accessor } from "../types";

/**
 * Prepared text handle
 */
export interface PreparedText {
  readonly [key: symbol]: true;
}

/**
 * Layout result
 */
export interface LayoutResult {
  lineCount: number;
  height: number;
}

/**
 * Prepare text for layout measurement
 */
export function prepare(text: string, font: string): PreparedText {
  if (typeof window === "undefined") {
    return {} as PreparedText;
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {} as PreparedText;
  }

  ctx.font = font;
  const metrics = ctx.measureText(text);
  const width = metrics.width;
  const height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;

  return {
    _text: text,
    _font: font,
    _width: width,
    _height: height,
    [Symbol.for("prepared")]: true,
  } as PreparedText;
}

/**
 * Layout prepared text at a given width
 */
export function layout(prepared: PreparedText, maxWidth: number, lineHeight: number): LayoutResult {
  const internal = prepared as any;
  if (!internal._text) {
    return { lineCount: 0, height: 0 };
  }

  const text = internal._text as string;
  const font = internal._font as string;

  if (typeof window === "undefined") {
    return { lineCount: 1, height: lineHeight };
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { lineCount: 1, height: lineHeight };
  }

  ctx.font = font;

  const words = text.split(" ");
  let lines = 0;
  let currentLineWidth = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    const wordWidth = ctx.measureText(word).width;

    if (currentLineWidth + wordWidth > maxWidth) {
      lines++;
      currentLineWidth = wordWidth;
    } else {
      currentLineWidth += wordWidth + ctx.measureText(" ").width;
    }
  }

  if (currentLineWidth > 0) {
    lines++;
  }

  return {
    lineCount: Math.max(1, lines),
    height: Math.max(1, lines) * lineHeight,
  };
}

/**
 * Create a reactive layout computation
 */
export function reactiveLayout<T extends object>(
  source: Accessor<T>,
  getPrepared: (item: T) => PreparedText,
  maxWidth: number,
  lineHeight: number,
): Accessor<LayoutResult> {
  const computed = memo(() => {
    const item = source();
    const prepared = getPrepared(item);
    return layout(prepared, maxWidth, lineHeight);
  });
  return computed as unknown as Accessor<LayoutResult>;
}
