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
        version: '1.2.5',
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
            const season = request.query.s;
            const episode = request.query.e;
            
            reply.type('text/html').send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>CinePro ArtPlayer</title>
                    <style>
                        body, html { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; overflow: hidden; }
                        #artplayer { width: 100vw; height: 100vh; }
                        #loader { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 99; background: #000; }
                        .spinner { width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.1); border-top: 3px solid #e50914; border-radius: 50%; animation: spin 0.8s linear infinite; }
                        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                        #status { color: #fff; margin-top: 15px; font-family: sans-serif; font-size: 10px; letter-spacing: 2px; opacity: 0.6; text-transform: uppercase; }
                    </style>
                </head>
                <body>
                    <div id="loader">
                        <div class="spinner"></div>
                        <div id="status">Syncing ArtPlayer Engine...</div>
                    </div>

                    <div id="artplayer"></div>

                    <script src="https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.js"></script>
                    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
                    
                    <script>
                        async function initPlayer() {
                            const status = document.getElementById('status');
                            const loader = document.getElementById('loader');
                            
                            const s = "${season || ''}";
                            const e = "${episode || ''}";
                            const apiPath = (s && e) 
                                ? \`/v1/tv/\${"${movieId}"}/seasons/\${s}/episodes/\${e}\` 
                                : \`/v1/movies/\${"${movieId}"}\`;

                            try {
                                const res = await fetch(apiPath);
                                const data = await res.json();

                                if (!data.sources || data.sources.length === 0) {
                                    status.innerText = "SOURCE NOT FOUND";
                                    return;
                                }

                                const streamUrl = data.sources[0].url;
                                
                                // Subtitle Formatting for ArtPlayer
                                const artSubtitles = (data.subtitles || []).map((sub, index) => ({
                                    html: sub.language || sub.label || \`Subtitle \${index + 1}\`,
                                    url: sub.url,
                                    default: index === 0
                                }));

                                const art = new Artplayer({
                                    container: '#artplayer',
                                    url: streamUrl,
                                    type: streamUrl.includes('m3u8') ? 'm3u8' : 'mp4',
                                    theme: '#e50914',
                                    autoplay: true,
                                    autoSize: true,
                                    fullscreen: true,
                                    fullscreenWeb: true,
                                    pip: true,
                                    setting: true,
                                    loop: false,
                                    flip: true,
                                    playbackRate: true,
                                    aspectRatio: true,
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
                                                window.hls = hls;
                                            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                                                video.src = url;
                                            }
                                        },
                                    },
                                    subtitle: {
                                        url: artSubtitles.length > 0 ? artSubtitles[0].url : '',
                                        type: 'vtt',
                                        style: { color: '#fff', fontSize: '24px' },
                                        escape: false,
                                    },
                                    settings: [
                                        {
                                            html: 'Subtitles',
                                            type: 'selector',
                                            icon: '<img width="22" height="22" src="https://artplayer.org/assets/img/subtitle.svg">',
                                            selector: artSubtitles,
                                            onSelect: function (item) {
                                                art.subtitle.url = item.url;
                                                return item.html;
                                            },
                                        }
                                    ],
                                });

                                art.on('ready', () => {
                                    loader.style.display = 'none';
                                });

                                art.on('error', (err) => {
                                    console.log('Player Error:', err);
                                    status.innerText = "STREAM ERROR";
                                });

                            } catch (err) {
                                status.innerText = "CONNECTION ERROR";
                            }
                        }

                        initPlayer();
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
