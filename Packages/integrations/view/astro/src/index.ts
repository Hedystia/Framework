import type { AstroIntegration, AstroRenderer } from "astro";
import type { Plugin, UserConfig } from "vite";

function getRenderer(): AstroRenderer {
  return {
    name: "@hedystia/astro",
    clientEntrypoint: "@hedystia/astro/client.js",
    serverEntrypoint: "@hedystia/astro/server.js",
  };
}

export { getRenderer as getContainerRenderer };

export interface Options {
  include?: string[];
  exclude?: string[];
}

export default function (options: Options = {}): AstroIntegration {
  return {
    name: "@hedystia/astro",
    hooks: {
      "astro:config:setup": async ({ addRenderer, updateConfig }) => {
        addRenderer(getRenderer());
        updateConfig({
          vite: getViteConfiguration(options),
        });
      },
    },
  };
}

function getViteConfiguration({ include, exclude }: Options) {
  return {
    plugins: [hedystiaViewPlugin({ include, exclude }), configEnvironmentPlugin()],
  };
}

function hedystiaViewPlugin(_options: Options): Plugin {
  return {
    name: "@hedystia/astro:view",
    config() {
      return {
        esbuild: {
          jsx: "automatic",
          jsxImportSource: "@hedystia/view",
        },
      };
    },
  };
}

function configEnvironmentPlugin(): Plugin {
  return {
    name: "@hedystia/astro:config-environment",
    configEnvironment(environmentName: string): UserConfig | Promise<UserConfig> | undefined {
      return {
        optimizeDeps: {
          include: environmentName === "client" ? ["@hedystia/astro/client.js"] : [],
          exclude: ["@hedystia/astro/server.js"],
        },
      };
    },
  };
}
