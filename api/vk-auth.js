const https = require('https');

module.exports = async (req, res) => {
    const APP_ID = process.env.VK_CLIENT_ID || '54397933';
    const APP_SECRET = process.env.VK_CLIENT_SECRET || '4Vp29hWzqpcBcBgOUYD3';

    const {
        code,
        code_verifier,
        device_id,
        redirect_uri
    } = req.query;

    if (!code || !code_verifier || !device_id || !redirect_uri) {
        return res.status(400).json({
            error: 'Missing required params',
            required: ['code', 'code_verifier', 'device_id', 'redirect_uri']
        });
    }

    const postData = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: APP_ID,
        client_secret: APP_SECRET,
        redirect_uri,
        code,
        code_verifier,
        device_id
    }).toString();

    const options = {
        hostname: 'id.vk.com',
        path: '/oauth2/token',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const vkResponse = await new Promise((resolve, reject) => {
        const request = https.request(options, (resp) => {
            let data = '';
            resp.on('data', chunk => data += chunk);
            resp.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        });

        request.on('error', reject);
        request.write(postData);
        request.end();
    });

    if (vkResponse.error) {
        console.error('VK ID error:', vkResponse);
        return res.status(400).json(vkResponse);
    }

    return res.status(200).json({
        vk_id: vkResponse.user_id,
        access_token: vkResponse.access_token,
        refresh_token: vkResponse.refresh_token,
        expires_in: vkResponse.expires_in
    });
};
