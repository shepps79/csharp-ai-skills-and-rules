// pi extension that serves LMSTUDIO_MODEL from LM Studio (LMSTUDIO_URL) as the model `lmstudio/<id>`, so an eval
// run needs no models.json in your pi profile. lmstudio.js loads it with `pi -e`.
const FALLBACK_CONTEXT = 32768;

module.exports = async function lmstudio(pi) {
  const baseUrl = process.env.LMSTUDIO_URL;
  const id = process.env.LMSTUDIO_MODEL;
  pi.registerProvider('lmstudio', {
    baseUrl: `${baseUrl}/v1`,
    // LM Studio ignores the key, but pi lists a model only when its provider has one.
    apiKey: 'lmstudio',
    api: 'openai-completions',
    models: [{
      id,
      name: id,
      // A reasoning model in LM Studio thinks by default; pi then sends no reasoning parameters it may reject.
      reasoning: false,
      input: ['text'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: await loadedContext(baseUrl, id),
      maxTokens: 16384,
    }],
  });
};

// pi compacts by the context window, so it must match the length the model was loaded with.
async function loadedContext(baseUrl, id) {
  try {
    const response = await fetch(`${baseUrl}/api/v0/models/${encodeURIComponent(id)}`);
    const model = await response.json();
    return model.loaded_context_length ?? model.max_context_length ?? FALLBACK_CONTEXT;
  } catch {
    return FALLBACK_CONTEXT;
  }
}
