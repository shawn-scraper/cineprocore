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
            origin: '*',
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
        app.get('/v1/play/movie/:id', async (req: any, res: any) => {
            const id = req.params.id;
            renderPlayer(res, `/v1/movies/${id}`, `Movie ${id}`);
        });

        app.get('/v1/play/tv/:id/:s/:e', async (req: any, res: any) => {
            const { id, s, e } = req.params;
            renderPlayer(res, `/v1/tv/${id}/${s}/${e}`, `TV S${s}E${e}`);
        });
    }

    function renderPlayer(res: any, apiPath: string, title: string) {
        // Eita browser ke bolbe eita ekta HTML page
        res.setHeader('Content-Type', 'text/html');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${title} | Lumina Player</title>
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
                    async function initPlayer() {
                        try {
                            const response = await fetch(window.location.origin + '${apiPath}');
                            const data = await response.json();
                            const m3u8Url = data.sources?.[0]?.url;

                            if(!m3u8Url) {
                                document.body.innerHTML = '<h2 style="color:white;text-align:center;padding-top:20%;">Stream link not found!</h2>';
                                return;
                            }

                            new ArtPlayer({
                                container: '#artplayer',
                                url: m3u8Url,
                                type: 'm3u8',
                                title: '${title}',
                                autoplay: true,
                                pip: true,
                                screenshot: true,
                                setting: true,
                                fullscreen: true,
                                fullscreenWeb: true,
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
                        } catch (err) { console.error(err); }
                    }
                    initPlayer();
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
