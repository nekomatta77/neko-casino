const https = require('https');

module.exports = async (req, res) => {
  try {
    const APP_ID = process.env.VK_CLIENT_ID;

    const { code, code_verifier, device_id, redirect_uri } = req.query;

    if (!code || !code_verifier || !device_id || !redirect_uri) {
      return res.status(400).json({ error: 'Missing params' });
    }

    const postData = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: APP_ID,
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

    const raw = await new Promise((resolve, reject) => {
      const r = https.request(options, resp => {
        let d = '';
        resp.on('data', c => d += c);
        resp.on('end', () => resolve(d));
      });
      r.on('error', reject);
      r.write(postData);
      r.end();
    });

    const data = JSON.parse(raw);

    if (data.error) {
      return res.status(400).json(data);
    }

    res.status(200).json({
      vk_id: data.user_id,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};
