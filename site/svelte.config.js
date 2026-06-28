import alchemy from 'alchemy/cloudflare/sveltekit';
import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const dev = process.env.NODE_ENV === 'development';

const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: dev ? alchemy() : adapter(),
    inlineStyleThreshold: 20_000,
    prerender: {
      entries: ['*'],
    },
  },
};

export default config;
