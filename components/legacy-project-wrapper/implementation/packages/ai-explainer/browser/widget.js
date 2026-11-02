/* Shared decision UI. This file is also served to non-bundled application frontends. */
(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined' || window.AviationExplain) return;
  const bytes = value => new TextEncoder().encode(value).byteLength;
  const initialQuestion = 'Explain this decision using the supplied facts.';
  const state = { context: '', history: [], messages: [], pending: null, epoch: 0, available: false, provider: null, providers: [] };
  let elements;
  class DisplayError extends Error {}
  const element = (tag, text, attributes = {}) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    return node;
  };
  function mount() {
    if (elements) return elements;
    const host = element('div', '', { id: 'aviation-explanation' });
    const root = host.attachShadow({ mode: 'open' });
    const style = element('style', `
      :host{font:15px system-ui,sans-serif;color-scheme:light;color:#111827}
      *{box-sizing:border-box}button,textarea{font:inherit}button{cursor:pointer}
      .trigger{position:fixed;bottom:calc(1rem + env(safe-area-inset-bottom));left:1rem;width:44px;height:44px;border:1px solid #fff;border-radius:50%;background:#075985;color:#fff;font-weight:700;font-size:24px;box-shadow:0 2px 8px #0005;z-index:20000}
      [hidden]{display:none!important}dialog{width:min(44rem,calc(100vw - 2rem));max-height:calc(100dvh - 2rem);padding:1.25rem;border:1px solid #94a3b8;border-radius:.6rem;background:#fff;color:#111827;overflow:auto}
      dialog::backdrop{background:#0008}header{display:flex;align-items:center;justify-content:space-between;gap:1rem}h2{font-size:1.25rem;margin:0}
      .close{border:1px solid #94a3b8;border-radius:.3rem;background:#f8fafc;color:#111827;min-width:36px;min-height:36px}
      details{margin:1rem 0}summary{cursor:pointer}pre{max-height:10rem;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font:13px ui-monospace,monospace;background:#f1f5f9;padding:.6rem}
      dialog[open]{display:flex;flex-direction:column}header,details,form{flex-shrink:0}
      .messages{min-height:0;max-height:40dvh;overflow:auto;flex:1}.message{white-space:pre-wrap;overflow-wrap:anywhere;padding:.75rem;border-radius:.3rem;margin:.5rem 0;background:#f1f5f9}.assistant{background:#e0f2fe}
      .status{white-space:pre-wrap;overflow-wrap:anywhere;margin:.7rem 0}.error{color:#991b1b}
      label{display:block;margin-top:.8rem}textarea{display:block;width:100%;min-height:4rem;margin:.4rem 0;padding:.5rem;border:1px solid #64748b;border-radius:.3rem;background:#fff;color:#111827;resize:vertical}
      .send{padding:.5rem .9rem;border:1px solid #075985;border-radius:.3rem;background:#075985;color:#fff}button:disabled,textarea:disabled{cursor:default;opacity:.65}
    `);
    const trigger = element('button', '?', { type: 'button', class: 'trigger', 'aria-label': 'Explain this decision', title: 'Explain this decision' });
    trigger.hidden = true;
    const dialog = element('dialog', '', { 'aria-label': 'Decision explanation' });
    const header = element('header'); header.append(element('h2', 'Decision explanation'));
    const close = element('button', '×', { type: 'button', class: 'close', 'aria-label': 'Close explanation' }); header.append(close);
    const facts = element('details'); const context = element('pre'); facts.append(element('summary', 'Decision facts'), context);
    const messages = element('div', '', { class: 'messages', role: 'log', 'aria-live': 'polite' });
    const status = element('div', '', { class: 'status', role: 'status' });
    const form = element('form'); const label = element('label', 'Ask a question or follow-up', { for: 'aviation-explain-question' });
    const question = element('textarea', '', { id: 'aviation-explain-question', maxlength: '2048', autocomplete: 'off' });
    const send = element('button', 'Ask', { class: 'send', type: 'submit' }); form.append(label, question, send);
    dialog.append(header, facts, messages, status, form); root.append(style, trigger, dialog); document.body.append(host);
    elements = { trigger, dialog, context, messages, status, question, send };
    close.addEventListener('click', () => { void api.close(); });
    dialog.addEventListener('close', () => { if (!dialog.open) void reset(); });
    dialog.addEventListener('cancel', () => { void cancelPending(); });
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!state.pending && question.value.trim()) void ask(question.value);
    });
    trigger.addEventListener('click', () => {
      let value;
      try { value = state.provider?.getContext(); } catch { value = null; }
      void api.open(value, state.provider?.question);
    });
    return elements;
  }
  function busy(value) {
    const ui = mount(); ui.question.disabled = value || !state.available; ui.send.disabled = value || !state.available;
    ui.send.textContent = value ? 'Waiting…' : 'Ask';
  }
  function status(text, error = false) {
    const ui = mount(); ui.status.textContent = text; ui.status.classList.toggle('error', error);
    ui.status.setAttribute('role', error ? 'alert' : 'status');
  }
  function render() {
    const ui = mount(); ui.messages.replaceChildren();
    for (const message of state.messages) ui.messages.append(element('p', `${message.role === 'user' ? 'You' : 'Explanation'}: ${message.content}`,
      { class: `message ${message.role}` }));
    ui.messages.scrollTop = ui.messages.scrollHeight;
  }
  async function removeTicket(ticket) {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(`/api/explain/requests/${ticket.requestId}`, { method: 'DELETE',
        headers: { 'X-Aviation-Explain-Token': ticket.accessToken }, signal: controller.signal, cache: 'no-store' });
      await response.json();
    }
    catch { /* The broker's independent local expiry remains authoritative. */ }
    finally { clearTimeout(timeout); }
  }
  function cleanPending(pending) {
    if (pending.ticket && !pending.cleanup) pending.cleanup = removeTicket(pending.ticket);
    return pending.cleanup ?? Promise.resolve();
  }
  function cancelPending() {
    state.epoch++;
    const pending = state.pending; state.pending = null;
    if (!pending) return Promise.resolve();
    clearTimeout(pending.timer); pending.controller.abort(); busy(false);
    return cleanPending(pending);
  }
  function reset() {
    const cleanup = cancelPending();
    state.context = ''; state.history = []; state.messages = []; state.available = false;
    const ui = mount(); ui.context.textContent = ''; ui.messages.replaceChildren(); ui.question.value = ''; status(''); busy(false);
    return cleanup;
  }
  function clip(value, maximum) {
    if (bytes(value) <= maximum) return value;
    let output = ''; let size = 0;
    for (const character of value) { size += bytes(character); if (size > maximum - 3) break; output += character; }
    return output + '…';
  }
  function historyFor(question) {
    const history = state.history.slice(-12).map(message => ({ role: message.role, content: clip(message.content, 4096) }));
    while (history.length && bytes(state.context) + bytes(question) + history.reduce((sum, message) => sum + bytes(message.content), 0) > 32768) history.splice(0, 2);
    return history;
  }
  async function json(response) {
    if (!response.ok) {
      const messages = { 400: 'The decision facts or question are invalid.', 401: 'Explanation access was not authorized.',
        403: 'Explanation access was not authorized.', 404: 'This explanation request expired or is no longer available.',
        429: 'Too many explanation requests. Try again later.', 502: 'The AI provider could not accept this request.',
        503: 'AI explanations are not configured or are unavailable.', 504: 'The explanation request timed out.' };
      throw new DisplayError(messages[response.status] || 'The explanation service is unavailable.');
    }
    return response.json();
  }
  function pause(milliseconds, signal) {
    return new Promise((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(new Error('aborted')); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, milliseconds);
      if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
    });
  }
  async function ask(question) {
    if (state.pending || !state.available) return;
    if (typeof question !== 'string' || !question.trim() || bytes(question) > 2048) { status('Enter a shorter, nonempty question.', true); return; }
    const epoch = ++state.epoch;
    const pending = { controller: new AbortController(), ticket: null, timer: null, timedOut: false };
    pending.timer = setTimeout(() => { pending.timedOut = true; pending.controller.abort(); }, 15000);
    state.pending = pending; busy(true); status('Requesting an explanation…');
    const ui = mount(); ui.question.value = '';
    try {
      const ticket = await json(await fetch('/api/explain', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: state.context, question, history: historyFor(question) }), signal: pending.controller.signal, cache: 'no-store' }));
      if (!/^exp_[0-9a-f]{32}$/.test(ticket.requestId) || !/^[0-9a-f]{64}$/.test(ticket.accessToken)) throw new DisplayError('The explanation service returned an invalid response.');
      pending.ticket = ticket;
      if (state.epoch !== epoch) return;
      clearTimeout(pending.timer);
      pending.timer = setTimeout(() => { pending.timedOut = true; pending.controller.abort(); }, 120000);
      status('Waiting for the explanation…');
      while (state.epoch === epoch) {
        const result = await json(await fetch(`/api/explain/requests/${ticket.requestId}`, {
          headers: { 'X-Aviation-Explain-Token': ticket.accessToken }, signal: pending.controller.signal, cache: 'no-store' }));
        if (result.status === 'completed') {
          if (typeof result.explanation !== 'string' || !result.explanation.trim() || bytes(result.explanation) > 65536) throw new DisplayError('The explanation service returned an invalid response.');
          if (state.epoch !== epoch) return;
          state.history.push({ role: 'user', content: question }, { role: 'assistant', content: result.explanation });
          state.history = state.history.slice(-12);
          state.messages.push({ role: 'user', content: question }, { role: 'assistant', content: result.explanation });
          state.messages = state.messages.slice(-24); render(); status(''); return;
        }
        if (result.status !== 'queued') throw new DisplayError('The explanation service returned an invalid response.');
        await pause(500, pending.controller.signal);
      }
    } catch (error) {
      if (state.epoch === epoch) {
        status(pending.timedOut ? 'The explanation request timed out.' : error instanceof DisplayError ? error.message : 'The explanation service could not be reached.', true);
        ui.question.value = question;
      }
    } finally {
      clearTimeout(pending.timer);
      await cleanPending(pending);
      if (state.epoch === epoch) { state.pending = null; busy(false); if (ui.dialog.open) ui.question.focus(); }
    }
  }
  const api = Object.freeze({
    async open(context, question = initialQuestion) {
      void cancelPending();
      const ui = mount(); state.context = ''; ui.context.textContent = ''; ui.question.value = '';
      state.history = []; state.messages = []; state.available = false; render(); busy(false); status('Checking explanation availability…');
      if (!ui.dialog.open) ui.dialog.showModal();
      let text;
      try { text = typeof context === 'string' ? context : context == null ? '' : JSON.stringify(context, null, 2); } catch { text = ''; }
      if (!text?.trim() || bytes(text) > 16384) { status('Select a decision with concise facts to explain.', true); return; }
      state.context = text; ui.context.textContent = text;
      const epoch = state.epoch;
      const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const config = await json(await fetch('/api/explain/config', { signal: controller.signal, cache: 'no-store' }));
        clearTimeout(timeout);
        if (state.epoch !== epoch) return;
        if (config.available !== true) { status('AI explanations are not configured for this application.', true); return; }
        state.available = true; await ask(question);
      } catch (error) { if (state.epoch === epoch) status(error instanceof DisplayError ? error.message : 'The explanation service could not be reached.', true); }
      finally { clearTimeout(timeout); }
    },
    close() { const cleanup = reset(); const ui = mount(); if (ui.dialog.open) ui.dialog.close(); return cleanup; },
    registerContext(getContext, question) {
      if (typeof getContext !== 'function') throw new TypeError('A decision context provider is required');
      const provider = { getContext, question }; state.providers.push(provider); state.provider = provider;
      mount().trigger.hidden = false; void api.close();
      return () => {
        const index = state.providers.indexOf(provider);
        if (index < 0) return;
        state.providers.splice(index, 1);
        if (state.provider === provider) {
          state.provider = state.providers.at(-1) ?? null;
          mount().trigger.hidden = !state.provider; void api.close();
        }
      };
    },
  });
  window.AviationExplain = api;
  document.addEventListener('aviation:explain', event => { void api.open(event.detail?.context, event.detail?.question); });
})();
