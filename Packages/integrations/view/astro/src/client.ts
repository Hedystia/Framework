import { mount } from "@hedystia/view";

export default (element: HTMLElement) =>
  (Component: any, props: any, slotted: any, { client }: { client: string }) => {
    if (!element.hasAttribute("ssr")) {
      return;
    }

    const _slots: Record<string, any> = {};
    let _slot: HTMLElement | null;

    if (Object.keys(slotted).length > 0) {
      if (client !== "only") {
        const iterator = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT, (node) => {
          if (node === element) {
            return NodeFilter.FILTER_SKIP;
          }
          if (node.nodeName === "ASTRO-SLOT") {
            return NodeFilter.FILTER_ACCEPT;
          }
          if (node.nodeName === "ASTRO-ISLAND") {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_SKIP;
        });
        let slot: HTMLElement | null;

        while (true) {
          slot = iterator.nextNode() as HTMLElement | null;
          if (!slot) {
            break;
          }

          _slots[slot.getAttribute("name") || "default"] = slot;
        }
      }
      for (const [key, value] of Object.entries(slotted)) {
        if (_slots[key]) {
          continue;
        }
        _slots[key] = document.createElement("astro-slot");
        if (key !== "default") {
          _slots[key].setAttribute("name", key);
        }
        _slots[key].innerHTML = value;
      }
    }

    const { default: children, ...slots } = _slots;

    element.innerHTML = "";

    const app = mount(() => Component({ ...props, ...slots, children }), element);

    element.addEventListener("astro:unmount", () => app.dispose(), { once: true });
  };
