const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 3000;
const TARGET_GROUP = '3029096';

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.status(200).send('Roblox Proxy is Active and Running.');
});

app.all('/*', async (req, res) => {
    if (!req.url.includes(TARGET_GROUP)) {
        return res.status(403).json({ 
            error: 'Forbidden', 
            message: `This proxy is locked to Group ID ${TARGET_GROUP}.` 
        });
    }

    const targetUrl = `https://groups.roblox.com${req.url}`;
    console.log(`Forwarding ${req.method} request to Roblox: ${targetUrl}`);
    
    try {
        const response = await axios({
            method: req.method,
            url: targetUrl,
            data: req.body,
            headers: {
                ...req.headers,
                host: 'groups.roblox.com',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            },
            validateStatus: () => true 
        });

        if (req.method === 'GET' && response.status === 200 && response.data && Array.isArray(response.data.data)) {
            
            const filteredMembers = response.data.data.filter(member => {
                return member.role && member.role.rank >= 18;
            });

            response.data.data = filteredMembers;
        }

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
    console.log(`Proxy running on port ${PORT}`);
});
