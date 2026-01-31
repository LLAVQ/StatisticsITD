// ==UserScript==
// @name         Statistics ITD (StatisticsИТД)
// @namespace    https://github.com/LLAVQ/StatisticsITD
// @version      1.1.3
// @description  Show account stats with Bearer Token authentication fix
// @author       LLAVQ
// @license      GPL-3.0-or-later
// @match        *://xn--d1ah4a.com/*
// @match        *://итд.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=xn--d1ah4a.com
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    const BASE = location.origin;
    const STORAGE_KEY = 'StatisticsITD_snapshots';

    function getUsername() {
        const path = location.pathname.replace(/^\/+|\/+$/g, '');
        const segments = path.split('/');
        const handleEl = document.querySelector('div[class*="handle"], span[class*="handle"], .text-gray-500');
        if (handleEl && handleEl.innerText.startsWith('@')) return handleEl.innerText.replace('@', '').trim();
        if (segments.length === 1 && segments[0] !== '' && !['home', 'explore', 'notifications', 'settings'].includes(segments[0])) return segments[0];
        return null;
    }

    // --- NEW: Token Extraction Logic ---
    function getAuthToken() {
        try {
            // Sites like this often store tokens in localStorage under 'auth_token' or 'token'
            return localStorage.getItem('token') || 
                   localStorage.getItem('auth_token') || 
                   JSON.parse(localStorage.getItem('auth-storage'))?.state?.token;
        } catch (e) { return null; }
    }

    async function api(path) {
        const token = getAuthToken();
        const headers = { 'Accept': 'application/json' };
        
        // Add the Bearer token if found to prevent 401 errors
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const r = await fetch(BASE + path, { 
            credentials: 'include', 
            headers: headers 
        });

        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        return data?.data ?? data;
    }

    async function getProfile(username) { return api(`/api/users/${encodeURIComponent(username)}`); }
    async function getPosts(username) {
        try {
            const data = await api(`/api/posts/user/${encodeURIComponent(username)}?limit=50&sort=new`);
            return data?.posts ?? [];
        } catch (e) { return []; }
    }

    // --- UI Logic (Simplified for brevity) ---
    function aggregate(profile, posts) {
        let l = 0, v = 0, c = 0, r = 0;
        posts.forEach(p => {
            l += (p.likesCount || 0); v += (p.viewsCount || 0);
            c += (p.commentsCount || 0); r += (p.repostsCount || 0);
        });
        const er = v > 0 ? ((l + c + r) / v * 100).toFixed(2) + '%' : '0%';
        return { profile, totalLikes: l, totalViews: v, totalComments: c, totalReposts: r, postCount: posts.length, engagementRate: er };
    }

    function createUI() {
        const wrap = document.createElement('div');
        Object.assign(wrap.style, {
            position: 'fixed', left: '20px', top: '80px', width: '320px', zIndex: '999999', 
            background: '#111827', color: '#f3f4f6', borderRadius: '12px', border: '1px solid #374151', padding: '12px'
        });
        document.body.appendChild(wrap);
        return wrap;
    }

    async function load(username, container) {
        container.innerHTML = 'Loading...';
        try {
            const [profile, posts] = await Promise.all([getProfile(username), getPosts(username)]);
            const stats = aggregate(profile, posts);
            container.innerHTML = `
                <b style="color:#60a5fa">@${username}</b><br>
                <small>Followers: ${profile.followersCount.toLocaleString()}</small><hr style="border:0; border-top:1px solid #374151; margin:8px 0">
                <div style="display:flex; justify-content:space-between"><span>Eng. Rate:</span> <b style="color:#10b981">${stats.engagementRate}</b></div>
                <div style="display:flex; justify-content:space-between"><span>Avg Views:</span> <b>${Math.round(stats.totalViews/(stats.postCount||1)).toLocaleString()}</b></div>
            `;
        } catch (e) {
            container.innerHTML = `<span style="color:#ef4444">Auth Error: Please refresh the page while logged in.</span>`;
        }
    }

    const body = createUI();
    let currentUser = null;
    setInterval(() => {
        const user = getUsername();
        if (user && user !== currentUser) {
            currentUser = user;
            load(user, body);
        }
    }, 2000);
})();
