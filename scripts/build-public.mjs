process.env.VITE_GEMINI_API_KEY = '';
process.env.GEMINI_API_KEY = '';

const { build } = await import('vite');

await build();
