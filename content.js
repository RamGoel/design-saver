(function () {
  'use strict';

  const PRESET_TAGS = [
    'Dashboard', 'Card', 'Dark theme', 'Light theme', 'Form',
    'Typography', 'Navigation', 'Hero', 'Table', 'Modal', 'Button', 'Chart',
  ];

  function getImageInfo(img) {
    const article = img.closest('article');
    if (!article) return null;

    const statusLink = article.querySelector('a[href*="/status/"]');
    const tweetUrl = statusLink
      ? 'https://x.com' + statusLink.getAttribute('href')
      : window.location.href;

    const userNameEl = article.querySelector('[data-testid="User-Name"]');
    const nameLinks = userNameEl ? userNameEl.querySelectorAll('a') : [];
    const author = nameLinks[0]?.textContent?.trim() || 'Unknown';
    const handle = nameLinks[1]?.textContent?.trim() || '';

    const tweetTextEl = article.querySelector('[data-testid="tweetText"]');
    const tweetText = (tweetTextEl?.textContent?.trim() || '').slice(0, 200);

    let imageUrl = img.src;
    if (imageUrl.includes('pbs.twimg.com')) {
      imageUrl = imageUrl.split('?')[0] + '?format=jpg&name=large';
    }
    const thumbUrl = imageUrl.includes('pbs.twimg.com')
      ? imageUrl.split('?')[0] + '?format=jpg&name=small'
      : imageUrl;

    return {
      id: 'dv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      imageUrl,
      thumbUrl,
      tweetUrl,
      author,
      handle,
      tweetText,
      savedAt: Date.now(),
      tags: [],
    };
  }

  function attachSaveButton(img) {
    if (img.dataset.dvAttached) return;
    img.dataset.dvAttached = 'true';

    img.addEventListener('mouseenter', () => {
      const container = img.closest('[data-testid="tweetPhoto"]') || img.parentElement;
      if (!container || container.querySelector('.dv-btn')) return;
      if (getComputedStyle(container).position === 'static') {
        container.style.position = 'relative';
      }

      const btn = document.createElement('button');
      btn.className = 'dv-btn';
      btn.textContent = '＋ Save';
      container.appendChild(btn);

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const info = getImageInfo(img);
        if (info) showDialog(info);
      });

      const leave = () => btn.remove();
      container.addEventListener('mouseleave', leave, { once: true });
      btn.addEventListener('mouseenter', () =>
        container.removeEventListener('mouseleave', leave)
      );
      btn.addEventListener('mouseleave', () =>
        container.addEventListener('mouseleave', leave, { once: true })
      );
    });
  }

  function showDialog(info) {
    document.querySelector('.dv-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'dv-overlay';
    overlay.innerHTML = `
      <div class="dv-dialog">
        <div class="dv-dialog-head">
          <span class="dv-dialog-title">Save to Design Vault</span>
          <button class="dv-x">✕</button>
        </div>
        <div class="dv-dialog-body">
          <div class="dv-img-wrap">
            <img class="dv-preview" src="${info.thumbUrl}" alt="" />
          </div>
          <div class="dv-meta">
            <span class="dv-name">${info.author}</span>
            ${info.handle ? `<span class="dv-handle">${info.handle}</span>` : ''}
          </div>
          <div class="dv-tag-section">
            <div class="dv-tag-label">Tags</div>
            <div class="dv-chips">
              ${PRESET_TAGS.map((t) => `<button class="dv-chip" data-tag="${t.toLowerCase()}">${t}</button>`).join('')}
            </div>
            <input class="dv-custom" type="text" placeholder="Custom tag  (press Enter)" />
          </div>
        </div>
        <div class="dv-dialog-foot">
          <button class="dv-cancel">Cancel</button>
          <button class="dv-save">Save Design</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const selected = new Set();

    overlay.querySelectorAll('.dv-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const tag = chip.dataset.tag;
        chip.classList.toggle('active');
        selected.has(tag) ? selected.delete(tag) : selected.add(tag);
      });
    });

    const customInput = overlay.querySelector('.dv-custom');
    customInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = customInput.value.trim().toLowerCase();
        if (val && !selected.has(val)) {
          selected.add(val);
          const chip = document.createElement('button');
          chip.className = 'dv-chip active custom';
          chip.dataset.tag = val;
          chip.textContent = val;
          chip.addEventListener('click', () => {
            chip.classList.toggle('active');
            selected.has(val) ? selected.delete(val) : selected.add(val);
          });
          overlay.querySelector('.dv-chips').appendChild(chip);
        }
        customInput.value = '';
      }
    });

    const close = () => overlay.remove();
    overlay.querySelector('.dv-x').addEventListener('click', close);
    overlay.querySelector('.dv-cancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    overlay.querySelector('.dv-save').addEventListener('click', async () => {
      const customVal = customInput.value.trim().toLowerCase();
      if (customVal) selected.add(customVal);
      info.tags = [...selected];

      const result = await chrome.storage.local.get('designs');
      const designs = result.designs || [];
      designs.unshift(info);
      if (designs.length > 500) designs.length = 500;
      await chrome.storage.local.set({ designs });
      close();
      toast('Saved to Design Vault ✓');
    });
  }

  function toast(msg) {
    document.querySelector('.dv-toast')?.remove();
    const el = document.createElement('div');
    el.className = 'dv-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      setTimeout(() => el.remove(), 350);
    }, 2200);
  }

  const observer = new MutationObserver(() => {
    document.querySelectorAll('[data-testid="tweetPhoto"] img:not([data-dv-attached])').forEach(attachSaveButton);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  document.querySelectorAll('[data-testid="tweetPhoto"] img:not([data-dv-attached])').forEach(attachSaveButton);
})();
