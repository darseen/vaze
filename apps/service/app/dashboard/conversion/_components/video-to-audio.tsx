"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatBytes } from "@/utils";
import {
  AudioLines,
  Check,
  Cloud,
  Download,
  FileVideo,
  LoaderCircle,
  Play,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import FileSelector from "./file-selector";

export default function VideoToAudio() {
  const [file, setFile] = useState<{
    name: string;
    size: string;
    source: string;
  } | null>(null);
  const [isFileSelectorOpen, setIsFileSelectorOpen] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isConverting) return;
    const timer = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 100) {
          window.clearInterval(timer);
          setIsConverting(false);
          setIsComplete(true);
          return 100;
        }
        return Math.min(current + 5, 100);
      });
    }, 120);
    return () => window.clearInterval(timer);
  }, [isConverting]);

  function chooseFile(nextFile: {
    name: string;
    size: string;
    source: string;
  }) {
    setFile(nextFile);
    setIsFileSelectorOpen(false);
    setProgress(0);
    setIsComplete(false);
  }

  function handleDeviceFile(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (selected)
      chooseFile({
        name: selected.name,
        size: formatBytes(selected.size),
        source: "Your device",
      });
  }

  function startConversion() {
    if (!file) return;
    setProgress(0);
    setIsComplete(false);
    setIsConverting(true);
  }

  return (
    <>
      <Card>
        <CardContent>
          <div className="rounded-2xl sm:p-4">
            <div className="rounded-xl px-5 py-10 text-center sm:px-10">
              <div className="bg-secondary text-primary mx-auto flex h-14 w-14 items-center justify-center rounded-2xl">
                <FileVideo size={27} />
              </div>
              <h2 className="mt-5 text-[18px] font-semibold">
                Choose a video to get started
              </h2>
              <p className="mt-2 text-sm text-[#818792]">
                MP4, MOV, AVI, MKV etc.
              </p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <Input
                  ref={inputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleDeviceFile}
                />
                <Button
                  onClick={() => inputRef.current?.click()}
                  variant={"secondary"}
                >
                  <Upload size={16} />
                  Choose from device
                </Button>
                <Button onClick={() => setIsFileSelectorOpen(true)}>
                  <Cloud size={17} className="text-secondary" />
                  Choose from Vaze
                </Button>
              </div>
            </div>

            {file && (
              <div className="mt-3 flex flex-col gap-4 rounded-xl border border-[#e5e7eb] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f1efff] text-[#6256c9]">
                    <FileVideo size={19} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {file.name}
                    </p>
                    <p className="mt-1 text-xs text-[#858b95]">
                      {file.size} · {file.source}
                    </p>
                  </div>
                  <button
                    onClick={() => setFile(null)}
                    className="ml-1 rounded p-1 text-[#9297a0] hover:bg-[#f3f4f6] hover:text-[#33373e]"
                    aria-label="Remove selected video"
                  >
                    <X size={16} />
                  </button>
                </div>
                <button
                  onClick={startConversion}
                  disabled={isConverting}
                  className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#7168c9] px-5 text-sm font-semibold text-white transition hover:bg-[#5f56b5] disabled:cursor-wait disabled:opacity-70"
                >
                  {isConverting ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : (
                    <Play size={15} fill="currentColor" />
                  )}
                  {isConverting ? "Converting…" : "Convert to audio"}
                </button>
              </div>
            )}

            {(isConverting || isComplete) && (
              <div className="mt-3 rounded-xl border border-[#e5e7eb] bg-[#fafbfc] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    {isComplete ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#dff5eb] text-[#299466]">
                        <Check size={13} strokeWidth={3} />
                      </span>
                    ) : (
                      <LoaderCircle
                        size={16}
                        className="animate-spin text-[#7168c9]"
                      />
                    )}
                    {isComplete ? "Your audio is ready" : "Extracting audio…"}
                  </div>
                  <span className="text-sm font-semibold text-[#666c75]">
                    {progress}%
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e9ebef]">
                  <div
                    className="h-full rounded-full bg-[#7168c9] transition-all duration-150"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {isComplete && (
                  <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-lg bg-white p-3 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e4f6ef] text-[#299466]">
                        <AudioLines size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">
                          {file?.name.replace(/\.[^/.]+$/, "")}.mp3
                        </p>
                        <p className="text-xs text-[#858b95]">
                          MP3 audio · Ready to download
                        </p>
                      </div>
                    </div>
                    <a
                      href="#download"
                      onClick={(event) => event.preventDefault()}
                      className="flex h-9 items-center gap-2 rounded-lg bg-[#22252b] px-4 text-sm font-semibold text-white transition hover:bg-[#343840]"
                    >
                      <Download size={15} />
                      Download MP3
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <FileSelector
        onOpenChange={setIsFileSelectorOpen}
        open={isFileSelectorOpen}
      />
    </>
  );
}
