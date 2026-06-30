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

// One-time debug helper: hit /roles in your browser to see every role
// in the group along with its exact name and numeric rank (0-255).
// Use this to confirm ALLOWED_RANKS below matches Roblox's exact spelling,
// and to find the lowest rank number you want to include.
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

// Lowest numeric rank to include. Junior Lieutenant is the lowest rank
// in your allowed list, so set this to its "rank" number from /roles.
// Defaults to 0 (include everything) until you fill this in -- update
// it once you've checked /roles, then matching becomes a pure safety net.
const MIN_RANK = 0;

// Universal catch-all route for incoming Google Sheet requests
app.get('*', async (req, res) => {
    try {
        let allFilteredUsers = [];
        let nextCursor = '';
        let pageCount = 0;
        let totalScanned = 0;
        let stoppedEarly = false;
        const seenRankNames = new Set(); // debug: every role name encountered

        // Scan HIGHEST ranks first (Desc), since the people we want are
        // a small slice at the top of the rank ladder, not the bottom.
        // Stop as soon as we see a rank below MIN_RANK -- everything
        // after that point only gets lower, so there's no need to
        // keep scanning through thousands of regular members.
        do {
            const cursorParam = nextCursor ? `&cursor=${encodeURIComponent(nextCursor)}` : '';
            const robloxUrl = `https://groups.roblox.com/v1/groups/${GROUP_ID}/users?sortOrder=Desc&limit=100${cursorParam}`;

            console.log(`Forwarding request to Roblox: ${robloxUrl}`);

            const response = await axios.get(robloxUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });

            const data = response.data;
            const members = data.data || [];
            totalScanned += members.length;

            for (const member of members) {
                seenRankNames.add(member.role?.name);

                if ((member.role?.rank ?? 0) < MIN_RANK) {
                    stoppedEarly = true;
                    break; // members only get lower-ranked from here on
                }

                if (ALLOWED_RANKS.has(member.role?.name)) {
                    allFilteredUsers.push(member);
                }
            }

            pageCount++;
            console.log(`Page ${pageCount}: scanned ${members.length}, matched so far ${allFilteredUsers.length}`);

            nextCursor = data.nextPageCursor || '';
        } while (nextCursor && !stoppedEarly && pageCount < 50);

        res.json({
            data: allFilteredUsers,
            nextPageCursor: null,
            previousPageCursor: null,
            debug: {
                pagesScanned: pageCount,
                totalUsersScanned: totalScanned,
                matchedCount: allFilteredUsers.length,
                stoppedEarlyOnMinRank: stoppedEarly,
                allRankNamesSeen: Array.from(seenRankNames)
            }
        });
    } catch (error) {
        console.error(`Roblox API Error: ${error.message}`);
        res.status(error.response?.status || 500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
