import { OMSSServer } from '@omss/framework';
import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { knownThirdPartyProxies } from './thirdPartyProxies.js';
import { streamPatterns } from './streamPatterns.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    const server = new OMSSServer({
        name: 'CinePro',
        version: '1.0.0',
        host: process.env.HOST ?? '0.0.0.0',
        port: Number(process.env.PORT ?? 10000),
        publicUrl: process.env.PUBLIC_URL,
        cache: {
            type: (process.env.CACHE_TYPE as 'memory' | 'redis') ?? 'memory',
            ttl: { sources: 3600, subtitles: 86400 },
            redis: {
                host: process.env.REDIS_HOST ?? 'localhost',
                port: Number(process.env.REDIS_PORT ?? 6379),
                password: process.env.REDIS_PASSWORD
            }
        },
        tmdb: {
            apiKey: process.env.TMDB_API_KEY!,
            cacheTTL: 86400
        },
        proxyConfig: {
            knownThirdPartyProxies,
            streamPatterns
        },
        cors: { origin: '*', methods: ['GET', 'OPTIONS'] },
        stremio: {
            enableNativeAddon: process.env.STREMIO_ADDON === 'true',
            stremioAddons: []
        }
    });

    const registry = server.getRegistry();
    await registry.discoverProviders(path.join(__dirname, './providers/'));

    // --- DEEP ROUTE INJECTION ---
    const rawServer = server as any;
    // Framework-er internal express app khuje ber kora
    const app = rawServer.app || rawServer._app || rawServer.instance || (rawServer.getApp ? rawServer.getApp() : null);

    if (app) {
        // Movie Player Route
        app.get('/v1/play/movie/:id', (req: any, res: any) => {
            return sendPlayerHtml(res, `/v1/movies/${req.params.id}`, `Movie ${req.params.id}`);
        });

        // TV Player Route
        app.get('/v1/play/tv/:id/:s/:e', (req: any, res: any) => {
            return sendPlayerHtml(res, `/v1/tv/${req.params.id}/${req.params.s}/${req.params.e}`, `TV S${req.params.s}E${req.params.e}`);
        });
        
        console.log("✅ Custom Player Routes Registered Successfully!");
    } else {
        console.error("❌ Could not find Express app instance!");
    }

    function sendPlayerHtml(res: any, apiPath: string, title: string) {
        res.setHeader('Content-Type', 'text/html');
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${title}</title>
                <meta charset="UTF-8" />
                <script src="https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.js"></script>
                <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
                <style>
                    body, html { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; overflow: hidden; }
                    #artplayer { width: 100vw; height: 100vh; }
                </style>
            </head>
            <body>
                <div id="artplayer"></div>
                <script>
                    async function init() {
                        try {
                            const apiUrl = window.location.origin + '${apiPath}';
                            const response = await fetch(apiUrl);
                            const data = await response.json();
                            const m3u8Url = data.sources?.[0]?.url;

                            if(!m3u8Url) {
                                document.body.innerHTML = '<h2 style="color:white;text-align:center;margin-top:20%;">Link Load Hocche na, Server Check Karun.</h2>';
                                return;
                            }

                            new ArtPlayer({
                                container: '#artplayer',
                                url: m3u8Url,
                                type: 'm3u8',
                                autoplay: true,
                                fullscreen: true,
                                fullscreenWeb: true,
                                customType: {
                                    m3u8: (video, url) => {
                                        if (Hls.isSupported()) {
                                            const hls = new Hls();
                                            hls.loadSource(url);
                                            hls.attachMedia(video);
                                        } else video.src = url;
                                    }
                                }
                            });
                        } catch(e) { console.error(e); }
                    }
                    init();
                </script>
            </body>
            </html>
        `);
    }

    await server.start();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
