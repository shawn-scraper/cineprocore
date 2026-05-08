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
        host: process.env.HOST ?? '0.0.0.0', // Render er jonno 0.0.0.0 bhalo
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

    // --- CUSTOM PLAYER INJECTION (VidStack) ---
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
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Playing Movie ${movieId}</title>
                    <link rel="stylesheet" href="https://cdn.vidstack.io/player/theme.css" />
                    <link rel="stylesheet" href="https://cdn.vidstack.io/player/video.css" />
                    <script src="https://cdn.vidstack.io/player" type="module"></script>
                    <style>
                        body { margin: 0; background: #000; display: flex; justify-content: center; align-items: center; height: 100vh; }
                        media-player { width: 100%; aspect-ratio: 16 / 9; max-width: 1200px; }
                    </style>
                </head>
                <body>
                    <media-player title="Movie Stream" src="" crossorigin>
                        <media-provider></media-provider>
                        <media-video-layout></media-video-layout>
                    </media-player>

                    <script type="module">
                        const player = document.querySelector('media-player');
                        async function loadSource() {
                            try {
                                const response = await fetch(window.location.origin + '${apiPath}');
                                const data = await response.json();
                                if (data.sources && data.sources.length > 0) {
                                    // Localhost ke Render URL diye replace kora (Safety Net)
                                    let streamUrl = data.sources[0].url;
                                    if(streamUrl.includes('localhost:10000')) {
                                        streamUrl = streamUrl.replace('http://localhost:10000', window.location.origin);
                                    }
                                    player.src = streamUrl;
                                }
                            } catch (e) { console.error("Error loading stream:", e); }
                        }
                        player.addEventListener('can-play', () => console.log('Ready to play!'));
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
