/**
 * Watch tests for @hedystia/view
 */

import { describe, expect, it } from "bun:test";
import { on, once, set, sig, untrack, val, watch, watchAll } from "@hedystia/view";

describe("Watch", () => {
  describe("on()", () => {
    it("should not run callback initially (seed only)", () => {
      const count = sig(0);
      let effectValue: number | undefined;

      on(
        () => val(count),
        (value) => {
          effectValue = value;
        },
      );

      expect(effectValue).toBe(undefined);
    });

    it("should run callback on signal change with correct prev", () => {
      const count = sig(0);
      let effectValue: number | undefined;
      let prevValue: number | undefined;

      on(
        () => val(count),
        (value, prev) => {
          effectValue = value;
          prevValue = prev;
        },
      );

      set(count, 5);
      expect(effectValue).toBe(5);
      expect(prevValue).toBe(0);
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

      set(count, 3);
      expect(effectValue).toBe(3);
      dispose();
      set(count, 5);
      expect(effectValue).toBe(3);
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

      set(count, 1);
      dispose();
      expect(cleanupCalled).toBe(true);
    });
  });

  describe("once()", () => {
    it("should run only once on first change", () => {
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

      expect(effectValue).toBe(undefined);
      expect(callCount).toBe(0);

      set(count, 1);
      expect(effectValue).toBe(1);
      expect(callCount).toBe(1);

      set(count, 2);
      expect(effectValue).toBe(1);
      expect(callCount).toBe(1);
    });
  });

  describe("watch()", () => {
    it("should not run callback initially", () => {
      const count = sig(0);
      let effectValue: number | undefined;

      watch(count, (value) => {
        effectValue = value;
      });

      expect(effectValue).toBe(undefined);
    });

    it("should react to signal changes", () => {
      const count = sig(0);
      let effectValue: number | undefined;

      watch(count, (value) => {
        effectValue = value;
      });

      set(count, 10);
      expect(effectValue).toBe(10);
    });

    it("should provide previous value", () => {
      const count = sig(1);
      let prev: number | undefined;

      watch(count, (_value, prevValue) => {
        prev = prevValue;
      });

      set(count, 5);
      expect(prev).toBe(1);
    });

    it("should return dispose function", () => {
      const count = sig(0);
      let effectValue: number | undefined;

      const dispose = watch(count, (value) => {
        effectValue = value;
      });

      set(count, 3);
      expect(effectValue).toBe(3);
      dispose();
      set(count, 99);
      expect(effectValue).toBe(3);
    });

    it("should support cleanup callback", () => {
      const count = sig(0);
      let cleanupCalled = false;

      const dispose = watch(count, () => {
        return () => {
          cleanupCalled = true;
        };
      });

      set(count, 1);
      dispose();
      expect(cleanupCalled).toBe(true);
    });
  });

  describe("watchAll()", () => {
    it("should not run callback initially", () => {
      const a = sig(1);
      const b = sig(2);
      let effectValues: [number, number] | undefined;

      watchAll([a, b], (values) => {
        effectValues = values as [number, number];
      });

      expect(effectValues).toBe(undefined);
    });

    it("should react when any tracked signal changes", () => {
      const a = sig(1);
      const b = sig(2);
      let effectValues: [number, number] | undefined;

      watchAll([a, b], (values) => {
        effectValues = values as [number, number];
      });

      set(a, 10);
      expect(effectValues).toEqual([10, 2]);

      set(b, 20);
      expect(effectValues).toEqual([10, 20]);
    });

    it("should provide previous values", () => {
      const a = sig(1);
      const b = sig(2);
      let prev: [number, number] | undefined;

      watchAll([a, b], (_values, prevValues) => {
        prev = prevValues as [number, number];
      });

      set(a, 5);
      expect(prev).toEqual([1, 2]);
    });

    it("should return dispose function", () => {
      const a = sig(1);
      const b = sig(2);
      let effectValues: [number, number] | undefined;

      const dispose = watchAll([a, b], (values) => {
        effectValues = values as [number, number];
      });

      set(a, 10);
      expect(effectValues).toEqual([10, 2]);
      dispose();
      set(a, 99);
      expect(effectValues).toEqual([10, 2]);
    });

    it("should support cleanup callback", () => {
      const a = sig(1);
      const b = sig(2);
      let cleanupCalled = false;

      const dispose = watchAll([a, b], () => {
        return () => {
          cleanupCalled = true;
        };
      });

      set(a, 10);
      dispose();
      expect(cleanupCalled).toBe(true);
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
