# rpiv-advisor config template

Portable operator template for [`@juicesharp/rpiv-advisor`](https://www.npmjs.com/package/@juicesharp/rpiv-advisor).

This package versions the **config overlay**, not the extension source. The extension itself is listed in `configs/agent-settings.json` (`npm:@juicesharp/rpiv-advisor`) and installed via Path B (`pi update --extensions`).

## Files

| File | Role |
| --- | --- |
| `advisor.json` | Seed template: `effort`, `guidance`, empty `disabledForModels` |

`modelKey` is **not** versioned here. It is machine-local (depends on each operator’s Pi model registry). After first install, pick a reviewer with `/advisor` in an interactive Pi session, or edit the installed file.

## Install target (Path B only)

```text
configs/rpiv-advisor/advisor.json
  → ~/.config/rpiv-advisor/advisor.json   (or $XDG_CONFIG_HOME/rpiv-advisor/advisor.json)
```

Behavior:

- **Seed if missing** — does not overwrite an existing operator selection from `/advisor`.
- Writes mode `0600` on create.
- Path A (`pi install`) does **not** install this overlay.

## Recommended operator setup

1. Ensure `@juicesharp/rpiv-advisor` is in settings packages (already in this pack’s `agent-settings.json`).
2. Run `npm run install-global` (or copy `advisor.json` once to the path above).
3. In Pi: `/advisor` → pick a **stronger / cross-family** model than the executor, then set effort (`high` recommended).
4. Optionally set `disabledForModels` so the advisor tool is stripped when the executor *is* the advisor model.

Example after `/advisor` (not shipped; local only):

```json
{
  "modelKey": "openaius2/gpt-5.4",
  "effort": "high",
  "disabledForModels": ["openaius2/gpt-5.4"],
  "guidance": { "...": "from template or merged locally" }
}
```

## What the executor sees

Advisor output is the normal Pi **tool result** labeled `Advisor` in the session transcript — not a separate panel or log file under this package.
