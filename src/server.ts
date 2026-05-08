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

    // Custom Player Logic using Middleware (Safer)
    const app = (server as any).app || (server as any).expressApp || (server as any).getApp?.();

    if (app) {
        app.use((req: any, res: any, next: any) => {
            const url = req.url;
            
            // Movie Player Handler
            if (url.startsWith('/v1/play/movie/')) {
                const id = url.split('/').pop();
                return renderPlayer(res, `/v1/movies/${id}`, `Movie ${id}`);
            }

            // TV Player Handler
            if (url.startsWith('/v1/play/tv/')) {
                const parts = url.split('/');
                const id = parts[4];
                const s = parts[5];
                const e = parts[6];
                return renderPlayer(res, `/v1/tv/${id}/${s}/${e}`, `TV S${s}E${e}`);
            }

            next();
        });
    }

    const registry = server.getRegistry();
    await registry.discoverProviders(path.join(__dirname, './providers/'));

    function renderPlayer(res: any, apiPath: string, title: string) {
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(`
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
                            const res = await fetch(window.location.origin + '${apiPath}');
                            const data = await res.json();
                            const url = data.sources?.[0]?.url;
                            if(!url) return document.body.innerHTML = '<h2 style="color:white;text-align:center;">No Link</h2>';
                            
                            new ArtPlayer({
                                container: '#artplayer',
                                url: url,
                                type: 'm3u8',
                                autoplay: true,
                                fullscreen: true,
                                customType: {
                                    m3u8: (v, u) => {
                                        if (Hls.isSupported()) {
                                            const hls = new Hls();
                                            hls.loadSource(u);
                                            hls.attachMedia(v);
                                        } else v.src = u;
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
