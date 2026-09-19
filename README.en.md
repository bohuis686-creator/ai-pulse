# AI Pulse

**Is your AI having an off day? Measure performance changes with reproducible tasks and transparent scoring.**

[中文](README.md) · English · [Methodology](docs/methodology.md)

AI Pulse is a small, local-first regression check for chat products and model APIs. It records what changed on a fixed task set. It does **not** identify a hidden model, prove reduced compute, or provide a general intelligence score.

## Features

- **No-key chat testing:** copy a 24-task prompt into ChatGPT, DeepSeek, or another chat app and paste its JSON answers back.
- **API automation:** OpenAI, DeepSeek and OpenRouter Chat Completions adapters. Enter a model ID available to your account.
- **Six dimensions:** arithmetic, logic, code tracing, instruction following, information extraction and short-context retrieval.
- **Reproducible inputs:** seeded task parameters with versioned templates; some control tasks remain fixed.
- **Deterministic grading:** explicit JSON types and answer keys; no LLM judge, no execution of generated code.
- **History:** baseline comparison, category scores, comparable-run trend, JSON import/export and Markdown summaries.
- **No runtime dependencies:** Node.js 20+, plain browser JavaScript, loopback-only server. Chinese user interface; bilingual project documentation.

## Run locally

Install [Node.js 20+](https://nodejs.org/), then:

```bash
git clone https://github.com/bohuis686-creator/ai-pulse.git
cd ai-pulse
npm start
```

Open **http://127.0.0.1:8787**. No `npm install` is needed. Windows users may download and extract the repository ZIP and double-click `Start-Windows.cmd`. Refresh the browser if it opens before the server starts. Override `PORT` if needed.

## Chat workflow

1. Keep the seed and enter a model/settings label.
2. Copy the test prompt into a **fresh conversation** with web/code tools disabled and consistent reasoning settings.
3. Paste the complete JSON response into AI Pulse and score it.
4. Inspect failures, save a baseline, and repeat at different times under the same conditions.

Manual mode sends all tasks together. API mode sends each task in a separate context. They are intentionally **not comparable**. Hidden chat-product instructions, memory, routing, tools and settings remain outside the tool's control.

## API workflow

Choose a provider, enter its model ID and key, then select 1, 3 or 5 repetitions per task. A run makes up to **24, 72 or 120 requests** and may incur provider charges. No real API credentials are bundled.

Temperature and reasoning effort are omitted by default. Only supply supported parameters. The token budget defaults to 4096; reasoning models may need more. Truncation, authentication, network and rate-limit errors stop the run instead of becoming reasoning failures. No automatic paid retries. Incomplete runs are not saved as complete evaluations.

Cancellation stops local waiting and future calls; an in-flight call may still be processed and billed. Arbitrary base URLs and local model endpoints are not supported in this version.

An OpenAI API run is **not a direct measurement of ChatGPT**. The same distinction applies to DeepSeek's API and its chat product.

## Interpret carefully

Scores are the fraction of scorable answers that match the answer key. Wrong output formats count as failures; transport and truncation errors are separate. Latency includes networking and queueing and is not an intelligence metric.

Comparisons require identical suite version, seed, mode, provider, requested model, repetition count, token cap and optional parameters. With at least 3 repetitions per task, we average each task's outcomes, pair baseline/current tasks, and bootstrap 24 task-level differences 2,000 times. A decline signal requires at least a 10 percentage-point drop and a percentile 95% interval entirely below zero.

This is an **exploratory heuristic**, not a calibrated diagnostic or causal test. The public, relatively small, Chinese-language task set can be memorized and shares templates. It does not assess image understanding, tool use, long-context limits, creative work or comprehensive coding ability. A high score may simply indicate a ceiling effect. More details: [methodology](docs/methodology.md).

## Privacy and validation

The server binds only to `127.0.0.1`, validates Host/Origin, requires a random session token and allows only predefined provider endpoints. No arbitrary proxying or redirects. API keys are never intentionally logged or persisted; the input is cleared after each run, error or cancellation. The selected provider receives the key and task prompts over HTTPS.

History and raw answers remain in this browser's localStorage, limited to ten runs. Export important records. Imported reports are validated and regraded; external report authenticity cannot be established. Synthetic demo data is clearly labeled and cannot become a real baseline.

The automated suite uses mock API responses and covers grading, seeded task checks, comparison, import validation, request payloads, HTTP streaming and basic access controls. Live paid-provider behavior has not been verified. The available cloud browser could not reach the development loopback server; browser end-to-end visual QA remains outstanding.

## Development

```bash
npm test
npm run check
```

`web/core.js` is shared by the browser and Node tests. `src/provider.js` holds the provider allowlist and adapters. `src/server.js` serves the local app and streams evaluation progress. Contributions should include unique answer keys, explanations and meaningful tests.

References: [OpenAI Chat API](https://developers.openai.com/api/reference/resources/chat), [DeepSeek API](https://api-docs.deepseek.com/). Model-specific support can change; check official provider documentation and actual API errors.

[MIT License](LICENSE) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)
