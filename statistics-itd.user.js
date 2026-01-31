// ==UserScript==
// @name         Statistics ITD (StatisticsИТД)
// @namespace    https://github.com/LLAVQ/StatisticsITD
// @version      1.1.0
// @description  Show account stats with interactive charts on итд.com profile pages
// @author       LLAVQ
// @license      GPL-3.0-or-later
// @match        *://xn--d1ah4a.com/*
// @match        *://итд.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=xn--d1ah4a.com
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @run-at       document-idle
// ==/UserScript==

/*
    Statistics ITD
    Copyright (C) 2026 LLAVQ

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

(function () {
    'use strict';

    const BASE = location.origin;
    const STORAGE_KEY = 'StatisticsITD_snapshots';
    const PANEL_VISIBLE_KEY = 'StatisticsITD_panelVisible';
    const PANEL_POS_KEY = 'StatisticsITD_panelPos';

    function getUsername() {
        const path = location.pathname.replace(/^\/+|\/+$/g, '');
        const segments = path.split('/');
        
        // Priority 1: URL structure
        for (let i = 0; i < segments.length; i++) {
            if (['profile', 'user', 'u'].includes(segments[i]) && segments[i + 1]) {
                return segments[i + 1].replace(/^@/, '');
            }
            if (segments[i].startsWith('@')) return segments[i].slice(1);
        }

        // Priority 2: DOM Meta tags
        const meta = document.querySelector('meta[property="profile:username"], meta[name="username"]');
        if (meta && meta.content) return meta.content.trim();

        return null;
    }

    async function api(path) {
        const r = await fetch(BASE + path, { 
            credentials: 'include', 
            headers: { 'Accept': 'application/json' } 
        });
        if (!r.ok) throw new Error(`Server returned ${r.status}`);
        const data = await r.json();
        return data?.data ?? data;
    }

    async function getProfile(username) {
        return api(`/api/users/${encodeURIComponent(username)}`);
    }

    async function getPosts(username, limit = 50) {
        try {
            const data = await api(`/api/posts/user/${encodeURIComponent(username)}?limit=${limit}&sort=new`);
            return data?.posts ?? [];
        } catch (e) {
            return [];
        }
    }

    function getSnapshots() {
        try {
            const raw = GM_getValue(STORAGE_KEY, "{}");
            return JSON.parse(raw);
        } catch { return {}; }
    }

    function saveSnapshot(username, snapshot) {
        const all = getSnapshots();
        if (!all[username]) all[username] = [];
        all[username].unshift({ ...snapshot, date: new Date().toISOString() });
        all[username] = all[username].slice(0, 30);
        GM_setValue(STORAGE_KEY, JSON.stringify(all));
    }

    function getLastSnapshot(username) {
        const all = getSnapshots();
        const list = all[username];
        return list && list.length ? list[0] : null;
    }

    function aggregate(profile, posts) {
        let totalLikes = 0, totalViews = 0, totalComments = 0, totalReposts = 0;
        const byViews = [];
        posts.forEach(p => {
            totalLikes += (p.likesCount || 0);
            totalViews += (p.viewsCount || 0);
            totalComments += (p.commentsCount || 0);
            totalReposts += (p.repostsCount || 0);
            byViews.push({
                content: (p.content || '').slice(0, 40),
                views: p.viewsCount || 0,
                likes: p.likesCount || 0
            });
        });
        byViews.sort((a, b) => b.views - a.views);
        const avgViews = posts.length ? Math.round(totalViews / posts.length) : 0;
        const er = totalViews > 0 ? ((totalLikes + totalComments + totalReposts) / totalViews * 100).toFixed(2) + '%' : '0%';

        return { profile, totalLikes, totalViews, totalComments, totalReposts, postCount: posts.length, avgViews, engagementRate: er, byViews };
    }

    function growth(curr, last) {
        if (!last) return null;
        const calc = (c, l) => l === 0 ? 0 : Math.round(((c - l) / l) * 100);
        return {
            followers: calc(curr.followersCount, last.followersCount),
            totalLikes: calc(curr.totalLikes, last.totalLikes),
            date: last.date
        };
    }

    function createToggleButton(wrap) {
        const btn = document.createElement('button');
        btn.innerHTML = '📊';
        Object.assign(btn.style, {
            position: 'fixed', bottom: '20px', right: '20px', zIndex: '999999',
            width: '45px', height: '45px', borderRadius: '50%', border: 'none',
            background: '#3b82f6', color: 'white', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
        });
        btn.onclick = () => {
            const isVis = wrap.style.display !== 'none';
            wrap.style.display = isVis ? 'none' : 'block';
            GM_setValue(PANEL_VISIBLE_KEY, !isVis);
        };
        document.body.appendChild(btn);
    }

    function createPanel() {
        const wrap = document.createElement('div');
        const savedPos = JSON.parse(GM_getValue(PANEL_POS_KEY, '{"x":20,"y":20}'));
        
        Object.assign(wrap.style, {
            position: 'fixed', left: savedPos.x + 'px', top: savedPos.y + 'px',
            width: '380px', maxHeight: '80vh', overflowY: 'auto', zIndex: '999998',
            background: '#1e293b', color: '#f1f5f9', borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)', border: '1px solid #334155',
            display: GM_getValue(PANEL_VISIBLE_KEY, true) ? 'block' : 'none',
            fontFamily: 'sans-serif'
        });

        const header = document.createElement('div');
        header.innerHTML = '<div style="padding:12px; cursor:move; background:#0f172a; border-radius:12px 12px 0 0; font-weight:bold">📈 Statistics ITD</div>';
        
        // Simple Drag Logic
        header.onmousedown = (e) => {
            let shiftX = e.clientX - wrap.getBoundingClientRect().left;
            let shiftY = e.clientY - wrap.getBoundingClientRect().top;
            function moveAt(pageX, pageY) {
                wrap.style.left = pageX - shiftX + 'px';
                wrap.style.top = pageY - shiftY + 'px';
            }
            function onMouseMove(e) { moveAt(e.pageX, e.pageY); }
            document.addEventListener('mousemove', onMouseMove);
            document.onmouseup = () => {
                document.removeEventListener('mousemove', onMouseMove);
                GM_setValue(PANEL_POS_KEY, JSON.stringify({x: parseInt(wrap.style.left), y: parseInt(wrap.style.top)}));
                document.onmouseup = null;
            };
        };

        const body = document.createElement('div');
        body.style.padding = '15px';
        body.innerHTML = 'Detecting profile...';

        wrap.appendChild(header);
        wrap.appendChild(body);
        document.body.appendChild(wrap);
        
        createToggleButton(wrap);
        return body;
    }

    function drawChart(canvas, stats) {
        const ctx = canvas.getContext('2d');
        const data = [stats.totalLikes, stats.totalViews, stats.totalComments];
        const labels = ['Likes', 'Views', 'Comm'];
        const colors = ['#fbbf24', '#60a5fa', '#4ade80'];
        
        const max = Math.max(...data, 1);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        data.forEach((v, i) => {
            const barH = (v / max) * 80;
            ctx.fillStyle = colors[i];
            ctx.fillRect(40 + i * 100, 100 - barH, 40, barH);
            ctx.fillStyle = '#94a3b8';
            ctx.fillText(labels[i], 40 + i * 100, 115);
        });
    }

    async function load(username, container) {
        container.innerHTML = 'Loading data...';
        try {
            const [profile, posts] = await Promise.all([getProfile(username), getPosts(username)]);
            const stats = aggregate(profile, posts);
            const last = getLastSnapshot(username);
            const g = growth(stats.profile, last);

            container.innerHTML = `
                <div style="margin-bottom:15px">
                    <div style="font-size:18px; color:#3b82f6">@${username}</div>
                    <div style="font-size:12px; opacity:0.7">Followers: ${stats.profile.followersCount}</div>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:15px">
                    <div style="background:#334155; padding:10px; border-radius:8px">
                        <small>Total Likes</small><br><b>${stats.totalLikes}</b>
                        ${g ? `<br><small style="color:${g.totalLikes>=0?'#4ade80':'#f87171'}">${g.totalLikes}%</small>` : ''}
                    </div>
                    <div style="background:#334155; padding:10px; border-radius:8px">
                        <small>Eng. Rate</small><br><b>${stats.engagementRate}</b>
                    </div>
                </div>
                <canvas id="itdChart" width="340" height="120"></canvas>
                <button id="itdSave" style="width:100%; margin-top:10px; padding:8px; background:#3b82f6; border:none; color:white; border-radius:5px; cursor:pointer">Save Growth Snapshot</button>
            `;

            drawChart(document.getElementById('itdChart'), stats);
            document.getElementById('itdSave').onclick = () => {
                saveSnapshot(username, {
                    followersCount: stats.profile.followersCount,
                    totalLikes: stats.totalLikes
                });
                alert('Snapshot saved!');
            };

        } catch (e) {
            container.innerHTML = `<span style="color:#f87171">Error: Profile not found or API private.</span>`;
        }
    }

    // --- Initialization ---
    let lastUrl = location.href;
    const body = createPanel();

    function check() {
        const user = getUsername();
        if (user) {
            load(user, body);
        } else {
            body.innerHTML = 'Navigate to a profile to see stats.';
        }
    }

    // Handle SPA navigation
    setInterval(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            check();
        }
    }, 2000);

    check();

})();
