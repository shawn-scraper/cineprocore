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
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>CinePro Premium Player</title>

                    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
                    <script src="https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.js"></script>

                    <style>
                        body { margin: 0; background: #000; height: 100vh; overflow: hidden; }
                        #player { width: 100%; height: 100%; }
                    </style>
                </head>
                <body>

                    <div id="player"></div>

                    <script>
                        async function load() {
                            try {
                                const res = await fetch("/v1/movies/${movieId}");
                                const data = await res.json();

                                if (!data.sources || data.sources.length === 0) return;

                                const src = data.sources[0].url;

                                new Artplayer({
                                    container: '#player',
                                    url: src,
                                    autoplay: true,
                                    fullscreen: true,
                                    setting: true,
                                    pip: true,
                                    playbackRate: true,
                                    aspectRatio: true,
                                    screenshot: true,
                                    customType: {
                                        m3u8: function (video, url) {
                                            if (Hls.isSupported()) {
                                                const hls = new Hls();
                                                hls.loadSource(url);
                                                hls.attachMedia(video);
                                            } else {
                                                video.src = url;
                                            }
                                        }
                                    }
                                });

                            } catch (e) {
                                console.error(e);
                            }
                        }

                        load();
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
