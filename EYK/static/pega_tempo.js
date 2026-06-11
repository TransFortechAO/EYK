function formatTime(seconds) {

    seconds = Math.floor(seconds);

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    if (h > 0) {
        return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    } else {
        return `${m}:${String(s).padStart(2,'0')}`;
    }
}

const video = document.createElement("video");
video.src = "video.mp4";

video.addEventListener("loadedmetadata", function () {

    const duration = video.duration;

    console.log("Duração:", formatTime(duration));

});

const mainVideo = document.getElementById("mainVideo");

mainVideo.addEventListener("loadedmetadata", function () {

    const duration = formatTime(mainVideo.duration);

    document.getElementById("videoDuration").innerText = duration;

});