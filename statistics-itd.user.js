// ==UserScript==
// @name         Statistics ITD (StatisticsИТД)
// @namespace    https://github.com/LLAVQ/StatisticsITD
// @version      1.1.5
// @description  Automatic Bearer Token recovery for итд.com API
// @author       LLAVQ
// @license      GPL-3.0-or-later
// @match        *://xn--d1ah4a.com/*
// @match        *://итд.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    const BASE = location.origin;

    // --- Token Recovery Logic ---
    function getBearerToken() {
        try {
            // Check most common locations for итд.com frameworks
            const authData = localStorage.getItem('auth-storage') || localStorage.getItem('user-auth');
            if (authData) {
                const parsed = JSON.parse(authData);
                // Try different common paths to the token string
                return parsed?.state?.token || parsed?.token || parsed?.accessToken;
            }
            // Fallback to raw token keys
            return localStorage.getItem('token') || localStorage.getItem('auth_token');
        } catch (e) {
            console.error("StatisticsITD: Failed to parse auth storage", e);
            return null;
        }
    }

    async function api(path) {
        const token = getBearerToken();
        const headers = { 
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const r = await fetch(BASE + path, { 
            credentials: 'include', 
            headers: headers 
        });

        if (r.status === 401) throw new Error("401 Unauthorized: Refresh required.");
        if (!r.ok) throw new Error(`HTTP Error ${r.status}`);
        
        const data = await r.json();
        return data?.data ?? data;
    }

    // --- Profile Detection ---
    function getUsername() {
        const path = location.pathname.replace(/^\/+|\/+$/g, '');
        const segments = path.split('/');
        const handle = document.querySelector('div[class*="handle"], .text-gray-500');
        if (handle && handle.innerText.includes('@')) return handle.innerText.split('@')[1].trim();
        if (segments.length === 1 && segments[0] && !['home', 'explore'].includes(segments[0])) return segments[0];
        return null;
    }

    // --- UI Implementation ---
    function createUI() {
        const wrap = document.createElement('div');
        Object.assign(wrap.style, {
            position: 'fixed', right: '20px', top: '20px', width: '280px', zIndex: '999999', 
            background: '#111827', color: '#f3f4f6', borderRadius: '12px', 
            border: '1px solid #374151', padding: '15px', boxShadow: '0 10px 15px rgba(0,0,0,0.5)',
            fontFamily: 'sans-serif'
        });
        document.body.appendChild(wrap);
        return wrap;
    }

    async function loadStats(username, container) {
        container.innerHTML = `<div style="color:#9ca3af; font-size: 12px">Fetching @${username}...</div>`;
        try {
            const [user, postsRes] = await Promise.all([
                api(`/api/users/${username}`),
                api(`/api/posts/user/${username}?limit=50&sort=new`)
            ]);

            const posts = postsRes?.posts || postsRes || [];
            let totalLikes = 0, totalViews = 0;
            posts.forEach(p => { 
                totalLikes += (p.likesCount || 0); 
                totalViews += (p.viewsCount || 0); 
            });

            container.innerHTML = `
                <div style="font-weight:bold; color:#60a5fa; margin-bottom:8px">@${username}</div>
                <div style="font-size:12px; margin-bottom:10px">Followers: <b>${user.followersCount?.toLocaleString() || 0}</b></div>
                <div style="background:#1f2937; padding:10px; border-radius:8px; border:1px solid #374151">
                    <div style="font-size:10px; color:#9ca3af; margin-bottom:4px">TOTAL LIKES (LAST 50)</div>
                    <div style="font-size:16px; font-weight:bold">${totalLikes.toLocaleString()}</div>
                </div>
            `;
        } catch (e) {
            container.innerHTML = `<div style="color:#ef4444; font-size:11px"><b>Sync Error:</b> ${e.message}</div>`;
        }
    }

    const panel = createUI();
    let lastUser = null;

    setInterval(() => {
        const user = getUsername();
        if (user && user !== lastUser) {
            lastUser = user;
            loadStats(user, panel);
        }
    }, 2000);
})();
