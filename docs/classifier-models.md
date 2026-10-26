# Classifier Models And System One Endpoints

Guidance for wiring **classifier** (decision) models into pi — Jev, StartLux-Decision, Clef, and any
third-party gateway that speaks the System One protocol — and for calling them from `codemode`.

Read this when you need to decide:

- whether an endpoint can be a classifier at all, and how to configure it in `models.json`
- how `models.classify()` shapes a request and how each provider's image format differs
- why `choice` answers must always carry a fallback criterion
- what a classifier can and cannot do (it is not a chat model, it does not appear in `/model`)

Chat models and `models.json` chat providers are covered by pi's own `docs/models-configuration.md`;
this page only covers the classifier path and its verified pitfalls.

## Classifiers Are Not Chat Models

A classifier answers **typed questions about a `state`** and returns probabilities instead of text.
Consequences:

- It never appears in `/model`. You cannot select it as the conversation model.
- It is reached only through `codemode` (`models.classify(...)`) or an extension using the model
  registry — for example pi's `examples/extensions/jev-router.ts`.
- `codemode` must be enabled (`settings.json` → `codemode.mode: "on"`, or
  `defaultTools: ["+codemode"]`). It is off by default.
- Provider errors **do not throw**. Check `stopReason` and `errorMessage` on every result.

## The System One Protocol

Every endpoint below receives the same shape:

```json
{
  "model": "<id>",
  "state": "<string or JSON value>",
  "questions": {
    "<id>": { "type": "choice" | "noul" | "score", "instructions": "...", "criteria": { } }
  }
}
```

`bool` is accepted on the wire as an alias for `noul` (pi maps it before sending), but the **response
type is `noul`** and it carries a probability, not a boolean.

