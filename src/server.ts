import { OMSSServer } from '@omss/framework';
import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { knownThirdPartyProxies } from './thirdPartyProxies.js';
import { streamPatterns } from './streamPatterns.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {

    const RENDER_URL = 'https://cineprocore-2.onrender.com';
    const publicUrl = process.env.PUBLIC_URL || (process.env.NODE_ENV === 'production' ? RENDER_URL : undefined);

    const server = new OMSSServer({
        name: 'CinePro',
        version: '1.0.0',

        host: process.env.HOST ?? '0.0.0.0',
        port: Number(process.env.PORT ?? 10000),
        publicUrl: publicUrl,

        cache: {
            type: (process.env.CACHE_TYPE) ?? 'memory',
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

        tmdb: {
            apiKey: process.env.TMDB_API_KEY!,
            cacheTTL: 24 * 60 * 60
        },

        proxyConfig: {
            knownThirdPartyProxies,
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

    const rawServer = server as any;
    const app = rawServer.app || rawServer._app || rawServer.instance;

    if (app) {

        app.get('/v1/play/movie/:id', async (req, res) => {

            const movieId = req.params.id;
            const apiPath = `/v1/movies/${movieId}`;

            res.setHeader('Content-Type', 'text/html');

            res.send(`

<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>CinePro Player</title>

<link rel="stylesheet" href="https://cdn.vidstack.io/player/theme.css"/>
<link rel="stylesheet" href="https://cdn.vidstack.io/player/video.css"/>

<script type="module" src="https://cdn.vidstack.io/player"></script>

<style>
html,body{
margin:0;
height:100%;
background:#000;
overflow:hidden;
}

.player-container{
width:100%;
height:100vh;
position:relative;
}

media-player{
width:100%;
height:100%;
--media-brand:#00b3ff;
}

.loading-screen{
position:absolute;
inset:0;
display:flex;
align-items:center;
justify-content:center;
background:#000;
z-index:10;
}

.loader{
width:60px;
height:60px;
border:4px solid rgba(255,255,255,.2);
border-top-color:#00b3ff;
border-radius:50%;
animation:spin 1s linear infinite;
}

@keyframes spin{
to{transform:rotate(360deg);}
}

.error-box{
position:absolute;
top:50%;
left:50%;
transform:translate(-50%,-50%);
color:#fff;
display:none;
padding:15px;
background:#111;
border-radius:10px;
}
</style>
</head>

<body>

<div class="player-container">

<div class="loading-screen" id="loading">
<div class="loader"></div>
</div>

<div class="error-box" id="errorBox">Stream Failed</div>

<media-player id="player" view-type="video" stream-type="on-demand" crossorigin playsinline>
<media-provider></media-provider>
<media-video-layout></media-video-layout>
</media-player>

</div>

<script type="module">

const player = document.getElementById('player');
const loading = document.getElementById('loading');
const errorBox = document.getElementById('errorBox');

async function loadSource() {

    try {

        const res = await fetch(window.location.origin + '${apiPath}');
        const data = await res.json();

        if (!data.sources?.length) throw new Error("No sources");

        let sources = data.sources;

        function tryPlay(i = 0) {

            if (i >= sources.length) {
                errorBox.style.display = "block";
                loading.style.display = "none";
                return;
            }

            let url = sources[i].url;

            if (url.includes('localhost:10000')) {
                url = url.replace('http://localhost:10000', window.location.origin);
            }

            try {

                player.src = {
                    src: url,
                    type: url.includes('.m3u8')
                        ? 'application/x-mpegurl'
                        : 'video/mp4'
                };

                console.log("Trying:", url);

            } catch (e) {
                tryPlay(i + 1);
            }
        }

        tryPlay();

    } catch (e) {
        console.error(e);
        loading.style.display = "none";
        errorBox.style.display = "block";
    }
}

player.addEventListener('can-play', () => {
    loading.style.display = "none";
});

player.addEventListener('error', () => {
    errorBox.style.display = "block";
    loading.style.display = "none";
});

window.addEventListener('DOMContentLoaded', loadSource);

</script>

</body>
</html>

            `);
        });
    }

    await server.start();
}

main().catch(console.error);
