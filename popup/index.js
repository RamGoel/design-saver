(async function () {
  const galleryEl = document.getElementById('gallery');
  const emptyEl = document.getElementById('empty');
  const filterBar = document.getElementById('filterBar');
  const searchEl = document.getElementById('search');
  const countEl = document.getElementById('count');

  let allDesigns = [];
  let activeTag = 'all';
  let query = '';

  async function load() {
    const result = await chrome.storage.local.get('designs');
    allDesigns = result.designs || [];
    rebuildFilters();
    render();
  }

  function rebuildFilters() {
    const tagCounts = {};
    allDesigns.forEach((d) => {
      (d.tags || []).forEach((t) => {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      });
    });

    const sortedTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t);

    filterBar.innerHTML = '';
    ['all', ...sortedTags].forEach((tag) => {
      const btn = document.createElement('button');
      btn.className = 'chip' + (tag === activeTag ? ' active' : '');
      btn.dataset.tag = tag;
      btn.textContent = tag === 'all' ? 'All' : tag;
      btn.addEventListener('click', () => {
        activeTag = tag;
        filterBar.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
        btn.classList.add('active');
        render();
      });
      filterBar.appendChild(btn);
    });
  }

  function filtered() {
    let list = allDesigns;

    if (activeTag !== 'all') {
      list = list.filter((d) => (d.tags || []).includes(activeTag));
    }

    if (query) {
      const q = query.toLowerCase();
      list = list.filter(
        (d) =>
          d.author?.toLowerCase().includes(q) ||
          d.handle?.toLowerCase().includes(q) ||
          d.tweetText?.toLowerCase().includes(q) ||
          (d.tags || []).some((t) => t.includes(q))
      );
    }

    return list;
  }

  function render() {
    const list = filtered();
    countEl.textContent = allDesigns.length
      ? allDesigns.length + ' saved'
      : '';

    if (allDesigns.length === 0) {
      galleryEl.style.display = 'none';
      emptyEl.style.display = 'flex';
      return;
    }

    galleryEl.style.display = 'grid';
    emptyEl.style.display = 'none';

    if (list.length === 0) {
      galleryEl.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px 0;color:#333;font-size:13px;">No results</div>`;
      return;
    }

    galleryEl.innerHTML = '';
    list.forEach((design) => {
      galleryEl.appendChild(makeCard(design));
    });
  }

  function makeCard(design) {
    const card = document.createElement('div');
    card.className = 'card';

    const ago = timeAgo(design.savedAt);

    card.innerHTML = `
      <div class="card-img-wrap">
        <img
          class="card-img"
          src="${design.thumbUrl || design.imageUrl}"
          alt=""
          data-id="${design.id}"
          onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
        />
        <div class="card-img-error" style="display:none">◻</div>
        <div class="card-actions">
          <button class="card-action-btn view-btn" data-url="${design.tweetUrl}">View tweet</button>
          <button class="card-action-btn del" data-id="${design.id}">Delete</button>
        </div>
      </div>
      <div class="card-body">
        <div class="card-author">${design.author || 'Unknown'}</div>
        ${design.handle ? `<div class="card-handle">${design.handle}</div>` : ''}
        ${
          design.tags?.length
            ? `<div class="card-tags">${design.tags
                .slice(0, 4)
                .map((t) => `<span class="card-tag">${t}</span>`)
                .join('')}${design.tags.length > 4 ? `<span class="card-tag">+${design.tags.length - 4}</span>` : ''}</div>`
            : ''
        }
        <div class="card-date">${ago}</div>
      </div>
    `;

    card.querySelector('.view-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.tabs.create({ url: e.currentTarget.dataset.url });
    });

    card.querySelector('.del').addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = e.currentTarget.dataset.id;
      allDesigns = allDesigns.filter((d) => d.id !== id);
      await chrome.storage.local.set({ designs: allDesigns });
      rebuildFilters();
      render();
    });

    card.addEventListener('click', () => {
      chrome.tabs.create({ url: design.tweetUrl });
    });

    return card;
  }

  function timeAgo(ts) {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    return new Date(ts).toLocaleDateString();
  }

  // Search
  searchEl.addEventListener('input', () => {
    query = searchEl.value.trim();
    render();
  });

  // Open full moodboard gallery in tab
  document.getElementById('fullView').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('gallery/index.html') });
  });

  // Clear all
  document.getElementById('clearAll').addEventListener('click', async () => {
    if (!confirm('Delete all saved designs?')) return;
    allDesigns = [];
    await chrome.storage.local.set({ designs: [] });
    activeTag = 'all';
    rebuildFilters();
    render();
  });

  // Reload when storage changes (e.g. new save from content script)
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.designs) {
      allDesigns = changes.designs.newValue || [];
      rebuildFilters();
      render();
    }
  });

  await load();
})();
