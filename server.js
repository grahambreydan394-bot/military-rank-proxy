const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Universal catch-all route for incoming Google Sheet requests
app.get('*', async (req, res) => {
    try {
        const cursor = req.query.cursor ? `&cursor=${encodeURIComponent(req.query.cursor)}` : '';
        
        // Correct official Roblox API path uses /users instead of /members
        const robloxUrl = `https://groups.roblox.com/v1/groups/3029096/users?sortOrder=Asc&limit=100${cursor}`;
        
        console.log(`Forwarding request to Roblox: ${robloxUrl}`);
        
        const response = await axios.get(robloxUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        
        res.json(response.data);
    } catch (error) {
        console.error(`Roblox API Error: ${error.message}`);
        res.status(error.response?.status || 500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
