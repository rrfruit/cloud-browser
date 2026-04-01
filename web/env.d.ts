/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";

  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}

declare var process: {
  env: NodeJS.ProcessEnv;
  argv: string[];
  platform: string;
  version: string;
  versions: Record<string, string>;
  // 可以添加其他需要的属性
};
