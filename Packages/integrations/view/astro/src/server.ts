import { renderToString } from "@hedystia/view";
import type { NamedSSRLoadedRendererValue } from "astro";
import { getContext, incrementId } from "./context";
import type { RendererContext } from "./types";

const slotName = (str: string) => str.trim().replace(/[-_]([a-z])/g, (_, w) => w.toUpperCase());

async function check(
  this: RendererContext,
  Component: any,
  _props: Record<string, any>,
  _children: any,
) {
  if (typeof Component !== "function") {
    return false;
  }
  if (Component.name === "QwikComponent") {
    return false;
  }
  if (Component.toString().includes("$$payload")) {
    return false;
  }

  try {
    const result = Component(_props);
    const html = renderToString(result);
    return typeof html === "string" && html.length > 0;
  } catch (e) {
    console.error("[@hedystia/astro] check failed:", e);
    return false;
  }
}

async function renderToStaticMarkup(
  this: RendererContext,
  Component: any,
  props: Record<string, any>,
  { default: children, ...slotted }: any,
  metadata?: Record<string, any>,
) {
  const ctx = getContext(this.result);
  const renderId = metadata?.hydrate ? incrementId(ctx) : "";
  const needsHydrate = metadata?.astroStaticSlot ? !!metadata.hydrate : true;
  const tagName = needsHydrate ? "astro-slot" : "astro-static-slot";

  const slots: Record<string, string> = {};
  for (const [key, value] of Object.entries(slotted)) {
    const name = slotName(key);
    slots[name] = `<${tagName} name="${name}">${value}</${tagName}>`;
  }

  const childrenHtml = children != null ? `<${tagName}>${children}</${tagName}>` : undefined;

  const newProps = {
    ...props,
    ...slots,
    children: childrenHtml,
  };

  const componentHtml = renderToString(Component(newProps));

  return {
    attrs: {
      "data-view-render-id": renderId,
    },
    html: componentHtml,
  };
}

const renderer: NamedSSRLoadedRendererValue = {
  name: "@hedystia/astro",
  check,
  renderToStaticMarkup,
  supportsAstroStaticSlot: true,
};

export default renderer;
