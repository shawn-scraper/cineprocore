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

        // Network
        host: process.env.HOST ?? 'localhost',
        port: Number(process.env.PORT ?? 3000),
        publicUrl: process.env.PUBLIC_URL,

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

        // Proxy Config
        proxyConfig: {
            knownThirdPartyProxies: knownThirdPartyProxies,
            streamPatterns
        },

        cors: {
            origin: process.env.CORS_ORIGIN ?? '*',
            methods: ['GET', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            exposedHeaders: ['Content-Range', 'Accept-Ranges', 'ETag'],
            preflightContinue: false,
            optionsSuccessStatus: 204
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
        },

        mcp: {
            enabled: process.env.MCP_ENABLED === 'true'
        }
    });

    const registry = server.getRegistry();
    await registry.discoverProviders(path.join(__dirname, './providers/'));

    // --- ARTPLAYER CUSTOM ROUTES FIXED ---
    const app = (server as any).getApp();

    // Movie Player
    app.get('/v1/play/movie/:id', async (req: any, res: any) => {
        const id = req.params.id;
        const streamApiUrl = `${process.env.PUBLIC_URL || ''}/v1/movies/${id}`;
        renderPlayer(res, streamApiUrl, `Movie ${id}`);
    });

    // TV Player
    app.get('/v1/play/tv/:id/:s/:e', async (req: any, res: any) => {
        const { id, s, e } = req.params;
        const streamApiUrl = `${process.env.PUBLIC_URL || ''}/v1/tv/${id}/${s}/${e}`;
        renderPlayer(res, streamApiUrl, `TV Series ${id} - S${s}E${e}`);
    });

    function renderPlayer(res: any, apiUrl: string, title: string) {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${title}</title>
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
                            const response = await fetch('${apiUrl}');
                            const data = await response.json();
                            const m3u8Url = data.sources && data.sources[0] ? data.sources[0].url : '';
                            
                            if(!m3u8Url) {
                                document.body.innerHTML = '<h2 style="color:white;text-align:center;padding-top:20%;">Stream link not found yet. Try again later!</h2>';
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
                                playbackRate: true,
                                aspectRatio: true,
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
