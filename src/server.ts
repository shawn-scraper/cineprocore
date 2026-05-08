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
            knownThirdPartyProxies: knownThirdPartyProxies,
            streamPatterns
        },

        cors: {
            origin: '*', // Sob domain allow kora holo
            methods: ['GET', 'OPTIONS']
        },

        stremio: {
            enableNativeAddon: process.env.STREMIO_ADDON === 'true',
            stremioAddons: [
                { id: 'WebStreamerMBG', url: 'https://87d6a6ef6b58-webstreamrmbg-dev.baby-beamup.club/manifest.json', enabled: true },
                { id: 'Streamify', url: 'https://stremify.hayd.uk/manifest.json', enabled: true }
            ]
        }
    });

    const registry = server.getRegistry();
    await registry.discoverProviders(path.join(__dirname, './providers/'));

    const app = (server as any).app || (server as any).expressApp || (server as any).getApp?.();

    if (app) {
        // Player Routes
        app.get('/v1/play/movie/:id', (req: any, res: any) => {
            renderPlayer(res, `/v1/movies/${req.params.id}`, `Movie ${req.params.id}`);
        });

        app.get('/v1/play/tv/:id/:s/:e', (req: any, res: any) => {
            renderPlayer(res, `/v1/tv/${req.params.id}/${req.params.s}/${req.params.e}`, `TV S${req.params.s}E${req.params.e}`);
        });
    }

    function renderPlayer(res: any, apiPath: string, title: string) {
        res.setHeader('Content-Type', 'text/html');
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <title>${title}</title>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <script src="https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.js"></script>
                <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
                <style>
                    body, html { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; display: flex; justify-content: center; align-items: center; }
                    #artplayer { width: 100%; height: 100%; }
                </style>
            </head>
            <body>
                <div id="artplayer"></div>
                <script>
                    async function loadStream() {
                        try {
                            const apiUrl = window.location.origin + '${apiPath}';
                            const response = await fetch(apiUrl);
                            const data = await response.json();
                            
                            // Check if sources exist
                            const streamUrl = data.sources?.[0]?.url;

                            if (!streamUrl) {
                                document.body.innerHTML = '<h2 style="color:white; font-family:sans-serif;">No stream link found from server!</h2>';
                                return;
                            }

                            const art = new ArtPlayer({
                                container: '#artplayer',
                                url: streamUrl,
                                type: 'm3u8',
                                title: '${title}',
                                autoplay: true,
                                pip: true,
                                screenshot: true,
                                setting: true,
                                fullscreen: true,
                                fullscreenWeb: true,
                                theme: '#ff0057',
                                customType: {
                                    m3u8: function(video, url) {
                                        if (Hls.isSupported()) {
                                            const hls = new Hls();
                                            hls.loadSource(url);
                                            hls.attachMedia(video);
                                        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                                            video.src = url;
                                        }
                                    }
                                }
                            });
                        } catch (e) {
                            console.error("Player Error:", e);
                            document.body.innerHTML = '<h2 style="color:white; font-family:sans-serif;">Error loading API. Check Console.</h2>';
                        }
                    }
                    loadStream();
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
