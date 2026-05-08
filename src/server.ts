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

                            const art = new Artplayer({
                                container: '#player',
                                url: src,
                                autoplay: true,
                                fullscreen: true,
                                setting: true,
                                pip: true,
                                playbackRate: true,
                                aspectRatio: true,
                                screenshot: true,
                                controls: [
                                    {
                                        name: 'quality',
                                        html: 'HD',
                                        position: 'right'
                                    }
                                ],
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
