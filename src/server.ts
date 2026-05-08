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
        version: '1.1.0',

        // Network Configuration
        host: process.env.HOST ?? '0.0.0.0',
        port: Number(process.env.PORT ?? 10000),
        publicUrl: publicUrl,

        // Cache Management
        cache: {
            type: (process.env.CACHE_TYPE as 'memory' | 'redis') ?? 'memory',
            ttl: {
                sources: 3600,
                subtitles: 86400
            }
        },

        // TMDB Setup
        tmdb: {
            apiKey: process.env.TMDB_API_KEY!,
            cacheTTL: 86400
        },

        proxyConfig: {
            knownThirdPartyProxies: knownThirdPartyProxies,
            streamPatterns
        },

        cors: {
            origin: '*',
            methods: ['GET', 'OPTIONS']
        },

        stremio: {
            enableNativeAddon: true,
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

    // --- HTML PLAYER ROUTE ---
    const rawServer = server as any;
    const app = rawServer.app || rawServer._app || rawServer.instance;

    if (app) {
        // Ami route ta /play/:id rakhlam jate /v1 er sathe conflict na hoy
        app.get('/play/:id', async (req: any, res: any) => {
            const movieId = req.params.id;
            
            res.setHeader('Content-Type', 'text/html');
            res.send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>CinePro Premium Player</title>
                    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
                    <style>
                        body { margin: 0; background: #000; color: #fff; font-family: sans-serif; overflow: hidden; }
                        #player-container { width: 100vw; height: 100vh; display: flex; justify-content: center; align-items: center; }
                        video { width: 100%; height: 100%; max-width: 100%; outline: none; }
                        .error-msg { position: absolute; color: red; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div id="player-container">
                        <video id="video" controls autoplay crossorigin></video>
                    </div>

                    <script>
                        const video = document.getElementById('video');
                        const movieId = "${movieId}";
                        
                        async function init() {
                            try {
                                // Direct API call to get sources
                                const apiUrl = window.location.origin + "/v1/movies/" + movieId;
                                const response = await fetch(apiUrl);
                                const data = await response.json();

                                if (data.sources && data.sources.length > 0) {
                                    const source = data.sources[0].url;
                                    console.log("Playing Source:", source);

                                    if (Hls.isSupported()) {
                                        const hls = new Hls();
                                        hls.loadSource(source);
                                        hls.attachMedia(video);
                                        hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
                                    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                                        video.src = source;
                                    }
                                } else {
                                    document.getElementById('player-container').innerHTML = "No Streamable Source Found!";
                                }
                            } catch (err) {
                                console.error("Player Error:", err);
                                alert("Failed to load stream. Check console.");
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
    console.error(err);
    process.exit(1);
});
