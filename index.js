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
