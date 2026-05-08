fastify.get('/play/:id', async (request: any, reply: any) => {
    const movieId = request.params.id;

    reply.type('text/html').send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>CinePro Premium Player</title>

<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
<script src="https://unpkg.com/artplayer/dist/artplayer.js"></script>

<style>
body {
    margin: 0;
    background: black;
    height: 100vh;
    overflow: hidden;
}

#player {
    width: 100%;
    height: 100vh;
}

/* loading overlay */
#loading {
    position: absolute;
    width: 100%;
    height: 100%;
    background: black;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-family: sans-serif;
    z-index: 999;
}
.loader {
    width: 40px;
    height: 40px;
    border: 4px solid #444;
    border-top: 4px solid #fff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}
@keyframes spin {
    100% { transform: rotate(360deg); }
}
</style>
</head>

<body>

<div id="loading">
    <div>
        <div class="loader"></div>
        <p>Loading Player...</p>
    </div>
</div>

<div id="player"></div>

<script>
(async () => {
    try {
        const res = await fetch("/v1/movies/${movieId}");
        const data = await res.json();

        const src = data?.sources?.[0]?.url;

        if (!src) {
            document.getElementById("loading").innerHTML = "No Stream Found";
            return;
        }

        const art = new Artplayer({
            container: '#player',
            url: src,
            autoplay: true,
            fullscreen: true,
            pip: true,
            setting: true,
            playbackRate: true,
            aspectRatio: true,
            screenshot: true,
            mute: false,
            loop: false,
            autoSize: true,
            autoMini: true,
            theme: '#23ade5',

            customType: {
                m3u8: function (video, url) {
                    if (window.Hls && Hls.isSupported()) {
                        const hls = new Hls({
                            maxBufferLength: 30,
                        });

                        hls.loadSource(url);
                        hls.attachMedia(video);

                        hls.on(Hls.Events.MANIFEST_PARSED, function () {
                            video.play();
                        });
                    } else {
                        video.src = url;
                    }
                }
            }
        });

        art.on('ready', () => {
            document.getElementById("loading").style.display = "none";
        });

        art.on('video:loadeddata', () => {
            document.getElementById("loading").style.display = "none";
        });

    } catch (e) {
        console.error(e);
        document.getElementById("loading").innerHTML = "Error Loading Player";
    }
})();
</script>

</body>
</html>
    `);
});
