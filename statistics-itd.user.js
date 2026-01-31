// ==UserScript==
// @name         Statistics ITD (StatisticsИТД)
// @namespace    https://github.com/LLAVQ/StatisticsITD
// @version      1.1.4
// @description  Auth-fix: Extracts Bearer token for API access
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

    // --- Token Hunter: Find the Bearer Token ---
    function getAuthToken() {
        try {
            // 1. Check common localStorage keys for this framework
            const storageKeys = ['auth-storage', 'auth_token', 'token', 'user-store'];
            for (let key of storageKeys) {
                const val = localStorage.getItem(key);
                if (!val) continue;
                if (val.startsWith('ey')) return val; // Raw JWT
                try {
                    const parsed = JSON.parse(val);
                    const token = parsed?.state?.token || parsed?.token || parsed?.accessToken;
                    if (token) return token;
                } catch(e) {}
            }
            
            // 2. Try to find it in SessionStorage
            const sessionVal = sessionStorage.getItem('token');
            if (sessionVal) return sessionVal;

        } catch (e) { console.error("Token Hunter Error", e); }
        return null;
    }

    async function api(path) {
        const token = getAuthToken();
        const headers = { 
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };

        // Inject Bearer token if we found one
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const r = await fetch(BASE + path, { 
            credentials: 'include', 
            headers: headers 
        });

        if (r.status === 401) throw new Error("Unauthorized: Token missing or expired.");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        
        const data = await r.json();
        return data?.data ?? data;
    }

    function getUsername() {
        const path = location.pathname.replace(/^\/+|\/+$/g, '');
        const segments = path.split('/');
        // Search for handle in DOM (e.g., @nowkie)
        const handle = document.querySelector('div[class*="handle"], .text-gray-500');
        if (handle && handle.innerText.includes('@')) return handle.innerText.split('@')[1].trim();
        if (segments.length === 1 && segments[0]) return segments[0];
        return null;
    }

    function createUI() {
        const wrap = document.createElement('div');
        Object.assign(wrap.style, {
            position: 'fixed', left: '20px', top: '20px', width: '300px', zIndex: '999999', 
            background: '#111827', color: '#f3f4f6', borderRadius: '12px', 
            border: '1px solid #374151', padding: '15px', boxShadow: '0 10px 15px rgba(0,0,0,0.5)'
        });
        document.body.appendChild(wrap);
        return wrap;
    }

    async function load(username, container) {
        container.innerHTML = `<div style="color:#9ca3af">Syncing with @${username}...</div>`;
        try {
            const [profile, postsData] = await Promise.all([
                api(`/api/users/${username}`),
                api(`/api/posts/user/${username}?limit=50&sort=new`)
            ]);
            
            const posts = postsData?.posts || postsData || [];
            let likes = 0, views = 0;
            posts.forEach(p => { likes += (p.likesCount || 0); views += (p.viewsCount || 0); });
            const er = views > 0 ? ((likes / views) * 100).toFixed(2) : '0';

            container.innerHTML = `
                <div style="font-weight:bold; color:#60a5fa; margin-bottom:10px">📈 Statistics: @${username}</div>
                <div style="font-size:13px; margin-bottom:8px">Followers: <b>${profile.followersCount?.toLocaleString() || '0'}</b></div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px">
                    <div style="background:#1f2937; padding:8px; border-radius:6px">
                        <div style="font-size:10px; color:#9ca3af">ENGAGEMENT</div>
                        <div style="color:#10b981; font-weight:bold">${er}%</div>
                    </div>
                    <div style="background:#1f2937; padding:8px; border-radius:6px">
                        <div style="font-size:10px; color:#9ca3af">TOTAL LIKES</div>
                        <div style="font-weight:bold">${likes.toLocaleString()}</div>
                    </div>
                </div>
            `;
        } catch (e) {
            const hasToken = !!getAuthToken();
            container.innerHTML = `
                <div style="color:#ef4444; font-size:12px">
                    <b>Auth Failure (401)</b><br>
                    ${!hasToken ? "Token not found in storage. Try refreshing or re-logging." : "Token found but rejected by server."}
                </div>`;
        }
    }

    const panel = createUI();
    let lastUser = null;

    setInterval(() => {
        const user = getUsername();
        if (user && user !== lastUser) {
            lastUser = user;
            load(user, panel);
        }
    }, 2000);
})();
