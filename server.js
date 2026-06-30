const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;
const GROUP_ID = 3029096;
app.use(cors());

// Only these ranks should be included in the output.
// Names must match the "name" field Roblox returns for each role exactly.
const ALLOWED_RANKS = new Set([
    'Junior Lieutenant',
    'Lieutenant',
    'Senior Lieutenant',
    'Captain',
    'Major',
    'Lieutenant Colonel',
    'Colonel',
    'Major General',
    'Lieutenant General',
    'General',
    'Marshal',
    'Consul Marshal',
    'Chief Marshal',
    'Supreme Marshal'
]);

// Roblox does NOT sort group members by rank -- sortOrder only affects
// join-order/ID order. That means there's no shortcut: every member has
// to be scanned to find the ones in ALLOWED_RANKS. For a group this size
// that's too slow to do live on every request, so instead we scan the
// whole group in the background on a timer and cache the result. Each
// incoming request just returns whatever is currently cached -- instant,
// and never blocks on a multi-thousand-page Roblox crawl.

let cache = {
    data: [],
    lastUpdated: null,
    lastError: null,
    isRefreshing: false
};

async function refreshRoster() {
    if (cache.isRefreshing) return; // don't run two scans at once
    cache.isRefreshing = true;
    console.log('Starting full roster scan...');

    try {
        let allFilteredUsers = [];
        let nextCursor = '';
        let pageCount = 0;
        let totalScanned = 0;

        do {
            const cursorParam = nextCursor ? `&cursor=${encodeURIComponent(nextCursor)}` : '';
            const robloxUrl = `https://groups.roblox.com/v1/groups/${GROUP_ID}/users?sortOrder=Asc&limit=100${cursorParam}`;

            let data;
            try {
                const response = await axios.get(robloxUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
                });
                data = response.data;
            } catch (err) {
                if (err.response?.status === 429) {
                    // Rate limited -- back off and retry this same page
                    console.log('Rate limited, waiting 2s before retry...');
                    await new Promise(r => setTimeout(r, 2000));
                    continue;
                }
                throw err;
            }

            const members = data.data || [];
            totalScanned += members.length;

            for (const member of members) {
                if (ALLOWED_RANKS.has(member.role?.name)) {
                    allFilteredUsers.push(member);
                }
            }

            pageCount++;
            if (pageCount % 20 === 0) {
                console.log(`Scanned ${totalScanned} members so far, ${allFilteredUsers.length} matched...`);
            }

            nextCursor = data.nextPageCursor || '';

            // Small delay to stay well under Roblox's rate limits
            await new Promise(r => setTimeout(r, 300));

            // Hard safety cap: 1000 pages = 100,000 members
        } while (nextCursor && pageCount < 1000);

        cache.data = allFilteredUsers;
        cache.lastUpdated = new Date().toISOString();
        cache.lastError = null;
        console.log(`Roster scan complete: ${totalScanned} scanned, ${allFilteredUsers.length} matched.`);
    } catch (error) {
        console.error(`Roster scan failed: ${error.message}`);
        cache.lastError = error.message;
    } finally {
        cache.isRefreshing = false;
    }
}

// One-time debug helper: hit /roles in your browser to see every role
// in the group along with its exact name and numeric rank.
app.get('/roles', async (req, res) => {
    try {
        const response = await axios.get(
            `https://groups.roblox.com/v1/groups/${GROUP_ID}/roles`,
            { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }
        );
        res.json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json({ error: error.message });
    }
});

// Manually trigger a refresh without waiting for the timer.
// Returns immediately; check / for status and results.
app.get('/refresh', async (req, res) => {
    refreshRoster(); // fire and forget
    res.json({ message: 'Refresh started', alreadyRefreshing: cache.isRefreshing });
});

// Universal catch-all route for incoming Google Sheet requests.
// Always returns instantly from cache.
app.get('*', (req, res) => {
    res.json({
        data: cache.data,
        nextPageCursor: null,
        previousPageCursor: null,
        debug: {
            lastUpdated: cache.lastUpdated,
            isRefreshing: cache.isRefreshing,
            lastError: cache.lastError,
            matchedCount: cache.data.length
        }
    });
});

// Scan once on startup, then every 15 minutes.
refreshRoster();
setInterval(refreshRoster, 15 * 60 * 1000);

app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
