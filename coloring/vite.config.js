import { defineConfig, loadEnv } from 'vite';

const DEFAULT_OPENROUTER_KEY =
  process.env.OPENROUTER_API_KEY ||
  loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '').OPENROUTER_API_KEY ||
  '';

function argonApiPlugin() {
  const handler = async (req, res, next) => {
    if (req.url === '/api/argon-color' && req.method === 'POST') {
      try {
        const chunks = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        const bodyStr = Buffer.concat(chunks).toString('utf-8');
        const payload = JSON.parse(bodyStr || '{}');

        const apiKey = (payload.apiKey || DEFAULT_OPENROUTER_KEY).trim();
        const model = payload.model || 'google/gemini-4-argon';
        const messages = payload.messages || [];
        const reasoningEffort = payload.reasoningEffort || 'low';

        const upstreamRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:5179',
            'X-Title': 'Argon Atelier Coloring Studio',
          },
          body: JSON.stringify({
            model,
            reasoning: { effort: reasoningEffort },
            messages,
            max_tokens: payload.max_tokens || 16384,
            temperature: payload.temperature ?? 0.3,
          }),
        });

        const data = await upstreamRes.text();
        res.statusCode = upstreamRes.status;
        res.setHeader('Content-Type', 'application/json');
        res.end(data);
      } catch (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            error: { message: err?.message || 'Internal proxy error' },
          })
        );
      }
      return;
    }
    next();
  };

  return {
    name: 'argon-openrouter-proxy',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  plugins: [argonApiPlugin()],
  server: {
    port: 5179,
    host: true,
  },
  preview: {
    port: 5179,
    host: true,
  },
});
