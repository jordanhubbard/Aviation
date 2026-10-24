(() => {
  if (document.getElementById('aviation-feedback-button')) return;
  const host = location.hostname.split('.')[0];
  const app = host === 'kmlab' ? 'flight-track-analyzer' : host;
  const style = document.createElement('style');
  style.textContent = '#aviation-feedback-button{position:fixed;right:16px;bottom:16px;z-index:2147483646;background:#123c64;color:white;border:1px solid white;border-radius:8px;padding:9px 13px;cursor:pointer;box-shadow:0 2px 8px #0006}#aviation-feedback-dialog{z-index:2147483647;border:1px solid #567;border-radius:10px;max-width:min(90vw,500px);width:100%;padding:20px}#aviation-feedback-dialog textarea{box-sizing:border-box;width:100%;min-height:130px;margin:8px 0}#aviation-feedback-dialog menu{display:flex;justify-content:flex-end;gap:8px;padding:0}';
  document.head.appendChild(style);
  const button = document.createElement('button');
  button.id = 'aviation-feedback-button';
  button.type = 'button';
  button.textContent = 'Submit feedback';
  const dialog = document.createElement('dialog');
  dialog.id = 'aviation-feedback-dialog';
  dialog.innerHTML = '<form><h2>Submit feedback</h2><p>Your comment will create an issue in the Aviation repository with this app and page attached.</p><label for="aviation-feedback-message">Feedback</label><textarea id="aviation-feedback-message" required maxlength="4000"></textarea><p role="status" id="aviation-feedback-status"></p><menu><button type="button" id="aviation-feedback-cancel">Cancel</button><button type="submit">Submit issue</button></menu></form>';
  document.body.append(button, dialog);
  const form = dialog.querySelector('form');
  const status = dialog.querySelector('#aviation-feedback-status');
  button.onclick = () => dialog.showModal();
  dialog.querySelector('#aviation-feedback-cancel').onclick = () => dialog.close();
  form.onsubmit = async event => {
    event.preventDefault();
    const submit = form.querySelector('[type=submit]');
    submit.disabled = true;
    status.textContent = 'Submitting…';
    try {
      const response = await fetch('https://meta-app.jordanhubbard.net/api/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app, page: location.pathname, title: document.title,
          message: dialog.querySelector('textarea').value }),
      });
      if (!response.ok) throw new Error(`Submission failed (${response.status})`);
      const issue = await response.json();
      status.replaceChildren('Created issue ', Object.assign(document.createElement('a'),
        { href: issue.url, textContent: `#${issue.number}`, target: '_blank', rel: 'noopener noreferrer' }));
      dialog.querySelector('textarea').value = '';
    } catch (error) { status.textContent = String(error); }
    finally { submit.disabled = false; }
  };
})();
