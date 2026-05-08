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
                    <title>CinePro Premium</title>
                    <link rel="stylesheet" href="https://cdn.plyr.io/3.7.8/plyr.css" />
                    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
                    <style>
                        body, html { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; overflow: hidden; display: flex; align-items: center; justify-content: center; }
                        
                        /* Shurute video hide kora thakbe jate default player na dekha jay */
                        .plyr-container { width: 100vw; height: 100vh; opacity: 0; transition: opacity 0.5s ease-in-out; }
                        .plyr-container.ready { opacity: 1; }

                        #loader {
                            position: fixed;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            z-index: 999;
                        }

                        .spinner {
                            width: 50px;
                            height: 50px;
                            border: 5px solid #333;
                            border-top: 5px solid #e50914;
                            border-radius: 50%;
                            animation: spin 1s linear infinite;
                            margin-bottom: 15px;
                        }

                        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

                        #status-text {
                            color: #fff;
                            font-family: 'Arial', sans-serif;
                            font-size: 14px;
                            text-transform: uppercase;
                            letter-spacing: 2px;
                        }

                        .plyr--video { height: 100% !important; }
                    </style>
                </head>
                <body>
                    <div id="loader">
                        <div class="spinner"></div>
                        <div id="status-text">CinePro Secure Link...</div>
                    </div>

                    <div class="plyr-container" id="player-box">
                        <video id="player" playsinline controls crossorigin></video>
                    </div>

                    <script src="https://cdn.plyr.io/3.7.8/plyr.polyfilled.js"></script>
                    <script>
                        async function init() {
                            const playerBox = document.getElementById('player-box');
                            const loader = document.getElementById('loader');
                            const status = document.getElementById('status-text');
                            const video = document.getElementById('player');
                            
                            try {
                                const response = await fetch("/v1/movies/${movieId}");
                                const data = await response.json();

                                if (data.sources && data.sources.length > 0) {
                                    const sourceUrl = data.sources[0].url;

                                    const player = new Plyr(video, {
                                        autoplay: true,
                                        controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'pip', 'fullscreen'],
                                    });

                                    if (sourceUrl.includes('m3u8')) {
                                        const hls = new Hls();
                                        hls.loadSource(sourceUrl);
                                        hls.attachMedia(video);
                                        hls.on(Hls.Events.MANIFEST_PARSED, () => {
                                            loader.style.display = 'none';
                                            playerBox.classList.add('ready');
                                        });
                                    } else {
                                        video.src = sourceUrl;
                                        video.onloadeddata = () => {
                                            loader.style.display = 'none';
                                            playerBox.classList.add('ready');
                                        };
                                    }
                                } else {
                                    status.innerText = "NO SOURCE FOUND";
                                    status.style.color = "red";
                                }
                            } catch (err) {
                                status.innerText = "SERVER ERROR";
                            }
                        }
                        init();
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