pi builds the URL as `new URL("systemone", baseUrl + "/")`. This is the single most common
configuration mistake — see [Base URL rules](#base-url-rules).

## Supported Endpoints

| Provider | `baseUrl` | `api` | Example model id |
| --- | --- | --- | --- |
| `typesafe` | `https://api.typesafe.ai/v1/` | `typesafe-system-one` | `jev-latest` |
| `openrouter` | `https://openrouter.ai/api/v1` | `typesafe-system-one` | `typesafe/jev-1.14` |
| `cloudflare-workers-ai` | `https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai` | `cloudflare-workers-ai-system-one` | `typesafe/jev` |
| `vercel-ai-gateway` | `https://ai-gateway.vercel.sh/typesafe/v1` | `typesafe-system-one` | `typesafe-ai/jev-1.14.0` |
| `opencode` | `https://opencode.ai/inference/v1` | `typesafe-system-one` | `jev-1.13` |

Built-in providers need only credentials — no `models.json` entry. Self-hosted endpoints (Laya,
Bespoke Nimble, llama.cpp decision models) and third-party System One gateways use the custom
provider path below.

Discover what the current credentials can actually reach:

```js
const list = await models.getAvailableOfType("classifier");
return list.map((m) => `${m.provider}/${m.id}`);
```

## Custom Provider Configuration

```json
{
  "$schema": "https://pi.dev/schemas/models.schema.json",
  "providers": {
    "my-decision-gateway": {
      "name": "My Decision Gateway",
      "baseUrl": "https://api.example.com/v1",
      "api": "typesafe-system-one",
      "apiKey": "$MY_GATEWAY_KEY",
      "authHeader": true,
      "compat": {
        "imageInput": "images",
        "sendImageOptInHeader": false
      },
      "models": [
        {
          "id": "some-decision-27b",
          "name": "Some Decision 27B",
          "input": ["text", "image"]
        }
      ]
    }
  }
}
```

### Base URL rules

- Point `baseUrl` at the path **above** the route. pi appends `systemone` itself.
- `https://api.example.com/v1` → `POST https://api.example.com/v1/systemone` ✅
- `https://api.example.com/v1/decisions` → `POST .../v1/decisions/systemone` → **404** ❌
- `https://api.example.com/v1/systemone` → `POST .../v1/systemone/systemone` → **404** ❌

When a gateway advertises its decision route as `/v1/decisions` but also documents a System One
compatible alias, use the alias and point `baseUrl` at `/v1`. Verify with an unauthenticated probe:
a route that exists answers `401`, a route that does not answers `404`.

### Required fields

- `api: "typesafe-system-one"` — the only classifier transport pi ships for self-declared providers.
- `authHeader: true` — without it a custom provider sends no `Authorization: Bearer` header and every
  call fails authentication.
- `apiKey: "$ENV_NAME"` — never inline a literal key. `$NAME`, `${NAME}`, and `!command` are supported.
- `models[].id` is sent verbatim as the request `model` field. Gateway model naming is not
  auto-mapped: a gateway serving StartLux does not accept `jev-latest`.

### `compat` is provider-level for classifiers

`compat.imageInput` on a `models[]` or `modelOverrides[]` entry applies to **chat** models only.
Classifiers read the provider-level `compat` block. Put `imageInput` there.

## Image Input

pi supports three wire formats, selected by `compat.imageInput`:

| `imageInput` | Images are sent as | `state` is | Formats | Max |
| --- | --- | --- | --- | --- |
| `assets` | `request.assets` map keyed `<image-N>` | prefixed with the asset names | PNG, JPEG | — |
| `images` | `request.images` array of data URLs | **left untouched** | PNG, JPEG, WebP | 4 |
| `state-image-urls` | `image_url` parts prepended to `state` | prefixed with the parts | any | — |

The `assets` branch (`ASSET_FORMATS` in pi-ai `system-one-shared.js`) rejects anything except PNG and
JPEG; the `images` branch enforces `MAX_DATA_URL_IMAGES = 4`.

**`images` mode does not insert markers.** pi sends the data URLs and returns without touching
`state`. Providers that require per-image markers in `state` (StartLux and Bamboo Relay, for example)
therefore need the marker written by the caller:

```js
const shot = await tools.read({ path: "/path/to/screenshot.png" }); // image block

const r = await models.classify(model, {
  state: "<image> 判断这张 UI 截图布局是否损坏。",   // marker written by hand
  images: [shot],
  questions: {
    broken: {
      type: "choice",
      instructions: "截图是否显示布局损坏（重叠/截断/错位）？",
      criteria: { true: "有损坏", false: "布局正常", other: "无法判断" },
    },
  },
});
```

Marker order maps to array order. A marker count that differs from the image count is rejected
upstream with **HTTP 422** (`the state has N <image> marks for M images`).

Image markers are only needed for providers that define them. When a provider's format is unknown,
start with `input: ["text"]` and add image support after verifying one real request.

## Choice Questions Always Need A Fallback Criterion

Some services enable a "none of the above" option by default (StartLux/Bamboo `allow_none: true`).
The raw response then carries `"choice": null`. pi's parser requires `choice` to be a string, so a
null answer produces:

```
System One API did not return a choice answer for <id>
```

and `answers` comes back empty — the `none_probability` signal is lost too. pi does not send
`allow_none`, so this cannot be disabled from the client side.

**Add an explicit fallback criterion to every `choice` question.**

Measured on `startlux-decision-27b-autothink` (Bamboo Relay):

| Input | Criteria without fallback | Criteria with `other: "不属于以上任何类别"` |
| --- | --- | --- |
| 都不沾（天气文本 vs 财务/医疗/法律） | `choice: null`, conf 0.264, `none_probability` 0.9965 | `choice: "other"`, conf 0.995, `none_probability` 0.0715 |
| 典型财务 | `finance` 0.999 | `finance` 0.994, `none_probability` 0.0030 |
| 典型医疗 | `medical` 0.999 | `medical` 0.991, `none_probability` 0.0038 |
| 典型法律 | `legal` 0.998 | `legal` 0.995, `none_probability` 0.0040 |

Reading of that data:

- The fallback criterion **converts** the null case into a legitimate answer instead of an error.
- Normal categories are **not** captured by the fallback; confidence drops 0.004–0.008 and
  `none_probability` stays far below the 0.2 review threshold.
- `none_probability` is **not** "the probability of picking the fallback". Once a fallback exists the
  model expresses non-match by *choosing* it, so `none_probability` drops rather than rises.
  **To detect "does not match", test `choice === "other"`, not `none_probability`.**
- When there is no fallback criterion, `0.2` is the documented review threshold for
  `none_probability` — but pi cannot surface it, because the parse fails first.

Canonical shape:

```js
questions: {
  topic: {
    type: "choice",
    instructions: "这条内容属于哪个类别？",
    criteria: {
      finance: "财务报表分析",
      medical: "医学诊断建议",
      legal: "合同法律条款",
      other: "不属于以上任何类别",   // always present
    },
  },
}
```

For `score` questions, use an ordered list of 2–10 levels; there is no fallback equivalent, so treat a
low `confidence` as the review signal.

## Usage And Concurrency

- `usage` is `{ input_tokens, output_tokens }` at the wire level; pi normalizes it to its `ModelUsage`
  shape. Fees are computed from the model's `cost` rates, which classifier entries normally set to 0.
- At most **4** `classify()` calls run concurrently per script. Extra calls queue; a script that gets no
  worker within 60 s fails without running.
- Classifier usage is added to the `codemode` tool result and counts toward session cost.

## Verification Recipe

Before trusting a new endpoint, run these four probes. All four are cheap and each one isolates a
different failure class.

1. **Route exists** — `curl -X POST <baseUrl>/systemone` with no credentials. Expect `401`, not `404`.
2. **Text classification** — one real sentence through `models.classify()`. Expect
   `stopReason: "stop"` with a sensible `choice` and `confidence`.
3. **Fallback collapsed the null case** — pass a `state` that matches none of the criteria. Expect
   `choice` equal to the fallback id, not an error.
4. **Image round-trip** (only if images are enabled) — one known image plus a matching `<image>`
   marker. Expect the expected label at high confidence; then repeat with a marker count mismatch and
   confirm the expected 422.

Documented outcomes from step 3 and step 4 on Bamboo Relay are in the tables above.

## What Not To Do

- Do not add a classifier to the `pi` manifest or expect it in `/model`.
- Do not inline literal API keys in `models.json` — use `$ENV_NAME`.
- Do not set `compat.imageInput` on a model entry and expect the classifier to honor it.
- Do not set `sendImageOptInHeader: true` unless the service is TypeSafe's own experimental image
  input; other gateways do not require the header.
- Do not write a local converting proxy until the deployment is known to need one. The marker
  requirement is satisfiable from the caller; a proxy is only warranted when a gateway refuses the
  `images` payload outright.

## Related

- `docs/language-hooks.md` — rule vs extension split for runtime behavior
- `docs/architecture.md` — where a new surface belongs
- pi's own `docs/codemode.md` and `docs/models-configuration.md` for the full `codemode` and
  `models.json` schemas
