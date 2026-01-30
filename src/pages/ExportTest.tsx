import React, { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Play, Download, Activity, AlertCircle, CheckCircle, Zap, Clock } from "lucide-react";

type TestFile = {
  name: string;
  url: string;
};

const TEST_FILES: TestFile[] = [
  { name: "TAKE_03.mp4", url: "/test-files/TAKE_03.mp4" },
  { name: "TAKE_03_ITA.mp4", url: "/test-files/TAKE_03_ITA.mp4" },
  { name: "export_sample.webm", url: "/test-files/export_sample.webm" },
];

type ExportFormat = "webm" | "mp4";
type ExportFps = "24" | "30" | "60";
type ExportMode = "realtime" | "offline";

const QUALITY_BITRATES: Record<ExportFormat, number> = {
  webm: 4_000_000, // Higher bitrate for better quality
  mp4: 3_000_000,
};

// Helper: wait for video seek to complete
const waitForSeek = (video: HTMLVideoElement): Promise<void> => {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    video.addEventListener("seeked", onSeeked);
  });
};

export default function ExportTest() {
  const [selectedFile, setSelectedFile] = useState<TestFile>(TEST_FILES[0]);
  const [format, setFormat] = useState<ExportFormat>("webm");
  const [fps, setFps] = useState<ExportFps>("24");
  const [exportMode, setExportMode] = useState<ExportMode>("offline");
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportTime, setExportTime] = useState<number | null>(null);
  const [results, setResults] = useState<{
    requestedFps: number;
    measuredFps: number;
    duration: number;
    frameCount: number;
    mode: ExportMode;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Offline frame-by-frame export - TWO-PASS approach for correct timing
  const runOfflineExport = useCallback(async () => {
    const targetFps = parseInt(fps);
    const startTime = performance.now();

    // Load video
    const video = document.createElement("video");
    video.src = selectedFile.url;
    video.muted = true;
    video.crossOrigin = "anonymous";
    video.playsInline = true;
    video.preload = "auto";

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Failed to load video"));
    });

    await new Promise<void>((resolve) => {
      if (video.readyState >= 3) {
        resolve();
      } else {
        video.oncanplay = () => resolve();
      }
    });

    const duration = Math.min(video.duration, 10);
    const totalFrames = Math.floor(duration * targetFps);
    const frameInterval = 1 / targetFps;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { alpha: false })!;

    // ========== PASS 1: Capture all frames to memory ==========
    setProgress(0);
    const frames: ImageData[] = [];
    video.pause();

    for (let i = 0; i < totalFrames; i++) {
      const targetTime = i * frameInterval;
      video.currentTime = targetTime;
      await waitForSeek(video);
      await new Promise(r => setTimeout(r, 5)); // Small delay for render

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(ctx.getImageData(0, 0, canvas.width, canvas.height));

      // Update progress (0-50% for capture phase)
      if (i % 10 === 0) {
        setProgress((i / totalFrames) * 50);
      }
    }

    setProgress(50);

    // ========== PASS 2: Playback frames at correct FPS while recording ==========
    // Create silent audio track
    const audioContext = new AudioContext({ latencyHint: "playback" });
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 0;
    oscillator.connect(gainNode);
    const audioDestination = audioContext.createMediaStreamDestination();
    gainNode.connect(audioDestination);
    oscillator.start();

    // Determine MIME type
    let mimeType = format === "webm"
      ? "video/webm;codecs=vp8,opus"
      : "video/mp4;codecs=avc1.42E01E,mp4a.40.2";
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = format === "webm" ? "video/webm" : "video/mp4";
    }

    // Use captureStream WITH fps parameter for correct timing
    const videoStream = canvas.captureStream(targetFps);
    const combinedStream = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...audioDestination.stream.getAudioTracks(),
    ]);

    const mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: QUALITY_BITRATES[format],
    });

    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const recordingPromise = new Promise<Blob>((resolve) => {
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, {
          type: format === "mp4" ? "video/mp4" : "video/webm",
        });
        resolve(blob);
      };
    });

    mediaRecorder.start();

    // Playback frames at exactly targetFps using precise timing
    const frameIntervalMs = 1000 / targetFps;
    let frameIndex = 0;
    const playbackStart = performance.now();

    await new Promise<void>((resolve) => {
      const drawNextFrame = () => {
        if (frameIndex >= frames.length) {
          resolve();
          return;
        }

        // Draw frame
        ctx.putImageData(frames[frameIndex], 0, 0);
        frameIndex++;

        // Update progress (50-100% for playback phase)
        setProgress(50 + (frameIndex / frames.length) * 50);

        // Schedule next frame at exact interval
        const elapsed = performance.now() - playbackStart;
        const nextFrameTime = frameIndex * frameIntervalMs;
        const delay = Math.max(0, nextFrameTime - elapsed);
        
        setTimeout(drawNextFrame, delay);
      };

      drawNextFrame();
    });

    // Wait a bit for last frame to be captured
    await new Promise(r => setTimeout(r, 100));

    mediaRecorder.stop();
    const blob = await recordingPromise;

    // Cleanup
    oscillator.stop();
    combinedStream.getTracks().forEach((t) => t.stop());
    videoStream.getTracks().forEach((t) => t.stop());
    await audioContext.close();

    const exportDuration = (performance.now() - startTime) / 1000;
    setExportTime(exportDuration);

    return {
      blob,
      frameCount: frames.length,
      duration,
      targetFps,
      measuredFps: frames.length / duration,
    };
  }, [selectedFile, format, fps]);

  // Real-time export (original method)
  const runRealtimeExport = useCallback(async () => {
    const targetFps = parseInt(fps);
    let frameCount = 0;
    const startTime = performance.now();

    const video = document.createElement("video");
    video.src = selectedFile.url;
    video.muted = true;
    video.crossOrigin = "anonymous";
    video.playsInline = true;
    video.preload = "auto";

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Failed to load video"));
    });

    const duration = Math.min(video.duration, 10);
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;

    const audioContext = new AudioContext({ latencyHint: "playback" });
    const silent = audioContext.createConstantSource();
    const silentGain = audioContext.createGain();
    silentGain.gain.value = 0;
    silent.connect(silentGain);
    const audioDestination = audioContext.createMediaStreamDestination();
    silentGain.connect(audioDestination);
    silent.start();

    const videoStream = canvas.captureStream(targetFps);
    const combinedStream = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...audioDestination.stream.getAudioTracks(),
    ]);

    let mimeType = format === "webm"
      ? "video/webm;codecs=vp8,opus"
      : "video/mp4;codecs=avc1.42E01E,mp4a.40.2";
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = format === "webm" ? "video/webm" : "video/mp4";
    }

    const mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: QUALITY_BITRATES[format],
    });

    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const frameInterval = 1000 / targetFps;
    let loopStart: number | null = null;
    let stopped = false;

    const recordingPromise = new Promise<Blob>((resolve) => {
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, {
          type: format === "mp4" ? "video/mp4" : "video/webm",
        });
        resolve(blob);
      };
    });

    video.currentTime = 0;
    await new Promise<void>((r) => {
      video.onseeked = () => r();
    });

    mediaRecorder.start(1000);
    await video.play();

    const tick = () => {
      if (stopped) return;
      if (loopStart === null) loopStart = performance.now();

      const elapsed = performance.now() - loopStart;
      const prog = Math.min(elapsed / (duration * 1000), 1);
      setProgress(prog * 100);

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frameCount++;

      if (elapsed >= duration * 1000 || video.ended) {
        stopped = true;
        video.pause();
        mediaRecorder.stop();
        return;
      }

      const nextTarget = loopStart + frameCount * frameInterval;
      const delay = Math.max(0, nextTarget - performance.now());
      setTimeout(tick, delay);
    };

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    tick();

    const blob = await recordingPromise;
    const exportDuration = (performance.now() - startTime) / 1000;
    setExportTime(exportDuration);

    combinedStream.getTracks().forEach((t) => t.stop());
    videoStream.getTracks().forEach((t) => t.stop());
    await audioContext.close();

    return {
      blob,
      frameCount,
      duration,
      targetFps,
      measuredFps: frameCount / duration,
    };
  }, [selectedFile, format, fps]);

  const runExportTest = useCallback(async () => {
    setIsExporting(true);
    setProgress(0);
    setResults(null);
    setError(null);
    setExportTime(null);

    try {
      const result = exportMode === "offline" 
        ? await runOfflineExport() 
        : await runRealtimeExport();

      setResults({
        requestedFps: result.targetFps,
        measuredFps: Math.round(result.measuredFps * 100) / 100,
        duration: Math.round(result.duration * 100) / 100,
        frameCount: result.frameCount,
        mode: exportMode,
      });

      // Auto-download
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `test_export_${exportMode}_${result.targetFps}fps.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsExporting(false);
    }
  }, [exportMode, runOfflineExport, runRealtimeExport, format]);

  const fpsMatch = results && Math.abs(results.measuredFps - results.requestedFps) < 2;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Export FPS Diagnostic</h1>
        <p className="text-muted-foreground">
          Test the video export pipeline with your files to measure actual FPS output.
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Test Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Source File</Label>
              <Select
                value={selectedFile.name}
                onValueChange={(v) =>
                  setSelectedFile(TEST_FILES.find((f) => f.name === v) || TEST_FILES[0])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEST_FILES.map((f) => (
                    <SelectItem key={f.name} value={f.name}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Export Mode Toggle */}
            <div className="p-4 bg-muted/30 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {exportMode === "offline" ? (
                    <Clock className="w-4 h-4 text-blue-500" />
                  ) : (
                    <Zap className="w-4 h-4 text-yellow-500" />
                  )}
                  <Label className="font-medium">Export Mode</Label>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${exportMode === "realtime" ? "text-foreground" : "text-muted-foreground"}`}>
                    Real-time
                  </span>
                  <Switch
                    checked={exportMode === "offline"}
                    onCheckedChange={(checked) => setExportMode(checked ? "offline" : "realtime")}
                  />
                  <span className={`text-xs ${exportMode === "offline" ? "text-foreground" : "text-muted-foreground"}`}>
                    Offline
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {exportMode === "offline" 
                  ? "🎯 Frame-by-frame: Più lento ma garantisce FPS esatti e qualità costante. Consigliato."
                  : "⚡ Real-time: Veloce ma può perdere frame su CPU cariche. Qualità variabile."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Format</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="webm">WebM (VP8)</SelectItem>
                    <SelectItem value="mp4">MP4 (H.264)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Target FPS</Label>
                <Select value={fps} onValueChange={(v) => setFps(v as ExportFps)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24">24 fps</SelectItem>
                    <SelectItem value="30">30 fps</SelectItem>
                    <SelectItem value="60">60 fps</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <video
                ref={videoRef}
                src={selectedFile.url}
                controls
                className="w-full rounded-lg border border-border"
              />
            </div>

            {isExporting && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-muted-foreground text-center">
                  {exportMode === "offline" ? "Capturing frames..." : "Exporting..."} {Math.round(progress)}%
                </p>
              </div>
            )}

            <Button onClick={runExportTest} disabled={isExporting} className="w-full">
              {isExporting ? (
                "Exporting..."
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run Export Test ({exportMode === "offline" ? "Offline" : "Real-time"})
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {results && (
          <Card className={fpsMatch ? "border-green-500" : "border-yellow-500"}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {fpsMatch ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                )}
                Export Results
                <span className={`text-xs px-2 py-0.5 rounded ${results.mode === "offline" ? "bg-blue-500/20 text-blue-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                  {results.mode === "offline" ? "Offline" : "Real-time"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Requested FPS</p>
                  <p className="text-lg font-semibold">{results.requestedFps}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Measured FPS</p>
                  <p className={`text-lg font-semibold ${fpsMatch ? "text-green-500" : "text-yellow-500"}`}>
                    {results.measuredFps}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Duration</p>
                  <p className="text-lg font-semibold">{results.duration}s</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Frame Count</p>
                  <p className="text-lg font-semibold">{results.frameCount}</p>
                </div>
              </div>
              {exportTime && (
                <p className="mt-4 text-sm text-muted-foreground">
                  ⏱️ Export completato in {exportTime.toFixed(1)}s 
                  ({(results.duration / exportTime).toFixed(1)}x {exportTime > results.duration ? "più lento" : "velocità"})
                </p>
              )}
              {fpsMatch ? (
                <p className="mt-4 text-sm text-green-600">
                  ✅ FPS match! {results.frameCount} frames per {results.duration}s = {results.measuredFps} fps
                </p>
              ) : (
                <p className="mt-4 text-sm text-yellow-600">
                  ⚠️ FPS mismatch. Expected ~{results.requestedFps * results.duration} frames, got {results.frameCount}.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
