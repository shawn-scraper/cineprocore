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
        version: '1.1.0',
        host: process.env.HOST ?? '0.0.0.0',
        port: Number(process.env.PORT ?? 10000),
        publicUrl: publicUrl,
        cache: {
            type: (process.env.CACHE_TYPE as 'memory' | 'redis') ?? 'memory',
            ttl: { sources: 3600, subtitles: 86400 }
        },
        tmdb: {
            apiKey: process.env.TMDB_API_KEY!,
            cacheTTL: 86400
        },
        proxyConfig: {
            knownThirdPartyProxies: knownThirdPartyProxies,
            streamPatterns
        },
        cors: { origin: '*', methods: ['GET', 'OPTIONS'] },
        stremio: {
            enableNativeAddon: true,
            stremioAddons: [
                { id: 'WebStreamerMBG', url: 'https://87d6a6ef6b58-webstreamrmbg-dev.baby-beamup.club/manifest.json', enabled: true },
                { id: 'Streamify', url: 'https://stremify.hayd.uk/manifest.json', enabled: true }
            ]
        }
    });

    const registry = server.getRegistry();
    await registry.discoverProviders(path.join(__dirname, './providers/'));

    const fastify = (server as any).app || (server as any).instance;

    if (fastify) {
        fastify.get('/play/:id', async (request: any, reply: any) => {
            const movieId = request.params.id;
            
            reply.type('text/html').send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>CinePro Premium Player</title>
                    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.css" />
                    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
                    <script src="https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.js"></script>
                    <style>
                        body, html { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; overflow: hidden; display: flex; align-items: center; justify-content: center; }
                        #loader { position: fixed; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 99; }
                        .spinner { width: 45px; height: 45px; border: 4px solid rgba(255,255,255,0.1); border-top: 4px solid #e50914; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 15px; }
                        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                        #status-text { color: #fff; font-family: sans-serif; font-size: 13px; letter-spacing: 1.5px; opacity: 0.8; }
                        #player-box { width: 100vw; height: 100vh; opacity: 0; transition: opacity 0.4s ease; }
                        #player-box.ready { opacity: 1; }
                    </style>
                </head>
                <body>
                    <div id="loader">
                        <div class="spinner"></div>
                        <div id="status-text">PREPARING CINEMATIC EXPERIENCE...</div>
                    </div>

                    <div id="player-box"></div>

                    <script>
                        async function initPlayer() {
                            const loader = document.getElementById('loader');
                            const playerBox = document.getElementById('player-box');

                            try {
                                const res = await fetch("/v1/movies/${movieId}");
                                const data = await res.json();

                                if (!data.sources || data.sources.length === 0) {
                                    document.getElementById('status-text').innerText = "CONTENT UNAVAILABLE";
                                    return;
                                }

                                const source = data.sources[0].url;

                                const art = new Artplayer({
                                    container: '#player-box',
                                    url: source,
                                    autoplay: true,
                                    fullscreen: true,
                                    autoSize: true,
                                    autoMini: true,
                                    setting: true,
                                    hotkey: true,
                                    pip: true,
                                    mutex: true,
                                    fullscreenWeb: true,
                                    quality: [
                                        { html: '1080p', url: source, default: true },
                                        { html: '720p', url: source },
                                        { html: '480p', url: source },
                                        { html: '360p', url: source },
                                    ],
                                    subtitle: data.subtitles && data.subtitles.length > 0 ? {
                                        url: data.subtitles[0].url,
                                        type: 'vtt',
                                        encoding: 'utf-8',
                                    } : null,
                                    playbackRate: true,
                                    controls: true,
                                    theme: '#e50914',
                                });

                                art.on('ready', () => {
                                    loader.style.display = 'none';
                                    playerBox.classList.add('ready');
                                });

                            } catch (e) {
                                console.error(e);
                                document.getElementById('status-text').innerText = "CONNECTION FAILED";
                            }
                        }
                        initPlayer();
                    </script>
                </body>
                </html>
            `);
        });
    }

    await server.start();
}

main().catch((err) => {
    console.error("Fatal Error:", err);
    process.exit(1);
});
