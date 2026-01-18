let enabledPromise = null;
const recent = new Map();
const hashString = (s) => {
    let h = 0;
    for (let i = 0; i < s.length; i++)
        h = (h * 31 + s.charCodeAt(i)) | 0;
    return String(h);
};
export const beadsReportingEnabled = async () => {
    if (enabledPromise)
        return enabledPromise;
    enabledPromise = fetch('/api/beads/enabled', { method: 'GET' })
        .then(async (r) => {
        if (!r.ok)
            return false;
        const json = (await r.json());
        return Boolean(json.enabled);
    })
        .catch(() => false);
    return enabledPromise;
};
const shouldSend = (signature, ttlMs = 15 * 60 * 1000) => {
    const now = Date.now();
    const last = recent.get(signature);
    if (last && now - last < ttlMs)
        return false;
    recent.set(signature, now);
    return true;
};
export const reportFrontendErrorToBeads = async (error, ctx) => {
    if (!(await beadsReportingEnabled()))
        return;
    const err = error instanceof Error ? error : new Error(String(error));
    const message = err.message || String(error);
    const stack = err.stack || null;
    const signature = hashString(`${ctx.kind}\n${message}\n${stack ?? ''}`);
    if (!shouldSend(signature))
        return;
    const payload = {
        source: 'frontend',
        message,
        stack,
        url: window.location?.href ?? null,
        user_agent: navigator.userAgent,
        context: {
            kind: ctx.kind,
            ...ctx.extra,
        },
    };
    try {
        await fetch('/api/beads/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }
    catch {
        // Don't throw from an error reporter.
    }
};
export const installFrontendBeadsErrorReporting = () => {
    window.addEventListener('error', (ev) => {
        void reportFrontendErrorToBeads(ev.error ?? ev.message, { kind: 'window.onerror' });
    });
    window.addEventListener('unhandledrejection', (ev) => {
        void reportFrontendErrorToBeads(ev.reason, { kind: 'unhandledrejection' });
    });
};
