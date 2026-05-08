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
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>CinePro Ultra Player</title>
                    <link rel="stylesheet" href="https://cdn.plyr.io/3.7.8/plyr.css" />
                    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
                    <style>
                        body, html { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; overflow: hidden; }
                        .plyr-container { width: 100vw; height: 100vh; opacity: 0; transition: opacity 0.5s ease; }
                        .plyr-container.ready { opacity: 1; }
                        .plyr--video { height: 100vh !important; width: 100vw !important; }
                        .plyr__menu__container [role="menu"] { max-height: 250px; overflow-y: auto; }
                        #loader { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 99; background: #000; }
                        .spinner { width: 50px; height: 50px; border: 4px solid rgba(255,255,255,0.1); border-top: 4px solid #e50914; border-radius: 50%; animation: spin 0.8s linear infinite; }
                        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                        #status { color: #fff; margin-top: 15px; font-family: sans-serif; font-size: 12px; letter-spacing: 2px; opacity: 0.7; }
                        :root { --plyr-color-main: #e50914; }
                    </style>
                </head>
                <body>
                    <div id="loader">
                        <div class="spinner"></div>
                        <div id="status">SYNCING MULTI-AUDIO & QUALITY...</div>
                    </div>

                    <div class="plyr-container" id="player-box">
                        <video id="player" playsinline controls></video>
                    </div>

                    <script src="https://cdn.plyr.io/3.7.8/plyr.polyfilled.js"></script>
                    <script>
                        async function start() {
                            const video = document.getElementById('player');
                            const loader = document.getElementById('loader');
                            const playerBox = document.getElementById('player-box');

                            try {
                                const res = await fetch("/v1/movies/${movieId}");
                                const data = await res.json();
                                if (!data.sources || data.sources.length === 0) return;

                                const source = data.sources[0].url;

                                if (data.subtitles) {
                                    data.subtitles.forEach((s) => {
                                        const track = document.createElement('track');
                                        track.kind = 'captions';
                                        track.label = s.language || 'English';
                                        track.srclang = s.lang || 'en';
                                        track.src = s.url;
                                        video.appendChild(track);
                                    });
                                }

                                const plyrOptions = {
                                    autoplay: true,
                                    controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'captions', 'settings', 'pip', 'fullscreen'],
                                    settings: ['captions', 'quality', 'speed', 'audio'],
                                    speed: { selected: 1, options: [0.5, 1, 1.5, 2] }
                                };

                                if (Hls.isSupported() && source.includes('m3u8')) {
                                    const hls = new Hls();
                                    hls.loadSource(source);
                                    hls.attachMedia(video);
                                    
                                    hls.on(Hls.Events.MANIFEST_PARSED, () => {
                                        // Quality Detect
                                        const qualities = hls.levels.map(l => l.height);
                                        qualities.unshift(0); // Auto

                                        plyrOptions.quality = {
                                            default: 0,
                                            options: qualities,
                                            forced: true,
                                            onChange: (q) => {
                                                if(q === 0) window.hls.currentLevel = -1;
                                                else window.hls.levels.forEach((l, i) => { if(l.height === q) window.hls.currentLevel = i; });
                                            }
                                        };

                                        const player = new Plyr(video, plyrOptions);

                                        // Audio Track Detect
                                        hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
                                            const audioTracks = hls.audioTracks;
                                            if (audioTracks.length > 1) {
                                                // Audio selection logic inside Plyr menu
                                                player.on('ready', () => {
                                                    // HLS handles the actual switching when the browser/Plyr requests tracks
                                                });
                                            }
                                        });

                                        loader.style.display = 'none';
                                        playerBox.classList.add('ready');
                                    });
                                    window.hls = hls;
                                } else {
                                    video.src = source;
                                    new Plyr(video, plyrOptions);
                                    video.onloadedmetadata = () => {
                                        loader.style.display = 'none';
                                        playerBox.classList.add('ready');
                                    };
                                }
                            } catch (e) { console.error(e); }
                        }
                        start();
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
