fastify.get('/play/:id', async (request, reply) => {
    const movieId = request.params.id;

    reply.type('text/html').send(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CinePro Premium</title>

<script src="https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.js"></script>
<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>

<style>
    body, html {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background: #000;
        overflow: hidden;
    }

    #player {
        width: 100vw;
        height: 100vh;
    }

    #loader {
        position: fixed;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 999;
        background: #000;
        color: #fff;
        font-family: Arial;
    }

    .spinner {
        width: 50px;
        height: 50px;
        border: 5px solid #333;
        border-top: 5px solid #e50914;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 15px;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
</style>
</head>

<body>

<div id="loader">
    <div class="spinner"></div>
    Loading CinePro Player...
</div>

<div id="player"></div>

<script>
async function init() {
    const loader = document.getElementById('loader');
    let art;

    try {
        const res = await fetch("/v1/movies/${movieId}");
        const data = await res.json();

        if (!data.sources || !data.sources.length) {
            loader.innerHTML = "NO SOURCE FOUND";
            return;
        }

        const sourceUrl = data.sources[0].url;

        const option = {
            container: '#player',
            url: sourceUrl,
            autoplay: true,
            volume: 0.8,
            playbackRate: true,
            aspectRatio: true,
            fullscreen: true,
            pip: true,
            screenshot: true,
            setting: true,
            hotkey: true,

            // 🔥 Quality support (multi-source thakle use korbe)
            quality: [
                {
                    default: true,
                    name: 'Auto',
                    url: sourceUrl,
                }
            ],

            // 🔥 Subtitle support
            subtitle: {
                url: '',
                type: 'vtt',
                style: {
                    color: '#fff',
                    fontSize: '20px',
                }
            },

            // 🔥 Language / settings menu
            settings: [
                {
                    html: 'Subtitle',
                    tooltip: 'Subtitle',
                    icon: '',
                    selector: [
                        { html: 'Off', value: 'off' }
                    ],
                    onSelect: function (item) {
                        art.subtitle.show = item.value !== 'off';
                        return item.html;
                    }
                }
            ],
        };

        art = new Artplayer(option);

        // HLS support
        if (sourceUrl.includes('.m3u8')) {
            if (Hls.isSupported()) {
                const hls = new Hls();
                hls.loadSource(sourceUrl);
                hls.attachMedia(art.video);
            } else if (art.video.canPlayType('application/vnd.apple.mpegurl')) {
                art.video.src = sourceUrl;
            }
        }

        loader.style.display = "none";

    } catch (err) {
        loader.innerHTML = "SERVER ERROR";
        console.error(err);
    }
}

init();
</script>

</body>
</html>
    `);
});
