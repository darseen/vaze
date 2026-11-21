// Results of the Vaze and Seafile benchmark: medians of five runs per server.
import { repoUrl } from "./shared";

export type Server = "vaze" | "seafile";

export interface Result {
  median: number;
  min: number;
  max: number;
  /** CPU time the server spent on the whole scenario, all cores added up. */
  cpuSeconds: number;
}

export interface Scenario {
  id: string;
  name: string;
  detail: string;
  unit: "MB/s" | "files/s" | "req/s" | "ms";
  better: "higher" | "lower";
  results: Record<Server, Result>;
}

export const benchmarkRun = {
  date: "November 16, 2026",
  runs: 5,
  // the first release with commit de92f62, the build that was measured
  vazeBuild: {
    label: "4.6.0",
    url: `${repoUrl}/tree/v4.6.0`,
  },
  seafileVersion: "14.0.9",
  machine: {
    cpu: "AMD Ryzen 5 8645HS",
    cores: "6 cores, 12 threads",
    memory: "32 GB of RAM",
    storage: "ext4 on an encrypted NVMe SSD",
    system: "Arch Linux with Docker 29.9.3",
  },
};

export const scenarioGroups: { title: string; scenarios: Scenario[] }[] = [
  {
    title: "Large files",
    scenarios: [
      {
        id: "large_upload",
        name: "Upload one 1 GiB file",
        detail: "A single request",
        unit: "MB/s",
        better: "higher",
        results: {
          vaze: { median: 570, min: 545, max: 590, cpuSeconds: 4.38 },
          seafile: { median: 351, min: 349, max: 485, cpuSeconds: 2.88 },
        },
      },
      {
        id: "large_download",
        name: "Download one 1 GiB file",
        detail: "A single request",
        unit: "MB/s",
        better: "higher",
        results: {
          vaze: { median: 1490, min: 1458, max: 1569, cpuSeconds: 1.59 },
          seafile: { median: 508, min: 438, max: 604, cpuSeconds: 1.21 },
        },
      },
      {
        id: "seek",
        name: "Seek inside a 1 GiB file",
        detail:
          "200 random 1 MiB range requests, the way a video player skips ahead. Median time per request",
        unit: "ms",
        better: "lower",
        results: {
          vaze: { median: 2.62, min: 2.3, max: 2.93, cpuSeconds: 1.34 },
          seafile: { median: 5.1, min: 5.01, max: 5.46, cpuSeconds: 3.36 },
        },
      },
    ],
  },
  {
    title: "A photo album: 100 files of 5 MiB",
    scenarios: [
      {
        id: "album_upload",
        name: "Upload the album",
        detail:
          "At each web app's own pace: Vaze sends 3 files at a time, Seafile 1",
        unit: "MB/s",
        better: "higher",
        results: {
          vaze: { median: 382, min: 375, max: 402, cpuSeconds: 2.66 },
          seafile: { median: 200, min: 158, max: 209, cpuSeconds: 3.2 },
        },
      },
      {
        id: "album_download",
        name: "Download every photo",
        detail: "6 at a time, like a browser",
        unit: "MB/s",
        better: "higher",
        results: {
          vaze: { median: 1150, min: 1041, max: 1233, cpuSeconds: 1.11 },
          seafile: { median: 812, min: 766, max: 1305, cpuSeconds: 1.37 },
        },
      },
      {
        id: "album_zip",
        name: "Download the album as one zip",
        detail:
          "500 MiB archive. Seafile compresses its zips, Vaze stores the files as they are",
        unit: "MB/s",
        better: "higher",
        results: {
          vaze: { median: 1359, min: 1291, max: 1371, cpuSeconds: 0.88 },
          seafile: { median: 84.8, min: 83.3, max: 88.5, cpuSeconds: 6.65 },
        },
      },
    ],
  },
  {
    title: "A documents folder: 1,000 files of 1 to 64 KiB",
    scenarios: [
      {
        id: "small_upload",
        name: "Upload the folder, one file per request",
        detail: "Vaze 3 at a time, Seafile 1",
        unit: "files/s",
        better: "higher",
        results: {
          vaze: { median: 417, min: 385, max: 440, cpuSeconds: 2.8 },
          seafile: { median: 67.7, min: 64, max: 101, cpuSeconds: 21.9 },
        },
      },
      {
        id: "batch_upload",
        name: "Upload the folder, 100 files per request",
        detail: "10 requests in a row, the way a script or the SDK can",
        unit: "files/s",
        better: "higher",
        results: {
          vaze: { median: 2648, min: 2482, max: 2700, cpuSeconds: 0.48 },
          seafile: { median: 1143, min: 1106, max: 1193, cpuSeconds: 3.76 },
        },
      },
      {
        id: "small_download",
        name: "Download every file",
        detail: "6 at a time",
        unit: "files/s",
        better: "higher",
        results: {
          vaze: { median: 1079, min: 1045, max: 1168, cpuSeconds: 1.02 },
          seafile: { median: 518, min: 457, max: 532, cpuSeconds: 10.5 },
        },
      },
      {
        id: "small_zip",
        name: "Download the folder as one zip",
        detail: "1,000 entries. Seafile compresses, Vaze stores",
        unit: "files/s",
        better: "higher",
        results: {
          vaze: { median: 13557, min: 12683, max: 14362, cpuSeconds: 0.08 },
          seafile: { median: 4568, min: 4446, max: 4843, cpuSeconds: 0.24 },
        },
      },
      {
        id: "list",
        name: "List the folder",
        detail: "1,000 entries. Median time per listing",
        unit: "ms",
        better: "lower",
        results: {
          vaze: { median: 6.82, min: 6.19, max: 7.01, cpuSeconds: 0.17 },
          seafile: { median: 23.4, min: 22.5, max: 23.8, cpuSeconds: 1.04 },
        },
      },
      {
        id: "busy_browse",
        name: "List the folder during a 1 GiB upload",
        detail: "How long the slowest 5% of listings took while the upload ran",
        unit: "ms",
        better: "lower",
        results: {
          vaze: { median: 11.7, min: 11, max: 12.3, cpuSeconds: 12.8 },
          seafile: { median: 31.1, min: 28.6, max: 34.5, cpuSeconds: 5.45 },
        },
      },
    ],
  },
  {
    title: "Everyday changes, one file at a time",
    scenarios: [
      {
        id: "rename",
        name: "Rename a file",
        detail: "200 files. Median time per rename",
        unit: "ms",
        better: "lower",
        results: {
          vaze: { median: 1.23, min: 1.15, max: 1.25, cpuSeconds: 0.31 },
          seafile: { median: 40.1, min: 36.9, max: 46, cpuSeconds: 9.45 },
        },
      },
      {
        id: "move",
        name: "Move a file to another folder",
        detail: "200 files. Median time per move",
        unit: "ms",
        better: "lower",
        results: {
          vaze: { median: 1.58, min: 1.46, max: 1.69, cpuSeconds: 0.34 },
          seafile: { median: 25.7, min: 25, max: 26.2, cpuSeconds: 7.6 },
        },
      },
      {
        id: "delete",
        name: "Delete a file",
        detail: "200 files, into each server's trash. Median time per delete",
        unit: "ms",
        better: "lower",
        results: {
          vaze: { median: 1.2, min: 1.09, max: 1.25, cpuSeconds: 0.25 },
          seafile: { median: 24.4, min: 24.3, max: 25.4, cpuSeconds: 5.97 },
        },
      },
    ],
  },
  {
    title: "Public links",
    scenarios: [
      {
        id: "public_burst",
        name: "2,000 visitors download a 200 KB public file",
        detail:
          "16 at a time. A Seafile share link redirects to its file server first",
        unit: "req/s",
        better: "higher",
        results: {
          vaze: { median: 1208, min: 1173, max: 1314, cpuSeconds: 2.22 },
          seafile: { median: 334, min: 302, max: 342, cpuSeconds: 40.9 },
        },
      },
    ],
  },
];

export const allScenarios = scenarioGroups.flatMap((group) => group.scenarios);

export function scenario(id: string): Scenario {
  const found = allScenarios.find((entry) => entry.id === id);
  if (!found) throw new Error(`Unknown benchmark scenario "${id}"`);
  return found;
}

/** How many times faster Vaze was than Seafile, whichever way the unit runs. */
export function speedup({ better, results }: Scenario): number {
  return better === "lower"
    ? results.seafile.median / results.vaze.median
    : results.vaze.median / results.seafile.median;
}

/** Memory in MB, without the file cache. Seafile's covers Seafile, MariaDB and Redis. */
export const memoryMB: Record<"fresh" | "peak", Record<Server, number>> = {
  fresh: { vaze: 55.7, seafile: 489 },
  peak: { vaze: 391, seafile: 2390 },
};

/** How long the slowest 5% of public downloads took, in ms. Median across runs. */
export const publicSlowestMs: Record<Server, number> = {
  vaze: 18.8,
  seafile: 66.3,
};
