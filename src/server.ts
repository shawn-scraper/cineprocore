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
                    <title>CinePro Premium Player</title>
                    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
                    <script src="https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.js"></script>
                    <style>
                        body { margin: 0; background: #000; height: 100vh; overflow: hidden; font-family: sans-serif; }
                        .artplayer-app { width: 100vw; height: 100vh; }
                        #loading-overlay {
                            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                            background: #000; display: flex; flex-direction: column;
                            justify-content: center; align-items: center; z-index: 999; color: #fff;
                        }
                        .spinner {
                            border: 4px solid rgba(255, 255, 255, 0.1);
                            border-left-color: #e50914;
                            border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite;
                        }
                        @keyframes spin { to { transform: rotate(360deg); } }
                        #status { margin-top: 20px; font-size: 14px; color: #aaa; text-transform: uppercase; letter-spacing: 1px; text-align: center; padding: 0 20px; }
                    </style>
                </head>
                <body>
                    <div id="loading-overlay">
                        <div class="spinner"></div>
                        <div id="status">Connecting to CinePro Server...</div>
                    </div>
                    <div class="artplayer-app"></div>

                    <script>
                        const status = document.getElementById('status');
                        const loader = document.getElementById('loading-overlay');

                        async function init() {
                            try {
                                status.innerText = "Searching high-speed servers...";
                                
                                // Direct Absolute URL to prevent path issues
                                const apiUrl = window.location.origin + "/v1/movies/${movieId}";
                                const res = await fetch(apiUrl);
                                
                                if (!res.ok) throw new Error("API Response Error: " + res.status);
                                
                                const data = await res.json();

                                if (!data.sources || data.sources.length === 0) {
                                    status.innerText = "❌ No streaming sources found for this ID!";
                                    document.querySelector('.spinner').style.display = 'none';
                                    return;
                                }

                                status.innerText = "Optimizing playback quality...";

                                const qualities = data.sources.map(s => ({
                                    html: s.quality || 'Auto',
                                    url: s.url,
                                    isHls: s.url.includes('m3u8') || s.type === 'hls'
                                }));

                                const art = new ArtPlayer({
                                    container: '.artplayer-app',
                                    url: qualities[0].url,
                                    type: qualities[0].isHls ? 'm3u8' : 'mp4',
                                    setting: true,
                                    fullscreen: true,
                                    pip: true,
                                    playbackRate: true,
                                    aspectRatio: true,
                                    quality: qualities,
                                    autoPlayback: true,
                                    customType: {
                                        m3u8: function (video, url) {
                                            if (Hls.isSupported()) {
                                                const hls = new Hls();
                                                hls.loadSource(url);
                                                hls.attachMedia(video);
                                            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                                                video.src = url;
                                            }
                                        },
                                    },
                                });

                                art.on('ready', () => {
                                    loader.style.display = 'none';
                                    art.play().catch(() => {
                                        status.innerText = "Click to play"; // Mobile/Safari user interaction needed
                                    });
                                });

                            } catch (e) {
                                console.error("Player Init Error:", e);
                                status.innerText = "⚠️ Server Connection Failed! Please refresh.";
                                document.querySelector('.spinner').style.display = 'none';
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
