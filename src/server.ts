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
                    <link rel="stylesheet" href="https://cdn.plyr.io/3.7.8/plyr.css" />
                    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
                    <style>
                        body, html { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; overflow: hidden; display: flex; align-items: center; justify-content: center; }
                        .plyr-container { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; }
                        video { width: 100% !important; height: 100% !important; object-fit: contain; }
                        #status-msg { 
                            position: fixed; 
                            color: #e50914; 
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                            font-size: 1.2rem;
                            font-weight: bold;
                            text-transform: uppercase;
                            letter-spacing: 2px;
                            z-index: 100;
                            text-align: center;
                        }
                        .plyr--video { height: 100% !important; width: 100% !important; }
                    </style>
                </head>
                <body>
                    <div id="status-msg">Initializing CinePro Stream...</div>
                    <div class="plyr-container">
                        <video id="player" playsinline controls crossorigin></video>
                    </div>

                    <script src="https://cdn.plyr.io/3.7.8/plyr.polyfilled.js"></script>
                    <script>
                        async function start() {
                            const msg = document.getElementById('status-msg');
                            const video = document.getElementById('player');
                            
                            try {
                                const response = await fetch("/v1/movies/${movieId}");
                                const data = await response.json();

                                if (data.sources && data.sources.length > 0) {
                                    const sourceUrl = data.sources[0].url;

                                    if (sourceUrl.includes('m3u8')) {
                                        const hls = new Hls({
                                            maxBufferLength: 60,
                                            enableWorker: true
                                        });
                                        hls.loadSource(sourceUrl);
                                        hls.attachMedia(video);
                                        hls.on(Hls.Events.MANIFEST_PARSED, function() {
                                            msg.style.display = 'none';
                                            video.play().catch(() => { msg.innerText = "Click to Play"; });
                                        });
                                        window.hls = hls;
                                    } else {
                                        video.src = sourceUrl;
                                        video.onloadeddata = () => { msg.style.display = 'none'; };
                                    }

                                    const player = new Plyr(video, {
                                        autoplay: true,
                                        controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'captions', 'settings', 'pip', 'fullscreen'],
                                        tooltips: { controls: true, seek: true }
                                    });
                                } else {
                                    msg.innerText = "Error: Content Not Found";
                                }
                            } catch (err) {
                                console.error(err);
                                msg.innerText = "Error: Server Connection Failed";
                            }
                        }
                        start();
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
