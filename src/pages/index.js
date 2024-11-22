import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import React, { useState, useEffect, useRef } from "react";
import ReactSlider from "react-slider";

export default function Home() {
    const [loaded, setLoaded] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [duration, setDuration] = useState(0);
    const [clipRange, setClipRange] = useState([0, 5]);
    const ffmpegRef = useRef(null);
    const videoRef = useRef(null);
    const outputVideoRef = useRef(null);
    const [videoFile, setVideoFile] = useState(null);

    useEffect(() => {
        const loadFFmpeg = async () => {
            const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
            const ffmpeg = new FFmpeg();
            ffmpeg.on("log", ({ message }) => console.log(message));
            await ffmpeg.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
            });
            ffmpegRef.current = ffmpeg;
            setLoaded(true);
        };

        loadFFmpeg();
    }, []);

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            setVideoFile(file);
            const url = URL.createObjectURL(file);
            videoRef.current.src = url;

            videoRef.current.onloadedmetadata = () => {
                setDuration(videoRef.current.duration);
                setClipRange([0, Math.min(5, videoRef.current.duration)]);
            };
        }
    };

    const transcodeClip = async () => {
        if (!videoFile) return;

        setExporting(true);

        const ffmpeg = ffmpegRef.current;
        const [start, end] = clipRange;

        // Carregar o arquivo no FS do FFmpeg
        const fileData = await fetchFile(videoFile);
        await ffmpeg.writeFile("input.mp4", fileData);

        // Cortar o vídeo com FFmpeg
        const command = [
            "-i",
            "input.mp4",
            "-ss",
            `${start}`,
            "-to",
            `${end}`,
            "-c",
            "copy",
            "output.mp4",
        ];

        await ffmpeg.exec(command);

        // Ler o arquivo resultante
        const data = await ffmpeg.readFile("output.mp4");
        outputVideoRef.current.src = URL.createObjectURL(new Blob([data.buffer], { type: "video/mp4" }));

        setExporting(false);
    };

    return (
        <div className="flex flex-col items-center p-4 space-y-4">
            {!loaded ? (
                <p>Loading FFmpeg... (~31 MB)</p>
            ) : (
                <>
                    <label
                        htmlFor="file-input"
                        className="px-4 py-2 bg-blue-500 text-white rounded shadow cursor-pointer hover:bg-blue-600"
                    >
                        Select Video
                    </label>
                    <input
                        id="file-input"
                        type="file"
                        accept="video/*"
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                    <video
                        ref={videoRef}
                        controls
                        className="w-full max-w-lg rounded shadow"
                        style={{ display: videoFile ? "block" : "none" }}
                    ></video>
                    {videoFile && (
                        <>
                            <div className="w-full max-w-lg space-y-2">
                                <label className="block text-center text-sm">Select Clip Range</label>
                                <ReactSlider
                                    className="w-full h-2 bg-gray-200 rounded"
                                    thumbClassName="w-4 h-4 bg-blue-500 rounded-full cursor-pointer"
                                    trackClassName="bg-blue-300"
                                    min={0}
                                    max={duration}
                                    step={0.1}
                                    value={clipRange}
                                    onChange={(value) => setClipRange(value)}
                                />
                                <div className="flex justify-between text-sm text-gray-600">
                                    <span>{clipRange[0].toFixed(1)}s</span>
                                    <span>{clipRange[1].toFixed(1)}s</span>
                                </div>
                            </div>
                            <button
                                onClick={transcodeClip}
                                disabled={exporting}
                                className={`px-4 py-2 rounded shadow ${
                                    exporting
                                        ? "bg-gray-400 cursor-not-allowed"
                                        : "bg-blue-500 text-white hover:bg-blue-600"
                                }`}
                            >
                                {exporting ? "Exporting..." : "Export Clip"}
                            </button>
                            {exporting && <p className="text-sm text-gray-600">Processing video, please wait...</p>}
                            <video ref={outputVideoRef} controls className="w-full max-w-lg rounded shadow"></video>
                        </>
                    )}
                </>
            )}
        </div>
    );
}
