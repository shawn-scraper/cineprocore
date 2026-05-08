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

    // --- ARTPLAYER CUSTOM ROUTES ---
    const app = (server as any).app || (server as any).expressApp || (server as any).getApp?.();

    if (app) {
        // Direct Movie Player Route
        app.get('/v1/play/movie/:id', async (req: any, res: any) => {
            const id = req.params.id;
            const apiPath = `/v1/movies/${id}`;
            renderPlayer(res, apiPath, `Movie ${id}`);
        });

        // Direct TV Player Route
        app.get('/v1/play/tv/:id/:s/:e', async (req: any, res: any) => {
            const { id, s, e } = req.params;
            const apiPath = `/v1/tv/${id}/${s}/${e}`;
            renderPlayer(res, apiPath, `TV Series ${id} - S${s}E${e}`);
        });
    }

    function renderPlayer(res: any, apiPath: string, title: string) {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${title} | Lumina Player</title>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
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
                            const baseUrl = window.location.origin;
                            const fullApiUrl = baseUrl + '${apiPath}';
                            
                            const response = await fetch(fullApiUrl);
                            const data = await response.json();
                            
                            let m3u8Url = '';
                            if (data.sources && data.sources.length > 0) {
                                m3u8Url = data.sources[0].url;
                            }

                            if(!m3u8Url) {
                                document.body.innerHTML = '<div style="color:white;text-align:center;padding-top:20%;font-family:sans-serif;"><h2>Stream link not found!</h2><p>Server-er details check korun.</p></div>';
                                return;
                            }

                            new ArtPlayer({
                                container: '#artplayer',
                                url: m3u8Url,
                                type: 'm3u8',
                                title: '${title}',
                                autoplay: true,
                                volume: 0.8,
                                pip: true,
                                screenshot: true,
                                setting: true,
                                playbackRate: true,
                                aspectRatio: true,
                                fullscreen: true,
                                fullscreenWeb: true,
                                autoSize: true,
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
                        } catch (err) { 
                            console.error('Player Error:', err);
                        }
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
