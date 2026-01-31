// ==UserScript==
// @name         Statistics ITD (StatisticsИТД)
// @namespace    https://github.com/
// @version      1.0.0
// @description  Show account stats (likes, posts, views, reposts, growth) with interactive charts on итд.com profile pages
// @author       You
// @match        https://xn--d1ah4a.com/*
// @match        https://итд.com/*
// @match        http://xn--d1ah4a.com/*
// @match        http://итд.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=xn--d1ah4a.com
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const BASE = location.origin;
  const STORAGE_KEY = 'StatisticsITD_snapshots';
  const PANEL_VISIBLE_KEY = 'StatisticsITD_panelVisible';
  const PANEL_POS_KEY = 'StatisticsITD_panelPos';

  // --- Get username from current page ---
  function getUsername() {
    // URL patterns: /profile/username, /user/username, /@username
    const path = location.pathname.replace(/^\/+|\/+$/g, '');
    const segments = path.split('/');
    for (let i = 0; i < segments.length; i++) {
      if (['profile', 'user', 'u'].includes(segments[i]) && segments[i + 1]) {
        return segments[i + 1].replace(/^@/, '');
      }
      if (segments[i].startsWith('@')) return segments[i].slice(1);
    }
    // Fallback: try data attributes or meta (site-specific)
    const meta = document.querySelector('meta[property="profile:username"], meta[name="username"]');
    if (meta && meta.content) return meta.content.trim();
    const link = document.querySelector('a[href*="/profile/"], a[href*="/user/"]');
    if (link && link.href) {
      const m = link.href.match(/\/(?:profile|user)\/([^/?]+)/);
      if (m) return m[1];
    }
    return null;
  }

  // --- API ---
  async function api(path) {
    const r = await fetch(BASE + path, { credentials: 'include', headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(r.status);
    const data = await r.json();
    return data?.data ?? data;
  }

  async function getProfile(username) {
    return api(`/api/users/${encodeURIComponent(username)}`);
  }

  async function getPosts(username, limit = 50) {
    const data = await api(`/api/posts/user/${encodeURIComponent(username)}?limit=${limit}&sort=new`);
    return data?.posts ?? [];
  }

  // --- Storage (growth snapshots) ---
  function getSnapshots() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function saveSnapshot(username, snapshot) {
    const all = getSnapshots();
    if (!all[username]) all[username] = [];
    all[username].unshift({ ...snapshot, date: new Date().toISOString() });
    all[username] = all[username].slice(0, 30); // keep last 30
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  function getLastSnapshot(username) {
    const all = getSnapshots();
    const list = all[username];
    return list && list.length ? list[0] : null;
  }

  // --- Build stats from profile + posts ---
  function aggregate(profile, posts) {
    let totalLikes = 0, totalViews = 0, totalComments = 0, totalReposts = 0;
    const byViews = [];
    for (const p of posts) {
      totalLikes += p.likesCount || 0;
      totalViews += p.viewsCount || 0;
      totalComments += p.commentsCount || 0;
      totalReposts += p.repostsCount || 0;
      byViews.push({
        id: p.id,
        content: (p.content || '').slice(0, 40),
        views: p.viewsCount || 0,
        likes: p.likesCount || 0,
        comments: p.commentsCount || 0,
        reposts: p.repostsCount || 0,
        createdAt: p.createdAt,
      });
    }
    byViews.sort((a, b) => b.views - a.views);
    const count = posts.length;
    const avgViews = count ? Math.round(totalViews / count) : 0;
    const engagementRate = totalViews > 0
      ? ((totalLikes + totalComments + totalReposts) / totalViews * 100).toFixed(2) + '%'
      : '—';
    return {
      profile,
      posts,
      totalLikes,
      totalViews,
      totalComments,
      totalReposts,
      postCount: count,
      avgViews,
      engagementRate,
      byViews,
    };
  }

  // --- Growth vs last snapshot ---
  function growth(current, last) {
    if (!last) return null;
    const f = (a, b) => (b === 0 ? (a === 0 ? 0 : 100) : Math.round((a - b) / b * 100));
    return {
      followers: f(current.followersCount, last.followersCount),
      following: f(current.followingCount, last.followingCount),
      posts: f(current.postsCount, last.postsCount),
      totalLikes: f(current.totalLikes, last.totalLikes),
      totalViews: f(current.totalViews, last.totalViews),
      date: last.date,
    };
  }

  // --- Load Chart.js ---
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // --- Toggle button (show/hide panel) ---
  let panelRoot = null;
  let panelVisible = true;

  function createToggleButton() {
    const btn = document.createElement('button');
    btn.id = 'StatisticsITD-toggle';
    btn.innerHTML = '📊 Stats';
    btn.title = 'Show/hide Statistics ITD panel';
    Object.assign(btn.style, {
      position: 'fixed',
      bottom: '16px',
      right: '16px',
      zIndex: '2147483646',
      padding: '8px 14px',
      borderRadius: '8px',
      border: '1px solid #444',
      background: 'linear-gradient(180deg, #2d3748 0%, #1a202c 100%)',
      color: '#e2e8f0',
      cursor: 'pointer',
      fontSize: '14px',
      fontFamily: 'system-ui, sans-serif',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    });
    btn.addEventListener('click', () => {
      panelVisible = !panelVisible;
      if (panelRoot) panelRoot.style.display = panelVisible ? 'block' : 'none';
      try { localStorage.setItem(PANEL_VISIBLE_KEY, panelVisible ? '1' : '0'); } catch (_) {}
    });
    document.body.appendChild(btn);
  }

  // --- Draggable panel ---
  function createPanel() {
    const pos = (() => {
      try {
        const raw = localStorage.getItem(PANEL_POS_KEY);
        if (raw) {
          const p = JSON.parse(raw);
          if (typeof p.x === 'number' && typeof p.y === 'number') return p;
        }
      } catch (_) {}
      return { x: 24, y: 80 };
    })();

    const wrap = document.createElement('div');
    wrap.id = 'StatisticsITD-root';
    Object.assign(wrap.style, {
      position: 'fixed',
      left: pos.x + 'px',
      top: pos.y + 'px',
      width: '420px',
      maxWidth: 'calc(100vw - 48px)',
      maxHeight: 'calc(100vh - 100px)',
      overflow: 'auto',
      zIndex: '2147483645',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
      color: '#e2e8f0',
      borderRadius: '12px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      border: '1px solid #334155',
    });

    const header = document.createElement('div');
    header.textContent = 'Statistics ITD';
    Object.assign(header.style, {
      padding: '10px 14px',
      cursor: 'move',
      userSelect: 'none',
      borderBottom: '1px solid #334155',
      background: 'rgba(0,0,0,0.2)',
      borderRadius: '12px 12px 0 0',
      fontWeight: '600',
    });

    const body = document.createElement('div');
    body.style.padding = '12px';
    body.innerHTML = '<p style="color:#94a3b8">Loading…</p>';

    wrap.appendChild(header);
    wrap.appendChild(body);

    // Drag
    let dx = 0, dy = 0;
    header.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      dx = e.clientX - wrap.getBoundingClientRect().left;
      dy = e.clientY - wrap.getBoundingClientRect().top;
      const onMove = (e2) => {
        let x = e2.clientX - dx;
        let y = e2.clientY - dy;
        x = Math.max(0, Math.min(x, window.innerWidth - wrap.offsetWidth));
        y = Math.max(0, Math.min(y, window.innerHeight - wrap.offsetHeight));
        wrap.style.left = x + 'px';
        wrap.style.top = y + 'px';
        try { localStorage.setItem(PANEL_POS_KEY, JSON.stringify({ x, y })); } catch (_) {}
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    document.body.appendChild(wrap);
    panelRoot = wrap;
    return body;
  }

  // --- Render content ---
  function formatNum(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
  }

  function render(body, username, stats, growthData) {
    const g = growthData;
    const lastDate = g?.date ? new Date(g.date).toLocaleDateString() : '';

    let html = `
    <div style="margin-bottom:12px">
      <strong>@${username}</strong>
      ${stats.profile?.displayName ? `<div style="color:#94a3b8;font-size:12px">${escapeHtml(stats.profile.displayName)}</div>` : ''}
      ${stats.profile?.createdAt ? `<div style="color:#64748b;font-size:11px">Account since ${new Date(stats.profile.createdAt).toLocaleDateString()}</div>` : ''}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
      <div class="stat-card" style="background:rgba(255,255,255,0.06);padding:10px;border-radius:8px;text-align:center">
        <div style="font-size:11px;color:#94a3b8">Followers</div>
        <div style="font-size:20px;font-weight:700">${formatNum(stats.profile?.followersCount ?? 0)}</div>
        ${g && g.followers != null ? `<div style="font-size:11px;color:${g.followers >= 0 ? '#4ade80' : '#f87171'}">${g.followers >= 0 ? '+' : ''}${g.followers}% vs ${lastDate}</div>` : ''}
      </div>
      <div class="stat-card" style="background:rgba(255,255,255,0.06);padding:10px;border-radius:8px;text-align:center">
        <div style="font-size:11px;color:#94a3b8">Following</div>
        <div style="font-size:20px;font-weight:700">${formatNum(stats.profile?.followingCount ?? 0)}</div>
        ${g && g.following != null ? `<div style="font-size:11px;color:${g.following >= 0 ? '#4ade80' : '#f87171'}">${g.following >= 0 ? '+' : ''}${g.following}%</div>` : ''}
      </div>
      <div class="stat-card" style="background:rgba(255,255,255,0.06);padding:10px;border-radius:8px;text-align:center">
        <div style="font-size:11px;color:#94a3b8">Posts (total)</div>
        <div style="font-size:20px;font-weight:700">${formatNum(stats.profile?.postsCount ?? 0)}</div>
        ${g && g.posts != null ? `<div style="font-size:11px;color:${g.posts >= 0 ? '#4ade80' : '#f87171'}">${g.posts >= 0 ? '+' : ''}${g.posts}%</div>` : ''}
      </div>
      <div class="stat-card" style="background:rgba(255,255,255,0.06);padding:10px;border-radius:8px;text-align:center">
        <div style="font-size:11px;color:#94a3b8">From last ${stats.postCount} posts</div>
        <div style="font-size:12px">Likes / Views / Comments / Reposts</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px">
      <div style="background:rgba(251,191,36,0.15);padding:8px;border-radius:6px;text-align:center">
        <div style="font-size:10px;color:#fbbf24">Likes</div>
        <div style="font-weight:700">${formatNum(stats.totalLikes)}</div>
        ${g && g.totalLikes != null ? `<div style="font-size:10px;color:${g.totalLikes >= 0 ? '#4ade80' : '#f87171'}">${g.totalLikes >= 0 ? '+' : ''}${g.totalLikes}%</div>` : ''}
      </div>
      <div style="background:rgba(96,165,250,0.15);padding:8px;border-radius:6px;text-align:center">
        <div style="font-size:10px;color:#60a5fa">Views</div>
        <div style="font-weight:700">${formatNum(stats.totalViews)}</div>
        ${g && g.totalViews != null ? `<div style="font-size:10px;color:${g.totalViews >= 0 ? '#4ade80' : '#f87171'}">${g.totalViews >= 0 ? '+' : ''}${g.totalViews}%</div>` : ''}
      </div>
      <div style="background:rgba(134,239,172,0.15);padding:8px;border-radius:6px;text-align:center">
        <div style="font-size:10px;color:#86efac">Comments</div>
        <div style="font-weight:700">${formatNum(stats.totalComments)}</div>
      </div>
      <div style="background:rgba(167,139,250,0.15);padding:8px;border-radius:6px;text-align:center">
        <div style="font-size:10px;color:#a78bfa">Reposts</div>
        <div style="font-weight:700">${formatNum(stats.totalReposts)}</div>
      </div>
    </div>
    <div style="margin-bottom:12px;padding:8px;background:rgba(255,255,255,0.05);border-radius:8px">
      <div style="font-size:11px;color:#94a3b8;margin-bottom:4px">Management metrics</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px">
        <span>Engagement rate:</span><strong>${stats.engagementRate}</strong>
        <span>Avg views/post (sample):</span><strong>${formatNum(stats.avgViews)}</strong>
        <span>Sample size:</span><strong>${stats.postCount} posts</strong>
      </div>
    </div>
    <div style="margin-bottom:8px;font-weight:600">Post rank by views (top ${Math.min(10, stats.byViews.length)})</div>
    <div style="max-height:200px;overflow:auto;border:1px solid #334155;border-radius:8px;margin-bottom:12px">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:rgba(0,0,0,0.2)">
          <th style="text-align:left;padding:6px 8px">#</th>
          <th style="text-align:left;padding:6px 8px">Preview</th>
          <th style="text-align:right;padding:6px 8px">Views</th>
          <th style="text-align:right;padding:6px 8px">Likes</th>
        </tr></thead>
        <tbody>
    `;
    stats.byViews.slice(0, 10).forEach((p, i) => {
      html += `<tr style="border-top:1px solid #334155">
        <td style="padding:6px 8px">${i + 1}</td>
        <td style="padding:6px 8px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(p.content)}">${escapeHtml(p.content) || '—'}</td>
        <td style="text-align:right;padding:6px 8px">${formatNum(p.views)}</td>
        <td style="text-align:right;padding:6px 8px">${formatNum(p.likes)}</td>
      </tr>`;
    });
    html += `
        </tbody>
      </table>
    </div>
    <div style="display:flex;gap:8px">
      <button type="button" id="StatisticsITD-save-snapshot" style="flex:1;padding:8px;border-radius:8px;border:1px solid #475569;background:#334155;color:#e2e8f0;cursor:pointer;font-size:12px">Save snapshot (for growth)</button>
      <button type="button" id="StatisticsITD-refresh" style="padding:8px 12px;border-radius:8px;border:1px solid #475569;background:#334155;color:#e2e8f0;cursor:pointer;font-size:12px">Refresh</button>
    </div>
    `;
    body.innerHTML = html;

    // Charts placeholder (optional: add Chart.js)
    const chartContainer = document.createElement('div');
    chartContainer.id = 'StatisticsITD-chart';
    chartContainer.style.cssText = 'margin:12px 0;height:180px;background:rgba(0,0,0,0.2);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:12px';
    chartContainer.textContent = 'Engagement: Likes / Views / Comments / Reposts (install Chart.js for graph)';
    body.insertBefore(chartContainer, body.querySelector('div:last-of-type'));

    // Try to draw simple bar chart with canvas if no Chart.js
    drawSimpleChart(chartContainer, stats);

    body.querySelector('#StatisticsITD-save-snapshot').addEventListener('click', () => {
      saveSnapshot(username, {
        followersCount: stats.profile?.followersCount ?? 0,
        followingCount: stats.profile?.followingCount ?? 0,
        postsCount: stats.profile?.postsCount ?? 0,
        totalLikes: stats.totalLikes,
        totalViews: stats.totalViews,
        totalComments: stats.totalComments,
        totalReposts: stats.totalReposts,
      });
      alert('Snapshot saved. Growth % will show vs this snapshot next time.');
      loadAndShow(username, body);
    });

    body.querySelector('#StatisticsITD-refresh').addEventListener('click', () => {
      body.innerHTML = '<p style="color:#94a3b8">Loading…</p>';
      loadAndShow(username, body);
    });
  }

  function escapeHtml(s) {
    if (s == null) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function drawSimpleChart(container, stats) {
    const canvas = document.createElement('canvas');
    canvas.width = 380;
    canvas.height = 160;
    canvas.style.maxWidth = '100%';
    container.innerHTML = '';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const arr = [
      { label: 'Likes', value: stats.totalLikes, color: '#fbbf24' },
      { label: 'Views', value: stats.totalViews, color: '#60a5fa' },
      { label: 'Comments', value: stats.totalComments, color: '#4ade80' },
      { label: 'Reposts', value: stats.totalReposts, color: '#a78bfa' },
    ];
    const max = Math.max(1, ...arr.map((x) => x.value));
    const w = (canvas.width - 80) / arr.length;
    const h = canvas.height - 40;
    arr.forEach((item, i) => {
      const barH = max ? (item.value / max) * (h - 10) : 0;
      const x = 40 + i * (w + 8);
      const y = canvas.height - 25 - barH;
      ctx.fillStyle = item.color;
      ctx.fillRect(x, y, w - 4, barH);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(item.label, x + (w - 4) / 2, canvas.height - 8);
      ctx.fillText(formatNum(item.value), x + (w - 4) / 2, y - 4);
    });
  }

  async function loadAndShow(username, body) {
    try {
      const [profile, posts] = await Promise.all([getProfile(username), getPosts(username)]);
      const stats = aggregate(profile, posts);
      const last = getLastSnapshot(username);
      const lastAgg = last ? {
        followersCount: last.followersCount,
        followingCount: last.followingCount,
        postsCount: last.postsCount,
        totalLikes: last.totalLikes,
        totalViews: last.totalViews,
      } : null;
      const growthData = lastAgg ? growth({
        followersCount: stats.profile?.followersCount ?? 0,
        followingCount: stats.profile?.followingCount ?? 0,
        postsCount: stats.profile?.postsCount ?? 0,
        totalLikes: stats.totalLikes,
        totalViews: stats.totalViews,
      }, lastAgg) : null;
      render(body, username, stats, growthData);
    } catch (e) {
      body.innerHTML = `<p style="color:#f87171">Error loading stats: ${escapeHtml(e.message)}. Check profile URL and API.</p>
        <button type="button" id="StatisticsITD-retry" style="margin-top:8px;padding:6px 12px;border-radius:6px;border:1px solid #475569;background:#334155;color:#e2e8f0;cursor:pointer">Retry</button>`;
      body.querySelector('#StatisticsITD-retry').onclick = () => loadAndShow(username, body);
    }
  }

  function init() {
    const username = getUsername();
    if (!username) return;

    createToggleButton();
    const body = createPanel();

    try {
      const v = localStorage.getItem(PANEL_VISIBLE_KEY);
      panelVisible = v !== '0';
      if (panelRoot) panelRoot.style.display = panelVisible ? 'block' : 'none';
    } catch (_) {}

    loadAndShow(username, body);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
