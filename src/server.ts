<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.css" />
<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
<script src="https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.js"></script>

<div id="loader">
    <div class="spinner"></div>
    <div id="status-text">PREPARING CINEMATIC EXPERIENCE...</div>
</div>

<div id="player-box" style="width:100vw;height:100vh;"></div>

<script>
async function initPlayer() {
    const loader = document.getElementById('loader');
    const playerBox = document.getElementById('player-box');

    try {
        const res = await fetch("/v1/movies/${movieId}");
        const data = await res.json();

        if (!data.sources || data.sources.length === 0) {
            document.getElementById('status-text').innerText = "CONTENT UNAVAILABLE";
            return;
        }

        const source = data.sources[0].url;

        const art = new Artplayer({
            container: '#player-box',
            url: source,
            autoplay: true,
            fullscreen: true,
            autoSize: true,
            autoMini: true,
            setting: true,
            hotkey: true,
            pip: true,
            mutex: true,
            fullscreenWeb: true,
            theme: '#e50914',
            quality: [
                { html: '1080p', url: source, default: true },
                { html: '720p', url: source },
                { html: '480p', url: source },
                { html: '360p', url: source },
            ],
            subtitle: data.subtitles && data.subtitles.length > 0 ? {
                url: data.subtitles[0].url,
                type: 'vtt',
                encoding: 'utf-8',
            } : null,
            playbackRate: true,
        });

        art.on('ready', () => {
            loader.style.display = 'none';
            playerBox.classList.add('ready');
        });

    } catch (e) {
        console.error(e);
        document.getElementById('status-text').innerText = "CONNECTION FAILED";
    }
}
initPlayer();
</script>
