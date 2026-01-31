// ==UserScript==
// @name         Statistics ITD (StatisticsИТД)
// @namespace    https://github.com/LLAVQ/StatisticsITD
// @version      1.1.1
// @description  Show account stats with interactive charts on итд.com profile pages
// @author       LLAVQ
// @license      GPL-3.0-or-later
// @match        *://xn--d1ah4a.com/*
// @match        *://итд.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=xn--d1ah4a.com
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @run-at       document-end
// ==/UserScript==

/*
    Statistics ITD
    Copyright (C) 2026 LLAVQ

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
*/

(function () {
    'use strict';

    const BASE = location.origin;
    const STORAGE_KEY = 'StatisticsITD_snapshots';
    const PANEL_VISIBLE_KEY = 'StatisticsITD_panelVisible';
    const PANEL_POS_KEY = 'StatisticsITD_panelPos';

    // --- Core Logic: Find the User ---
    function getUsername() {
        const path = location.pathname.replace(/^\/+|\/+$/g, '');
        const segments = path.split('/');
        
        // 1. Check URL for @username or /profile/username
        const userMatch = segments.find(s => s.startsWith('@'));
        if (userMatch) return userMatch.slice(1);

        const profileIdx = segments.findIndex(s => s === 'profile' || s === 'user' || s === 'u');
        if (profileIdx !== -1 && segments[profileIdx + 1]) return segments[profileIdx + 1];

        // 2. Fallback: Search the DOM for a username handle
        const headerHandle = document.querySelector('h1, h2, .username, [data-username]');
        if (headerHandle && headerHandle.innerText.includes('@')) {
            return headerHandle.innerText.split('@')[1].trim().split(' ')[0];
        }

        return null;
    }

    // --- API Interactions ---
    async function api(path) {
        const r = await fetch(BASE + path, { 
            credentials: 'include', 
            headers: { 'Accept': 'application/json' } 
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
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

    // --- Storage & Snapshots ---
    function getSnapshots() {
        try { return JSON.parse(GM_getValue(STORAGE_KEY, "{}")); } catch { return {}; }
    }

    function saveSnapshot(username, stats) {
        const all = getSnapshots();
        if (!all[username]) all[username] = [];
        all[username].unshift({ 
            followersCount: stats.profile?.followersCount || 0,
            totalLikes: stats.totalLikes,
            date: new Date().toISOString() 
        });
        GM_setValue(STORAGE_KEY, JSON.stringify(all));
        alert('Snapshot saved! Growth percentages will appear on your next visit.');
    }

    // --- UI Rendering ---
    function aggregate(profile, posts) {
        let l = 0, v = 0, c = 0, r = 0;
        posts.forEach(p => {
            l += (p.likesCount || 0);
            v += (p.viewsCount || 0);
            c += (p.commentsCount || 0);
            r += (p.repostsCount || 0);
        });
        const er = v > 0 ? ((l + c + r) / v * 100).toFixed(2) + '%' : '0%';
        return { profile, totalLikes: l, totalViews: v, totalComments: c, totalReposts: r, postCount: posts.length, engagementRate: er };
    }

    function createUI() {
        const wrap = document.createElement('div');
        const pos = JSON.parse(GM_getValue(PANEL_POS_KEY, '{"x":20,"y":80}'));
        
        Object.assign(wrap.style, {
            position: 'fixed', left: pos.x + 'px', top: pos.y + 'px',
            width: '350px', zIndex: '999999', background: '#111827', color: '#f3f4f6',
            borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
            border: '1px solid #374151', fontFamily: 'system-ui, sans-serif',
            display: GM_getValue(PANEL_VISIBLE_KEY, true) ? 'block' : 'none'
        });

        const header = document.createElement('div');
        header.innerHTML = `<div style="padding:12px; cursor:move; background:#1f2937; border-radius:12px 12px 0 0; font-weight:bold; display:flex; justify-content:space-between">
            <span>📈 Statistics ITD</span>
            <span id="itdClose" style="cursor:pointer; opacity:0.5">×</span>
        </div>`;

        // Drag Handler
        header.onmousedown = (e) => {
            let sx = e.clientX - wrap.getBoundingClientRect().left;
            let sy = e.clientY - wrap.getBoundingClientRect().top;
            const move = (me) => {
                wrap.style.left = me.pageX - sx + 'px';
                wrap.style.top = me.pageY - sy + 'px';
            };
            document.addEventListener('mousemove', move);
            document.onmouseup = () => {
                document.removeEventListener('mousemove', move);
                GM_setValue(PANEL_POS_KEY, JSON.stringify({x: parseInt(wrap.style.left), y: parseInt(wrap.style.top)}));
                document.onmouseup = null;
            };
        };

        const body = document.createElement('div');
        body.style.padding = '15px';
        wrap.appendChild(header);
        wrap.appendChild(body);
        document.body.appendChild(wrap);

        // Toggle Button
        const toggle = document.createElement('button');
        toggle.innerHTML = '📊';
        Object.assign(toggle.style, {
            position: 'fixed', bottom: '20px', right: '20px', zIndex: '1000000',
            width: '48px', height: '48px', borderRadius: '50%', border: 'none',
            background: '#2563eb', color: 'white', cursor: 'pointer', fontSize: '20px'
        });
        toggle.onclick = () => {
            const isVisible = wrap.style.display !== 'none';
            wrap.style.display = isVisible ? 'none' : 'block';
            GM_setValue(PANEL_VISIBLE_KEY, !isVisible);
        };
        document.body.appendChild(toggle);

        return body;
    }

    async function load(username, container) {
        container.innerHTML = '<div style="color:#9ca3af">Fetching data for @'+username+'...</div>';
        try {
            const [profile, posts] = await Promise.all([getProfile(username), getPosts(username)]);
            const stats = aggregate(profile, posts);
            const snapshots = getSnapshots()[username] || [];
            const last = snapshots[0];

            let growthHtml = '';
            if (last) {
                const diff = stats.profile.followersCount - last.followersCount;
                const color = diff >= 0 ? '#10b981' : '#ef4444';
                growthHtml = `<span style="color:${color}; font-size:11px; margin-left:8px">${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff)}</span>`;
            }

            container.innerHTML = `
                <div style="margin-bottom:15px">
                    <div style="font-size:18px; font-weight:bold; color:#60a5fa">@${username}</div>
                    <div style="font-size:13px; color:#9ca3af">Followers: ${profile.followersCount.toLocaleString()}${growthHtml}</div>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:15px">
                    <div style="background:#1f2937; padding:10px; border-radius:8px; border:1px solid #374151">
                        <div style="font-size:11px; color:#9ca3af; text-transform:uppercase">Avg Views</div>
                        <div style="font-size:16px; font-weight:bold">${Math.round(stats.totalViews / (stats.postCount || 1)).toLocaleString()}</div>
                    </div>
                    <div style="background:#1f2937; padding:10px; border-radius:8px; border:1px solid #374151">
                        <div style="font-size:11px; color:#9ca3af; text-transform:uppercase">Eng. Rate</div>
                        <div style="font-size:16px; font-weight:bold; color:#10b981">${stats.engagementRate}</div>
                    </div>
                </div>
                <div style="font-size:12px; color:#9ca3af; margin-bottom:5px">Sample: Last ${stats.postCount} posts</div>
                <div style="background:#1f2937; padding:10px; border-radius:8px; font-size:13px">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px"><span>Likes:</span> <b>${stats.totalLikes.toLocaleString()}</b></div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px"><span>Views:</span> <b>${stats.totalViews.toLocaleString()}</b></div>
                    <div style="display:flex; justify-content:space-between"><span>Comments:</span> <b>${stats.totalComments.toLocaleString()}</b></div>
                </div>
                <button id="itdSnapBtn" style="width:100%; margin-top:15px; padding:10px; background:#2563eb; border:none; color:white; border-radius:6px; cursor:pointer; font-weight:600">Save Snapshot</button>
            `;

            document.getElementById('itdSnapBtn').onclick = () => saveSnapshot(username, stats);

        } catch (e) {
            console.error(e);
            container.innerHTML = `<div style="color:#ef4444; font-size:13px">Error loading stats. User may be private or API is down.</div>`;
        }
    }

    // --- Init & Watcher ---
    const body = createUI();
    let currentLoadedUser = null;

    function check() {
        const user = getUsername();
        if (user && user !== currentLoadedUser) {
            currentLoadedUser = user;
            load(user, body);
        } else if (!user) {
            currentLoadedUser = null;
            body.innerHTML = '<div style="color:#9ca3af; text-align:center; padding:20px">Visit a profile to see statistics.</div>';
        }
    }

    // Check every 2 seconds for navigation changes (SPA)
    setInterval(check, 2000);
    check();

})();
