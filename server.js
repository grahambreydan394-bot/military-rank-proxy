const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

// Render or other hosting providers automatically provide the PORT environment variable
const PORT = process.env.PORT || 3000;
const TARGET_GROUP = '3029096';

// Middleware
app.use(cors());
app.use(express.json());

// Base health-check route to see if the proxy is alive
app.get('/', (req, res) => {
    res.status(200).send('Roblox Proxy is Active and Running.');
});

// Dynamic proxy logic for all other routes
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
    console.log(`Forwarding ${req.method} request to Roblox: ${targetUrl}`);
    
    try {
        const response = await axios({
            method: req.method,
            url: targetUrl,
            data: req.body,
            headers: {
                // Forward original headers but overwrite the host to prevent SSL/certificate issues
                ...req.headers,
                host: 'groups.roblox.com',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            },
            // Prevent axios from throwing an error on non-200 status codes (e.g. 404, 400)
            validateStatus: () => true 
        });

        // Send the exact data and status back to the client
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error(`Proxy Error: ${error.message}`);
        res.status(500).json({ 
            error: 'Proxy Error', 
            details: error.message 
        });
    }
});

app.listen(PORT, () => {
    console.log(`Proxy listening on port ${PORT}`);
});
