import { OMSSServer } from '@omss/framework';
import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { knownThirdPartyProxies } from './thirdPartyProxies.js';
import { streamPatterns } from './streamPatterns.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    // Dynamic Public URL logic
    const RENDER_URL = 'https://cineprocore-2.onrender.com';
    const publicUrl = process.env.PUBLIC_URL || (process.env.NODE_ENV === 'production' ? RENDER_URL : undefined);

    const server = new OMSSServer({
        name: 'CinePro',
        version: '1.0.0',

        // Network
        host: process.env.HOST ?? '0.0.0.0',
        port: Number(process.env.PORT ?? 10000),
        publicUrl: publicUrl,

        // Cache
        cache: {
            type: (process.env.CACHE_TYPE as 'memory' | 'redis') ?? 'memory',
            ttl: {
                sources: 60 * 60,
                subtitles: 60 * 60 * 24
            },
            redis: {
                host: process.env.REDIS_HOST ?? 'localhost',
                port: Number(process.env.REDIS_PORT ?? 6379),
                password: process.env.REDIS_PASSWORD
            }
        },

        // TMDB
        tmdb: {
            apiKey: process.env.TMDB_API_KEY!,
            cacheTTL: 24 * 60 * 60
        },

        proxyConfig: {
            knownThirdPartyProxies: knownThirdPartyProxies,
            streamPatterns
        },

        cors: {
            origin: '*',
            methods: ['GET', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization']
        },

        stremio: {
            enableNativeAddon: process.env.STREMIO_ADDON === 'true',
            stremioAddons: [
                {
                    id: 'WebStreamerMBG',
                    url: 'https://87d6a6ef6b58-webstreamrmbg-dev.baby-beamup.club/manifest.json',
                    enabled: true
                },
                {
                    id: 'Streamify',
                    url: 'https://stremify.hayd.uk/manifest.json',
                    enabled: true
                }
            ]
        }
    });

    const registry = server.getRegistry();
    await registry.discoverProviders(path.join(__dirname, './providers/'));

    // --- PREMIUM VIDSTACK PLAYER SETUP ---
    const rawServer = server as any;
    const app = rawServer.app || rawServer._app || rawServer.instance;

    if (app) {
        app.get('/v1/play/movie/:id', async (req: any, res: any) => {
            const movieId = req.params.id;
            const apiPath = `/v1/movies/${movieId}`;

            res.setHeader('Content-Type', 'text/html');
            res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>CinePro Player</title>

<link rel="stylesheet" href="https://cdn.vidstack.io/player/theme.css" />
<link rel="stylesheet" href="https://cdn.vidstack.io/player/video.css" />

<script type="module" src="https://cdn.vidstack.io/player"></script>

<style>
*{
    margin:0;
    padding:0;
    box-sizing:border-box;
}

html,
body{
    width:100%;
    height:100%;
    overflow:hidden;
    background:#000;
    font-family:Arial,sans-serif;
}

body{
    display:flex;
    align-items:center;
    justify-content:center;
}

.player-container{
    width:100%;
    height:100vh;
    background:#000;
    position:relative;
}

media-player{
    width:100%;
    height:100%;
    background:#000;
    --media-brand:#00b3ff;
    --media-focus-ring-color:#00b3ff;
}

.vds-buffering-indicator{
    display:flex !important;
}

.loading-screen{
    position:absolute;
    inset:0;
    background:#000;
    display:flex;
    align-items:center;
    justify-content:center;
    z-index:999;
    transition:opacity .3s ease;
}

.loader{
    width:70px;
    height:70px;
    border:5px solid rgba(255,255,255,.15);
    border-top-color:#00b3ff;
    border-radius:50%;
    animation:spin 1s linear infinite;
}

@keyframes spin{
    to{
        transform:rotate(360deg);
    }
}

.error-box{
    position:absolute;
    top:50%;
    left:50%;
    transform:translate(-50%,-50%);
    color:#fff;
    background:#111;
    padding:20px 25px;
    border-radius:12px;
    font-size:15px;
    display:none;
    z-index:1000;
    text-align:center;
    border:1px solid rgba(255,255,255,.1);
}

</style>
</head>

<body>

<div class="player-container">

<div class="loading-screen" id="loading">
<div class="loader"></div>
</div>

<div class="error-box" id="errorBox">
Failed to load stream
</div>

<media-player
    id="player"
    title="CinePro"
    view-type="video"
    stream-type="on-demand"
    crossorigin
    playsinline
>
    <media-provider></media-provider>

    <media-video-layout
        thumbnails=""
        small-layout-when="never"
    ></media-video-layout>

</media-player>

</div>

<script type="module">

const player = document.getElementById('player');
const loading = document.getElementById('loading');
const errorBox = document.getElementById('errorBox');

async function loadSource() {

    try {

        const response = await fetch(window.location.origin + '${apiPath}');
        const data = await response.json();

        if (!data.sources || !data.sources.length) {
            throw new Error('No stream found');
        }

        let streamUrl = data.sources[0].url;

        if (streamUrl.includes('localhost:10000')) {
            streamUrl = streamUrl.replace(
                'http://localhost:10000',
                window.location.origin
            );
        }

        player.src = {
            src: streamUrl,
            type: 'video/mp4'
        };

    } catch (err) {

        console.error(err);

        loading.style.display = 'none';
        errorBox.style.display = 'block';
    }
}

player.addEventListener('can-play', () => {
    loading.style.opacity = '0';

    setTimeout(() => {
        loading.style.display = 'none';
    }, 300);
});

player.addEventListener('error', () => {
    loading.style.display = 'none';
    errorBox.style.display = 'block';
});

loadSource();

</script>

</body>
</html>
            `);
        });
    }

    await server.start();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
