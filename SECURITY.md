# Security

AI Pulse is designed for one user running it locally. Do not expose the local HTTP server to the internet or a shared network.

- No arbitrary API destinations: the provider allowlist contains OpenAI, DeepSeek and OpenRouter.
- No redirects containing credentials; HTTPS is used for upstream calls.
- The loopback service validates Host and Origin and requires a random token for API runs.
- Keys are handled in memory, not deliberately persisted or logged. Browser extensions, local malware and a compromised operating system are outside this protection model.
- Output is displayed as text, never injected as model-authored HTML. Generated code is not executed.
- Imported reports are size limited, schema checked and rescored. A valid report is not a cryptographic proof of provenance.
- Raw responses can contain sensitive text if you modify the task set. Review reports before sharing.

Report ordinary bugs through GitHub Issues without keys or personal records. For a vulnerability, use GitHub private vulnerability reporting if enabled; otherwise open an issue containing only a request for a private contact channel, without exploit details or secrets.
