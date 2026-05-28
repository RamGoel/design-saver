(async function () {
  'use strict';

  // ── State ───────────────────────────────────────────────────────────────
  let designs = [];
  let activeTag = 'all';
  let query = '';
  let dragSrcId = null;

  // ── DOM refs ─────────────────────────────────────────────────────────────
  const masonryEl   = document.getElementById('masonry');
  const emptyEl     = document.getElementById('empty');
  const noResultsEl = document.getElementById('noResults');
  const tagNavEl    = document.getElementById('tagNav');
  const searchEl    = document.getElementById('search');
  const totalCountEl= document.getElementById('totalCount');
  const countAllEl  = document.getElementById('countAll');
  const addBtn      = document.getElementById('addBtn');
  const addBar      = document.getElementById('addBar');
  const addInput    = document.getElementById('addInput');
  const addConfirm  = document.getElementById('addConfirm');
  const addCancel   = document.getElementById('addCancel');
  const lightbox    = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxMeta= document.getElementById('lightboxMeta');
  const lightboxClose=document.getElementById('lightboxClose');
  const exportBtn   = document.getElementById('exportBtn');
  const clearBtn    = document.getElementById('clearBtn');

  // ── Load ─────────────────────────────────────────────────────────────────
  async function load() {
    const result = await chrome.storage.local.get('designs');
    designs = result.designs || [];
    rebuildSidebar();
    render();
  }

  // ── Sidebar tag nav ───────────────────────────────────────────────────────
  function rebuildSidebar() {
    const tagCounts = {};
    designs.forEach(d => (d.tags || []).forEach(t => {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    }));

    const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);

    tagNavEl.innerHTML = '';
    countAllEl.textContent = designs.length;

    // "All" button
    appendTagBtn('all', 'All', designs.length, 0);

    // Per-tag buttons
    sorted.forEach(([tag, cnt], i) => {
      appendTagBtn(tag, tag, cnt, (i + 1) % 8);
    });

    totalCountEl.textContent = designs.length
      ? `${designs.length} design${designs.length !== 1 ? 's' : ''}`
      : '';
  }

  function appendTagBtn(tag, label, count, dotIdx) {
    const btn = document.createElement('button');
    btn.className = 'tag-item' + (tag === activeTag ? ' active' : '');
    btn.dataset.tag = tag;
    btn.innerHTML = `
      <span class="tag-dot dot-${dotIdx}"></span>
      ${label}
      <span class="tag-count">${count}</span>
    `;
    btn.addEventListener('click', () => {
      activeTag = tag;
      tagNavEl.querySelectorAll('.tag-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      render();
    });
    tagNavEl.appendChild(btn);
  }

  // ── Filtered list ─────────────────────────────────────────────────────────
  function filtered() {
    let list = designs;
    if (activeTag !== 'all') {
      list = list.filter(d => (d.tags || []).includes(activeTag));
    }
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(d =>
        d.author?.toLowerCase().includes(q) ||
        d.handle?.toLowerCase().includes(q) ||
        d.tweetText?.toLowerCase().includes(q) ||
        d.title?.toLowerCase().includes(q) ||
        (d.tags || []).some(t => t.includes(q))
      );
    }
    return list;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function render() {
    const list = filtered();

    masonryEl.style.display = 'none';
    emptyEl.style.display = 'none';
    noResultsEl.style.display = 'none';

    if (designs.length === 0) {
      emptyEl.style.display = 'flex';
      return;
    }
    if (list.length === 0) {
      noResultsEl.style.display = 'flex';
      return;
    }

    masonryEl.style.display = 'block';
    masonryEl.innerHTML = '';
    list.forEach(d => masonryEl.appendChild(makeCard(d)));
  }

  // ── Card factory ──────────────────────────────────────────────────────────
  function makeCard(design) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = design.id;
    card.draggable = true;

    const imgSrc = design.thumbUrl || design.imageUrl || design.ogImage || '';
    const author  = design.author || design.ogTitle || 'Unknown';
    const handle  = design.handle || '';
    const tags    = design.tags || [];
    const ago     = timeAgo(design.savedAt);

    card.innerHTML = `
      <div class="card-img-wrap">
        ${imgSrc
          ? `<img class="card-img" src="${imgSrc}" alt="" loading="lazy" />`
          : `<div class="card-broken">◻</div>`
        }
        <div class="card-overlay">
          <div class="card-overlay-author">${escHtml(author)}</div>
          ${handle ? `<div class="card-overlay-handle">${escHtml(handle)}</div>` : ''}
          <div class="card-overlay-actions">
            <button class="card-overlay-btn view-btn">↗ View source</button>
            <button class="card-overlay-btn zoom-btn">⤢ Zoom</button>
            <button class="card-overlay-btn del del-btn">✕</button>
          </div>
        </div>
      </div>
      ${tags.length ? `
        <div class="card-footer">
          <div class="card-tags">
            ${tags.slice(0, 5).map(t => `<span class="card-tag">${escHtml(t)}</span>`).join('')}
            ${tags.length > 5 ? `<span class="card-tag">+${tags.length - 5}</span>` : ''}
          </div>
          <div class="card-date">${ago}</div>
        </div>
      ` : `<div class="card-footer"><div class="card-date">${ago}</div></div>`}
    `;

    // Image error fallback
    const img = card.querySelector('.card-img');
    if (img) {
      img.addEventListener('error', () => {
        img.replaceWith(Object.assign(document.createElement('div'), {
          className: 'card-broken', textContent: '◻'
        }));
      });
    }

    // Actions
    card.querySelector('.view-btn').addEventListener('click', e => {
      e.stopPropagation();
      chrome.tabs.create({ url: design.tweetUrl || design.url });
    });

    card.querySelector('.zoom-btn').addEventListener('click', e => {
      e.stopPropagation();
      openLightbox(design);
    });

    card.querySelector('.del-btn').addEventListener('click', async e => {
      e.stopPropagation();
      designs = designs.filter(d => d.id !== design.id);
      await save();
      rebuildSidebar();
      render();
    });

    card.addEventListener('click', () => openLightbox(design));

    // Drag and drop
    card.addEventListener('dragstart', e => {
      dragSrcId = design.id;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      masonryEl.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
    });
    card.addEventListener('dragover', e => {
      e.preventDefault();
      if (dragSrcId && dragSrcId !== design.id) {
        card.classList.add('drag-over');
      }
    });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', e => {
      e.preventDefault();
      card.classList.remove('drag-over');
      if (dragSrcId && dragSrcId !== design.id) {
        const srcIdx = designs.findIndex(d => d.id === dragSrcId);
        const dstIdx = designs.findIndex(d => d.id === design.id);
        if (srcIdx !== -1 && dstIdx !== -1) {
          const [moved] = designs.splice(srcIdx, 1);
          designs.splice(dstIdx, 0, moved);
          save().then(() => { rebuildSidebar(); render(); });
        }
      }
    });

    return card;
  }

  // ── Lightbox ───────────────────────────────────────────────────────────────
  function openLightbox(design) {
    lightboxImg.src = design.imageUrl || design.ogImage || design.thumbUrl || '';
    lightboxMeta.innerHTML = `
      ${design.author || design.ogTitle
        ? `<div class="lightbox-author">${escHtml(design.author || design.ogTitle || '')}</div>`
        : ''}
      ${design.handle ? `<div class="lightbox-handle">${escHtml(design.handle)}</div>` : ''}
      ${(design.tags || []).length
        ? `<div class="lightbox-tags">${design.tags.map(t =>
            `<span class="lightbox-tag">${escHtml(t)}</span>`).join('')}</div>`
        : ''}
      <a class="lightbox-link" href="${design.tweetUrl || design.url || '#'}" target="_blank" rel="noopener">
        ↗ View original
      </a>
    `;
    lightbox.style.display = 'flex';
  }

  lightboxClose.addEventListener('click', () => { lightbox.style.display = 'none'; });
  lightbox.addEventListener('click', e => {
    if (e.target === lightbox) lightbox.style.display = 'none';
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') lightbox.style.display = 'none';
  });

  // ── Add URL ───────────────────────────────────────────────────────────────
  addBtn.addEventListener('click', () => {
    addBar.style.display = 'flex';
    addInput.focus();
  });

  addCancel.addEventListener('click', () => {
    addBar.style.display = 'none';
    addInput.value = '';
  });

  addInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') addConfirm.click();
    if (e.key === 'Escape') addCancel.click();
  });

  addConfirm.addEventListener('click', async () => {
    const url = addInput.value.trim();
    if (!url || !isValidUrl(url)) return;

    // Request optional host permission for OG fetching (must be in user gesture)
    const hasPermission = await new Promise(resolve => {
      chrome.permissions.contains({ origins: ['<all_urls>'] }, resolve);
    });
    if (!hasPermission) {
      await new Promise(resolve => {
        chrome.permissions.request({ origins: ['<all_urls>'] }, resolve);
      });
    }

    addConfirm.disabled = true;
    addConfirm.textContent = '…';

    // Add a placeholder card while fetching
    const placeholderId = 'dv_' + Date.now() + '_url';
    const placeholder = {
      id: placeholderId,
      url,
      tweetUrl: url,
      author: new URL(url).hostname,
      tags: [],
      savedAt: Date.now(),
      _pending: true,
    };
    designs.unshift(placeholder);
    rebuildSidebar();
    render();

    // Fetch OG data in background
    try {
      const og = await fetchOG(url);
      const idx = designs.findIndex(d => d.id === placeholderId);
      if (idx !== -1) {
        designs[idx] = {
          ...designs[idx],
          ogImage: og.image || '',
          thumbUrl: og.image || '',
          imageUrl: og.image || '',
          title: og.title || new URL(url).hostname,
          author: og.title || new URL(url).hostname,
          tweetText: og.description || '',
          _pending: false,
        };
        await save();
        rebuildSidebar();
        render();
      }
    } catch (_) {
      // Keep placeholder without image — still saved
      const idx = designs.findIndex(d => d.id === placeholderId);
      if (idx !== -1) {
        designs[idx]._pending = false;
        await save();
        rebuildSidebar();
        render();
      }
    }

    addConfirm.disabled = false;
    addConfirm.textContent = 'Add';
    addInput.value = '';
    addBar.style.display = 'none';
  });

  async function fetchOG(url) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'FETCH_OG', url }, (resp) => {
        if (chrome.runtime.lastError || !resp || resp.error) reject(new Error('fetch failed'));
        else resolve(resp);
      });
    });
  }

  // ── Export ────────────────────────────────────────────────────────────────
  exportBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(designs, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'design-vault.json';
    a.click();
  });

  // ── Clear all ─────────────────────────────────────────────────────────────
  clearBtn.addEventListener('click', async () => {
    if (!confirm('Delete all saved designs? This cannot be undone.')) return;
    designs = [];
    await save();
    activeTag = 'all';
    rebuildSidebar();
    render();
  });

  // ── Search ────────────────────────────────────────────────────────────────
  searchEl.addEventListener('input', () => {
    query = searchEl.value.trim();
    render();
  });

  // ── Storage helpers ───────────────────────────────────────────────────────
  async function save() {
    await chrome.storage.local.set({ designs });
  }

  // React to saves from content script (popup stays live)
  chrome.storage.onChanged.addListener(changes => {
    if (changes.designs) {
      designs = changes.designs.newValue || [];
      rebuildSidebar();
      render();
    }
  });

  // ── Utilities ─────────────────────────────────────────────────────────────
  function timeAgo(ts) {
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    return new Date(ts).toLocaleDateString();
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isValidUrl(str) {
    try { new URL(str); return true; } catch { return false; }
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  await load();
})();
