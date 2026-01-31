// ==UserScript==
// @name         Statistics ITD (StatisticsИТД)
// @namespace    https://github.com/LLAVQ/StatisticsITD
// @version      2.0.0
// @description  Comprehensive analytics dashboard for итд.com with Growth Tracking & Charts.
// @author       LLAVQ
// @license      GPL-3.0-or-later
// @match        *://xn--d1ah4a.com/*
// @match        *://итд.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    let capturedToken = null;
    const BASE = location.origin;
    const STORAGE_KEY = 'ITD_SNAPSHOTS';

    // --- 1. TOKEN INTERCEPTOR (Core Logic) ---
    function updateToken(token) {
        if (token && token.startsWith('Bearer ') && token !== capturedToken) {
            capturedToken = token;
            const user = getActiveUser();
            if (user) refreshData(user);
        }
    }

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        const options = args[1];
        const auth = options?.headers?.Authorization || options?.headers?.authorization;
        if (auth) updateToken(auth);
        return originalFetch(...args);
    };

    function scanStorage() {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const val = localStorage.getItem(key);
            if (val && val.includes('"token":"ey')) {
                try {
                    const parsed = JSON.parse(val);
                    const token = parsed?.state?.token || parsed?.token;
                    if (token) updateToken(`Bearer ${token}`);
                } catch(e) {}
            }
        }
    }

    // --- 2. DATA PROCESSING ---
    function getActiveUser() {
        const path = location.pathname.split('/');
        return path[1] && !['', 'home', 'explore', 'notifications', 'settings', 'messages', 'search'].includes(path[1]) 
               ? path[1].replace('@', '') : null;
    }

    async function fetchData(username) {
        if (!capturedToken) scanStorage();
        if (!capturedToken) throw new Error("AUTH_REQUIRED");

        const headers = { 'Authorization': capturedToken, 'Accept': 'application/json' };
        const [uRes, pRes] = await Promise.all([
            originalFetch(`${BASE}/api/users/${username}`, { headers }),
            originalFetch(`${BASE}/api/posts/user/${username}?limit=50&sort=new`, { headers })
        ]);

        if (!uRes.ok || !pRes.ok) throw new Error("API_ERROR");

        const userData = (await uRes.json()).data;
        const posts = (await pRes.json()).data?.posts || [];

        let stats = {
            username: username,
            followers: userData.followersCount || 0,
            totalLikes: 0,
            totalViews: 0,
            totalComments: 0,
            postData: []
        };

        posts.forEach(p => {
            stats.totalLikes += (p.likesCount || 0);
            stats.totalViews += (p.viewsCount || 0);
            stats.totalComments += (p.commentsCount || 0);
            stats.postData.push({
                views: p.viewsCount || 0,
                likes: p.likesCount || 0,
                comments: p.commentsCount || 0,
                body: p.body?.substring(0, 30) || "Post"
            });
        });

        stats.er = stats.totalViews > 0 ? ((stats.totalLikes + stats.totalComments) / stats.totalViews * 100).toFixed(2) : "0";
        stats.avgViews = posts.length > 0 ? Math.round(stats.totalViews / posts.length) : 0;
        stats.topPosts = [...stats.postData].sort((a,b) => b.views - a.views).slice(0, 5);

        return stats;
    }

    // --- 3. UI & VISUALIZATION ---
    function drawChart(canvas, data, color) {
        const ctx = canvas.getContext('2d');
        const max = Math.max(...data, 1);
        const pad = 5;
        const w = (canvas.width - (data.length * pad)) / data.length;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        data.forEach((val, i) => {
            const h = (val / max) * canvas.height;
            ctx.fillStyle = color;
            ctx.fillRect(i * (w + pad), canvas.height - h, w, h);
        });
    }

    function createUI() {
        if (document.getElementById('itd-stats-panel')) return;

        // Toggle Button
        const toggle = document.createElement('button');
        toggle.innerHTML = '📊';
        Object.assign(toggle.style, {
            position: 'fixed', bottom: '20px', right: '20px', zIndex: '2147483647',
            width: '45px', height: '45px', borderRadius: '50%', border: 'none',
            background: '#3b82f6', color: 'white', cursor: 'pointer', fontSize: '20px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
        });
        toggle.onclick = () => {
            const p = document.getElementById('itd-stats-panel');
            p.style.display = p.style.display === 'none' ? 'block' : 'none';
        };
        document.body.appendChild(toggle);

        // Draggable Panel
        const panel = document.createElement('div');
        panel.id = 'itd-stats-panel';
        Object.assign(panel.style, {
            position: 'fixed', right: '20px', top: '70px', width: '300px', 
            zIndex: '2147483646', background: '#0f172a', color: '#f8fafc', 
            borderRadius: '12px', border: '1px solid #334155', display: 'none',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)', fontFamily: 'sans-serif',
            overflow: 'hidden', maxHeight: '85vh'
        });

        panel.innerHTML = `
            <div id="itd-header" style="padding:12px; background:#1e293b; cursor:move; font-weight:bold; display:flex; justify-content:space-between; align-items:center;">
                <span>📈 Statistics ITD</span>
                <span style="font-size:10px; color:#94a3b8;">GPLv3</span>
            </div>
            <div id="itd-body" style="padding:15px; overflow-y:auto; max-height:calc(85vh - 50px);">
                <div style="text-align:center; color:#94a3b8;">Navigate to a profile...</div>
            </div>
        `;

        document.body.appendChild(panel);

        // Make Draggable
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        panel.querySelector('#itd-header').onmousedown = (e) => {
            e.preventDefault();
            pos3 = e.clientX; pos4 = e.clientY;
            document.onmouseup = () => { document.onmouseup = null; document.onmousemove = null; };
            document.onmousemove = (e) => {
                pos1 = pos3 - e.clientX; pos2 = pos4 - e.clientY;
                pos3 = e.clientX; pos4 = e.clientY;
                panel.style.top = (panel.offsetTop - pos2) + "px";
                panel.style.left = (panel.offsetLeft - pos1) + "px";
            };
        };
    }

    async function refreshData(username) {
        const body = document.getElementById('itd-body');
        if (!body) return;

        body.innerHTML = `<div style="text-align:center; color:#3b82f6;">📡 Aggregating Deep-Dive Data...</div>`;

        try {
            const stats = await fetchData(username);
            
            // Growth Logic
            const snapshots = JSON.parse(GM_getValue(STORAGE_KEY, '{}'));
            const prev = snapshots[username];
            const fDiff = prev ? stats.followers - prev.followers : 0;
            const erDiff = prev ? (parseFloat(stats.er) - parseFloat(prev.er)).toFixed(2) : 0;

            body.innerHTML = `
                <div style="margin-bottom:15px;">
                    <b style="font-size:18px; color:#3b82f6;">@${stats.username}</b>
                    <div style="font-size:11px; color:#64748b;">Last 50 Posts Analyzed</div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:15px;">
                    <div style="background:#1e293b; padding:10px; border-radius:8px;">
                        <div style="font-size:10px; color:#94a3b8;">FOLLOWERS</div>
                        <div style="font-weight:bold;">${stats.followers.toLocaleString()}</div>
                        ${fDiff !== 0 ? `<div style="font-size:10px; color:${fDiff > 0 ? '#10b981' : '#ef4444'}">${fDiff > 0 ? '↑' : '↓'} ${Math.abs(fDiff)}</div>` : ''}
                    </div>
                    <div style="background:#1e293b; padding:10px; border-radius:8px;">
                        <div style="font-size:10px; color:#94a3b8;">ENGAGEMENT</div>
                        <div style="font-weight:bold; color:#10b981;">${stats.er}%</div>
                        ${erDiff != 0 ? `<div style="font-size:10px; color:${erDiff > 0 ? '#10b981' : '#ef4444'}">${erDiff > 0 ? '↑' : '↓'} ${Math.abs(erDiff)}%</div>` : ''}
                    </div>
                </div>

                <div style="background:#1e293b; padding:10px; border-radius:8px; margin-bottom:15px;">
                    <div style="font-size:10px; color:#94a3b8; margin-bottom:5px;">VIEWS DISTRIBUTION</div>
                    <canvas id="itd-chart-views" width="240" height="40"></canvas>
                </div>

                <div style="font-size:12px; margin-bottom:15px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                        <span>Avg Views/Post:</span> <b>${stats.avgViews.toLocaleString()}</b>
                    </div>
                    <div style="display:flex; justify-content:space-between;">
                        <span>Total Interactions:</span> <b>${(stats.totalLikes + stats.totalComments).toLocaleString()}</b>
                    </div>
                </div>

                <div style="margin-bottom:15px;">
                    <div style="font-size:10px; color:#94a3b8; margin-bottom:5px;">TOP PERFORMING CONTENT</div>
                    <table style="width:100%; font-size:10px; border-collapse:collapse;">
                        ${stats.topPosts.map(p => `
                            <tr style="border-bottom:1px solid #334155;">
                                <td style="padding:4px 0; color:#94a3b8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:140px;">${p.body}</td>
                                <td style="text-align:right; font-weight:bold;">${p.views.toLocaleString()} v</td>
                            </tr>
                        `).join('')}
                    </table>
                </div>

                <button id="itd-save" style="width:100%; padding:10px; background:#3b82f6; border:none; color:white; border-radius:6px; cursor:pointer; font-weight:bold; font-size:12px;">📸 Save Snapshot</button>
            `;

            drawChart(document.getElementById('itd-chart-views'), stats.postData.map(d => d.views), '#3b82f6');

            document.getElementById('itd-save').onclick = () => {
                snapshots[username] = { followers: stats.followers, er: stats.er, date: Date.now() };
                GM_setValue(STORAGE_KEY, JSON.stringify(snapshots));
                alert(`Snapshot saved for @${username}! Comparisons will appear on your next visit.`);
            };

        } catch (e) {
            body.innerHTML = e.message === "AUTH_REQUIRED" 
                ? `<div style="color:#fbbf24; font-size:11px; text-align:center;">🔑 <b>Syncing Required</b><br>Click your profile or a post heart to catch token.</div>`
                : `<div style="color:#ef4444; font-size:11px; text-align:center;">❌ API Error. Try Refreshing.</div>`;
        }
    }

    // --- 4. NAVIGATION WATCHER ---
    let lastUser = null;
    setInterval(() => {
        createUI();
        const user = getActiveUser();
        if (user && user !== lastUser) {
            lastUser = user;
            refreshData(user);
        } else if (!user) {
            lastUser = null;
            const body = document.getElementById('itd-body');
            if (body) body.innerHTML = `<div style="text-align:center; color:#64748b;">Visit a profile to see stats.</div>`;
        }
    }, 2000);

})();
