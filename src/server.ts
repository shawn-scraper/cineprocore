function renderPlayer(res, apiPath, title) {
    try {
        if (res.setHeader) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
        } else if (res.type) {
            res.type('html');
        }

        const safeTitle = String(title).replace(/</g, "&lt;").replace(/>/g, "&gt;");

        res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<title>${safeTitle}</title>

<link rel="preconnect" href="https://cdn.jsdelivr.net" />

<script src="https://cdn.jsdelivr.net/npm/artplayer@5.2.3/dist/artplayer.js"></script>
<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>

<style>
*{
    margin:0;
    padding:0;
    box-sizing:border-box;
}

html,body{
    width:100%;
    height:100%;
    background:#000;
    overflow:hidden;
    font-family:Arial,sans-serif;
}

#artplayer{
    width:100vw;
    height:100vh;
    background:#000;
}

.art-video-player{
    background:#000 !important;
}

.loading{
    position:fixed;
    inset:0;
    display:flex;
    align-items:center;
    justify-content:center;
    background:#000;
    color:#fff;
    z-index:9999;
    font-size:18px;
    letter-spacing:1px;
}

.error{
    position:fixed;
    inset:0;
    display:flex;
    align-items:center;
    justify-content:center;
    flex-direction:column;
    background:#000;
    color:#fff;
    z-index:9999;
    text-align:center;
    padding:20px;
}

.spinner{
    width:60px;
    height:60px;
    border:4px solid rgba(255,255,255,.2);
    border-top-color:#fff;
    border-radius:50%;
    animation:spin 1s linear infinite;
    margin-bottom:15px;
}

@keyframes spin{
    to{
        transform:rotate(360deg);
    }
}

.art-bottom{
    backdrop-filter:blur(10px);
}

.art-control-progress-inner{
    height:4px !important;
}

video{
    object-fit:contain !important;
}
</style>
</head>

<body>

<div class="loading" id="loading">
    <div>
        <div class="spinner"></div>
        Loading Stream...
    </div>
</div>

<div id="artplayer"></div>

<script>
let art = null;
let hls = null;

async function initPlayer() {

    try {

        const response = await fetch(window.location.origin + '${apiPath}', {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('API Error');
        }

        const data = await response.json();

        const source = data.sources?.find(s => s.url);

        if (!source || !source.url) {
            showError('No stream source found');
            return;
        }

        const streamUrl = source.url;

        document.getElementById('loading').style.display = 'none';

        if (art) {
            art.destroy(false);
            art = null;
        }

        art = new Artplayer({

            container: '#artplayer',

            url: streamUrl,

            type: 'm3u8',

            title: '${safeTitle}',

            autoplay: true,

            autoSize: true,

            autoMini: true,

            screenshot: true,

            setting: true,

            playbackRate: true,

            aspectRatio: true,

            fullscreen: true,

            fullscreenWeb: true,

            pip: true,

            mutex: true,

            backdrop: true,

            hotkey: true,

            airplay: true,

            fastForward: true,

            playsInline: true,

            lock: true,

            theme: '#00bfff',

            lang: 'en',

            volume: 1,

            isLive: false,

            miniProgressBar: true,

            autoPlayback: true,

            autoOrientation: true,

            flip: true,

            subtitleOffset: true,

            icons: {},

            settings: [
                {
                    html: 'Quality',
                    width: 200,
                    tooltip: 'Auto'
                }
            ],

            customType: {

                m3u8: function(video, url) {

                    if (hls) {
                        hls.destroy();
                        hls = null;
                    }

                    if (Hls.isSupported()) {

                        hls = new Hls({
                            enableWorker: true,
                            lowLatencyMode: true,
                            backBufferLength: 90
                        });

                        hls.loadSource(url);

                        hls.attachMedia(video);

                        hls.on(Hls.Events.MANIFEST_PARSED, function () {
                            video.play().catch(()=>{});
                        });

                        hls.on(Hls.Events.ERROR, function(event, data) {

                            if (data.fatal) {

                                switch(data.type) {

                                    case Hls.ErrorTypes.NETWORK_ERROR:
                                        hls.startLoad();
                                        break;

                                    case Hls.ErrorTypes.MEDIA_ERROR:
                                        hls.recoverMediaError();
                                        break;

                                    default:
                                        hls.destroy();
                                        break;
                                }
                            }
                        });

                    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {

                        video.src = url;

                        video.addEventListener('loadedmetadata', function () {
                            video.play().catch(()=>{});
                        });
                    }
                }
            }
        });

        art.on('ready', () => {
            console.log('ArtPlayer Ready');
        });

        art.on('error', (err) => {
            console.error('Player Error:', err);
        });

    } catch (err) {

        console.error(err);

        showError('Failed to load stream');
    }
}

function showError(message) {

    document.getElementById('loading').style.display = 'none';

    document.body.innerHTML = \`
        <div class="error">
            <h2>\${message}</h2>
        </div>
    \`;
}

window.addEventListener('beforeunload', () => {

    if (hls) {
        hls.destroy();
        hls = null;
    }

    if (art) {
        art.destroy(false);
        art = null;
    }
});

initPlayer();
</script>

</body>
</html>
        `);

    } catch (error) {

        console.error('Render Error:', error);

        res.status(500).send('Internal Player Error');
    }
}
