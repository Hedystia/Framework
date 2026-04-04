import { describe, expect, it } from "bun:test";
import { Fragment, jsx, jsxs } from "@hedystia/view";

describe("JSX", () => {
  describe("jsx()", () => {
    it("should create element", () => {
      const element = jsx("div", {});
      expect(element.tagName).toBe("DIV");
    });

    it("should set className", () => {
      const element = jsx("div", { className: "card" });
      expect(element.className).toBe("card");
    });

    it("should set id", () => {
      const element = jsx("div", { id: "main" });
      expect(element.id).toBe("main");
    });

    it("should set style object", () => {
      const element = jsx("div", { style: { padding: "16px", color: "red" } });
      expect(element.style.padding).toBe("16px");
      expect(element.style.color).toBe("red");
    });

    it("should set style string", () => {
      const element = jsx("div", { style: "padding: 16px; color: red;" });
      expect(element.style.cssText).toContain("padding: 16px");
    });

    it("should add event listener", () => {
      let clicked = false;
      const element = jsx("button", {
        onClick: () => {
          clicked = true;
        },
      });
      element.click();
      expect(clicked).toBe(true);
    });

    it("should set boolean attribute", () => {
      const element = jsx("input", { disabled: true });
      expect(element.hasAttribute("disabled")).toBe(true);
    });

    it("should set children as text", () => {
      const element = jsx("p", { children: "Hello World" });
      expect(element.textContent).toBe("Hello World");
    });

    it("should set children as element", () => {
      const child = jsx("span", { children: "child" });
      const element = jsx("div", { children: child });
      expect(element.children.length).toBe(1);
      expect(element.children[0].tagName).toBe("SPAN");
    });
  });

  describe("jsxs()", () => {
    it("should create multiple elements", () => {
      const elements = jsxs("div", {
        children: [jsx("span", {}), jsx("span", {})],
      });
      expect(elements.tagName).toBe("DIV");
      expect(elements.children.length).toBe(2);
    });

    it("should handle fragment", () => {
      const children = [jsx("span", {}), jsx("span", {})];
      const elements = jsxs("fragment", { children });
      expect(elements.length).toBe(2);
    });
  });

  describe("Fragment", () => {
    it("should render children", () => {
      const child1 = jsx("span", { children: "a" });
      const child2 = jsx("span", { children: "b" });
      const fragment = Fragment({ children: [child1, child2] });
      expect(fragment).toEqual([child1, child2]);
    });

    it("should handle single child", () => {
      const child = jsx("span", { children: "a" });
      const fragment = Fragment({ children: child });
      expect(fragment).toBe(child);
    });

    it("should handle no children", () => {
      const fragment = Fragment({});
      expect(fragment).toBeNull();
    });
  });

  describe("reactive props", () => {
    it("should handle function prop", () => {
      const element = jsx("div", {
        "data-value": () => "dynamic",
      });
      expect(element.getAttribute("data-value")).toBe("dynamic");
    });
  });
});
