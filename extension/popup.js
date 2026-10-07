const DEFAULT_TARGET = 'http://localhost:3000';
const isLocal = (url) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\//.test(url);

const sourceInput = document.getElementById('source');
const targetInput = document.getElementById('target');
const statusEl = document.getElementById('status');

const setStatus = (message, isError = false) => {
  statusEl.textContent = message;
  statusEl.className = isError ? 'error' : '';
};

const parseOrigin = (value, label) => {
  try {
    const url = new URL(value.trim());
    if (!url.protocol.startsWith('http')) throw new Error();
    return url;
  } catch {
    throw new Error(`${label} must be a full http(s) URL, e.g. https://app.example.com`);
  }
};

const SHORT_SLDS = new Set(['co', 'com', 'org', 'net', 'gov', 'ac', 'edu']);

const sitePattern = ({ hostname }) => {
  const labels = hostname.split('.');
  if (labels.length < 2 || /^[\d.]+$|^\[/.test(hostname)) return `*://${hostname}/*`;
  const take =
    labels.length > 2 && SHORT_SLDS.has(labels.at(-2)) && labels.at(-1).length === 2 ? 3 : 2;
  return `*://*.${labels.slice(-take).join('.')}/*`;
};

const readInputs = () => {
  const source = parseOrigin(sourceInput.value, 'Source');
  const target = parseOrigin(targetInput.value, 'Target');
  if (source.origin === target.origin) {
    throw new Error('Source and target must be different sites.');
  }
  return { source, target };
};

const ensureAccess = async (...urls) => {
  const granted = await chrome.permissions.request({ origins: urls.map(sitePattern) });
  if (!granted) throw new Error('Site access was not granted.');
};

const readSourceCookies = async (source) => {
  const cookies = await chrome.cookies.getAll({ url: source.href });
  if (cookies.length === 0) {
    throw new Error(`No cookies found for ${source.origin}. Are you signed in there?`);
  }
  return cookies;
};

const init = async () => {
  const saved = await chrome.storage.local.get(['source', 'target', 'targets']);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const tabUrl = tab?.url ?? '';
  const source =
    tabUrl.startsWith('http') && !isLocal(tabUrl) ? new URL(tabUrl).origin : (saved.source ?? '');
  sourceInput.value = source;
  targetInput.value = saved.targets?.[source] ?? saved.target ?? DEFAULT_TARGET;
};

const sync = async () => {
  const { source, target } = readInputs();
  await ensureAccess(source, target);

  const cookies = await readSourceCookies(source);
  const { targets = {} } = await chrome.storage.local.get('targets');
  await chrome.storage.local.set({
    source: source.origin,
    target: target.origin,
    targets: { ...targets, [source.origin]: target.origin },
  });

  const results = await Promise.allSettled(
    cookies.map((c) =>
      chrome.cookies.set({
        url: `${target.origin}/`,
        name: c.name,
        value: c.value,
        path: '/',
        httpOnly: false,
        secure: target.protocol === 'https:',
        sameSite: 'lax',
        ...(c.session ? {} : { expirationDate: c.expirationDate }),
      }),
    ),
  );

  const failed = cookies
    .filter((_, i) => results[i].status === 'rejected' || results[i].value === null)
    .map((c) => c.name);

  const [targetTab] = await chrome.tabs.query({ url: `${target.origin}/*` });
  if (targetTab) await chrome.tabs.reload(targetTab.id);

  setStatus(
    `Copied ${cookies.length - failed.length}/${cookies.length} cookies from ${source.origin} to ${target.origin}.` +
      (failed.length ? `\nFailed: ${failed.join(', ')}` : '') +
      (targetTab ? '\nReloaded target tab.' : ''),
    failed.length > 0,
  );
};

const copyScript = async () => {
  const source = parseOrigin(sourceInput.value, 'Source');
  await ensureAccess(source);

  const cookies = await readSourceCookies(source);
  const script = cookies.map((c) => `document.cookie = "${c.name}=${c.value}"`).join('\n');
  await navigator.clipboard.writeText(script);
  setStatus(`Copied ${cookies.length} document.cookie lines to clipboard.`);
};

const run = (fn) => () => fn().catch((err) => setStatus(err.message, true));

document.getElementById('sync').addEventListener('click', run(sync));
document.getElementById('script').addEventListener('click', run(copyScript));
init().catch((err) => setStatus(err.message, true));
