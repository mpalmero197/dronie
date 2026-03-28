

# Improve LAANC Checker Error Handling

## Current State

The LAANC checker has basic error handling: a `try/catch` that silently falls back to "uncontrolled" on any failure, and ignores non-OK HTTP responses (just proceeds with empty zones). Problems:

1. **Non-OK responses are silent** — 401, 403, 429, 500 all treated as "no zones found" (misleading)
2. **Malformed JSON not handled** — `res.json()` could throw inside the `try` but the catch gives a generic message
3. **No timeout** — request could hang indefinitely
4. **No retry mechanism** — transient failures immediately show error
5. **Error result masquerades as "uncontrolled"** — user can't distinguish API failure from genuinely uncontrolled airspace (dangerous for safety)

## Implementation

**Single file change: `src/components/map/LaancChecker.tsx`**

### Add an "error" authorization status
- Add `"error"` to the `LaancResult.authorization` union type
- Add an `error` entry to `statusConfig` with a distinct icon (`AlertTriangle`), orange/gray styling, and "API Error" label
- This lets the UI and PDF clearly distinguish errors from real results

### Add fetch timeout
- Use `AbortController` with a 10-second timeout so requests don't hang

### Handle non-OK HTTP responses explicitly
- Check `res.ok`; if false, throw with status code info (e.g., "API returned 429")
- Handle rate limiting (429) with a specific user-friendly message

### Handle malformed JSON
- Wrap `res.json()` in its own try/catch to give a clear "unexpected response format" message

### Add single retry for transient failures
- On network error or 5xx, retry once after a 1-second delay before showing the error

### Show toast on error
- Import `toast` from hooks and show a warning toast so the error is noticed even if the panel is off-screen

### Update error result to use `"error"` status
- Instead of pretending the result is `"uncontrolled"`, set `authorization: "error"` with `maxAutoAltFt: 0` — this prevents pilots from mistakenly thinking they're cleared to fly

