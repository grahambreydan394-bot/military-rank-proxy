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
const express = require('express');
const axios = require('axios');
const app = express();

// Render automatically provides the PORT environment variable
const PORT = process.env.PORT || 3000;
const TARGET_GROUP = '3029096';

app.use(express.json());

// Base health-check route so you can see if the proxy is alive
app.get('/', (req, res) => {
    res.status(200).send('Roblox Proxy is Active and Running.');
});

// Proxy logic
app.all('/*', async (req, res) => {
    // Security check: Ensure requests only query your specific group ID
    if (!req.url.includes(TARGET_GROUP)) {
        return res.status(403).json({ 
            error: 'Forbidden', 
            message: `This proxy is locked to Group ID ${TARGET_GROUP}.` 
        });
    }

    // Build the target Roblox API URL
    const targetUrl = `https://groups.roblox.com${req.url}`;
    
    try {
        const response = await axios({
            method: req.method,
            url: targetUrl,
            data: req.body,
            headers: {
                // Forward original headers but overwrite the host to prevent SSL/certificate issues
                ...req.headers,
                host: 'groups.roblox.com'
            },
            // Prevent axios from throwing an error on non-200 status codes (e.g. 404, 400)
            validateStatus: () => true 
        });

        // Send the exact data and status back to Roblox
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(500).json({ 
            error: 'Proxy Error', 
            details: error.message 
        });
    }
});

app.listen(PORT, () => {
    console.log(`Proxy listening on port ${PORT}`);
});
