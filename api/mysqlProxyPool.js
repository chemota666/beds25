const PROXY_URL = 'https://n8n-contabo.ddns.net:8445/mysql-proxy/';

async function query(sql, params = []) {
    const response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sql, params })
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
    return [result.data];
}

export default { query };
