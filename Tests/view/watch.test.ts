/**
 * Watch tests for @hedystia/view
 */

import { describe, expect, it } from "bun:test";
import { on, once, set, sig, untrack, val } from "@hedystia/view";

describe("Watch", () => {
  describe("on()", () => {
    it("should run effect initially", () => {
      const count = sig(0);
      let effectValue: number | undefined;

      on(
        () => val(count),
        (value) => {
          effectValue = value;
        },
      );

      expect(effectValue).toBe(0);
    });

    it("should return dispose function", () => {
      const count = sig(0);
      let effectValue: number | undefined;

      const dispose = on(
        () => val(count),
        (value) => {
          effectValue = value;
        },
      );

      dispose();
      set(count, 5);
      expect(effectValue).toBe(0);
    });

    it("should support cleanup callback", () => {
      const count = sig(0);
      let cleanupCalled = false;

      const dispose = on(
        () => val(count),
        () => {
          return () => {
            cleanupCalled = true;
          };
        },
      );

      dispose();
      expect(cleanupCalled).toBe(true);
    });
  });

  describe("once()", () => {
    it("should run only once", () => {
      const count = sig(0);
      let effectValue: number | undefined;
      let callCount = 0;

      once(
        () => val(count),
        (value) => {
          effectValue = value;
          callCount++;
        },
      );

      expect(effectValue).toBe(0);
      expect(callCount).toBe(1);
    });
  });

  describe("untrack()", () => {
    it("should run without tracking", () => {
      const count = sig(0);
      const result = untrack(() => val(count));
      expect(result).toBe(0);
    });
  });
});
