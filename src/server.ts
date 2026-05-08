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

        // Cache (memory for dev, Redis for prod)
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
            cacheTTL: 24 * 60 * 60 // 24h
        },

        // Third Party Proxy removal
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

    // --- ARTPLAYER CUSTOM ROUTES START ---
    const app = server.getApp();

    // Direct Movie Player Route
    app.get('/v1/play/movie/:id', async (req, res) => {
        const id = req.params.id;
        const streamApiUrl = `${process.env.PUBLIC_URL || ''}/v1/movies/${id}`;
        renderPlayer(res, streamApiUrl, `Movie ${id}`);
    });

    // Direct TV Show Player Route
    app.get('/v1/play/tv/:id/:s/:e', async (req, res) => {
        const { id, s, e } = req.params;
        const streamApiUrl = `${process.env.PUBLIC_URL || ''}/v1/tv/${id}/${s}/${e}`;
        renderPlayer(res, streamApiUrl, `TV Series ${id} - S${s}E${e}`);
    });

    // Helper function to render HTML
    function renderPlayer(res: any, apiUrl: string, title: string) {
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
                            const response = await fetch('${apiUrl}');
                            const data = await response.json();
                            const m3u8Url = data.sources && data.sources[0] ? data.sources[0].url : '';
                            
                            if(!m3u8Url) {
                                document.body.innerHTML = '<h2 style="color:white;text-align:center;margin-top:20%;">No Stream Found!</h2>';
                                return;
                            }

                            var art = new ArtPlayer({
                                container: '#artplayer',
                                url: m3u8Url,
                                type: 'm3u8',
                                title: '${title}',
                                poster: '', 
                                volume: 0.7,
                                isLive: false,
                                muted: false,
                                autoplay: true,
                                pip: true,
                                autoSize: true,
                                autoMini: true,
                                screenshot: true,
                                setting: true,
                                loop: false,
                                flip: true,
                                playbackRate: true,
                                aspectRatio: true,
                                fullscreen: true,
                                fullscreenWeb: true,
                                subtitleOffset: true,
                                miniProgressBar: true,
                                mutex: true,
                                backdrop: true,
                                playsInline: true,
                                autoPlayback: true,
                                airplay: true,
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
                            console.error(err);
                        }
                    }
                    initPlayer();
                </script>
            </body>
            </html>
        `);
    }
    // --- ARTPLAYER CUSTOM ROUTES END ---

    await server.start();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
