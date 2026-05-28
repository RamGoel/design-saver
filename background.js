// ── Setup ───────────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get('designs', r => {
    if (!r.designs) chrome.storage.local.set({ designs: [] });
  });

  // Right-click context menu on any image, on any website
  chrome.contextMenus.create({
    id: 'save-design',
    title: 'Save to Design Vault',
    contexts: ['image'],
  });
});

// ── Context menu save (works on every site) ─────────────────────────────────
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'save-design') return;

  const pageUrl  = info.pageUrl  || tab?.url || '';
  const imageUrl = info.srcUrl   || '';
  const hostname = safeHostname(pageUrl);

  const design = {
    id:        'dv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    imageUrl,
    thumbUrl:  imageUrl,
    tweetUrl:  pageUrl,
    url:       pageUrl,
    author:    tab?.title ? trimTitle(tab.title) : hostname,
    handle:    hostname,
    tweetText: '',
    tags:      [],
    savedAt:   Date.now(),
    source:    'context-menu',
  };

  const result  = await chrome.storage.local.get('designs');
  const designs = result.designs || [];
  designs.unshift(design);
  if (designs.length > 500) designs.length = 500;
  await chrome.storage.local.set({ designs });

  // Brief badge feedback on the active tab
  if (tab?.id) {
    chrome.action.setBadgeText({ text: '✓', tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#6366f1', tabId: tab.id });
    setTimeout(() => chrome.action.setBadgeText({ text: '', tabId: tab.id }), 2000);
  }
});

// ── OG fetch (used by gallery "Add URL") ────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'FETCH_OG') return false;

  fetch(msg.url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DesignVault/1.0)' },
  })
    .then(r => r.text())
    .then(html => {
      sendResponse({
        image:       ogTag(html, 'og:image')       || ogTag(html, 'twitter:image') || null,
        title:       ogTag(html, 'og:title')        || ogTag(html, 'twitter:title') || null,
        description: ogTag(html, 'og:description')  || ogTag(html, 'twitter:description') || null,
      });
    })
    .catch(() => sendResponse({ error: true }));

  return true; // keep channel open for async response
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function ogTag(html, prop) {
  // Match property= or name= before OR after content=
  const a = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'));
  if (a) return a[1];
  const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'));
  return b ? b[1] : null;
}

function safeHostname(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

function trimTitle(title) {
  // Strip common suffixes like "| Dribbble", "— Behance" etc.
  return title.replace(/[\|—–-].*$/, '').trim() || title;
}
