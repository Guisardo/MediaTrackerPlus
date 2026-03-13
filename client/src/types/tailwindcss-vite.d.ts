declare module '@tailwindcss/vite' {
  import { Plugin } from 'vite';

  interface PluginOptions {
    optimize?:
      | boolean
      | {
          minify?: boolean;
        };
  }

  export default function tailwindcss(opts?: PluginOptions): Plugin[];
}
