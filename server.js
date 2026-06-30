const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;
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

// Universal catch-all route for incoming Google Sheet requests
app.get('*', async (req, res) => {
    try {
        let cursor = req.query.cursor || '';
        let allFilteredUsers = [];
        let nextCursor = '';
        let safetyCounter = 0; // prevent infinite loops

        // Roblox paginates 100 at a time, and since we're filtering out
        // most ranks, we need to walk through pages ourselves until
        // we've either run out of pages or hit a reasonable cap.
        do {
            const cursorParam = nextCursor || cursor
                ? `&cursor=${encodeURIComponent(nextCursor || cursor)}`
                : '';

            const robloxUrl = `https://groups.roblox.com/v1/groups/3029096/users?sortOrder=Asc&limit=100${cursorParam}`;

            console.log(`Forwarding request to Roblox: ${robloxUrl}`);

            const response = await axios.get(robloxUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });

            const data = response.data;

            const filtered = (data.data || []).filter(member =>
                ALLOWED_RANKS.has(member.role?.name)
            );

            allFilteredUsers = allFilteredUsers.concat(filtered);

            nextCursor = data.nextPageCursor || '';
            safetyCounter++;

            // Stop once Roblox tells us there are no more pages,
            // or as a safety net after 50 pages (5000 members scanned)
        } while (nextCursor && safetyCounter < 50);

        res.json({
            data: allFilteredUsers,
            nextPageCursor: null, // we've already walked all pages
            previousPageCursor: null
        });
    } catch (error) {
        console.error(`Roblox API Error: ${error.message}`);
        res.status(error.response?.status || 500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
