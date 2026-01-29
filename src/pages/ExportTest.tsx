import React, { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Play, Download, Activity, AlertCircle, CheckCircle } from "lucide-react";

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

const QUALITY_BITRATES: Record<ExportFormat, number> = {
  webm: 2_000_000,
  mp4: 1_500_000, // Lower bitrate for MP4 stability
};

export default function ExportTest() {
  const [selectedFile, setSelectedFile] = useState<TestFile>(TEST_FILES[0]);
  const [format, setFormat] = useState<ExportFormat>("webm");
  const [fps, setFps] = useState<ExportFps>("24");
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{
    requestedFps: number;
    measuredFps: number;
    duration: number;
    frameCount: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  const runExportTest = useCallback(async () => {
    setIsExporting(true);
    setProgress(0);
    setResults(null);
    setError(null);

    const targetFps = parseInt(fps);
    let frameCount = 0;
    const startTime = performance.now();

    try {
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

      const duration = Math.min(video.duration, 10); // Cap at 10s for test
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d")!;

      // Create audio context with silent source
      const audioContext = new AudioContext({ latencyHint: "playback" });
      const silent = audioContext.createConstantSource();
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      silent.connect(silentGain);
      const audioDestination = audioContext.createMediaStreamDestination();
      silentGain.connect(audioDestination);
      silent.start();

      // Create streams
      const videoStream = canvas.captureStream(targetFps);
      const combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioDestination.stream.getAudioTracks(),
      ]);

      // Determine MIME type
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

      // Export loop
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
      const measuredFps = frameCount / (duration);

      // Cleanup
      combinedStream.getTracks().forEach((t) => t.stop());
      videoStream.getTracks().forEach((t) => t.stop());
      await audioContext.close();

      setResults({
        requestedFps: targetFps,
        measuredFps: Math.round(measuredFps * 100) / 100,
        duration: Math.round(duration * 100) / 100,
        frameCount,
      });

      // Auto-download
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `test_export_${targetFps}fps.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsExporting(false);
    }
  }, [selectedFile, format, fps]);

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
                  Exporting... {Math.round(progress)}%
                </p>
              </div>
            )}

            <Button onClick={runExportTest} disabled={isExporting} className="w-full">
              {isExporting ? (
                "Exporting..."
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run Export Test
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
              {!fpsMatch && (
                <p className="mt-4 text-sm text-yellow-600">
                  ⚠️ FPS mismatch detected. Expected ~{results.requestedFps * results.duration} frames, got {results.frameCount}.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
