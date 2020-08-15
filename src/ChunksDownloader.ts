import * as m3u8 from "m3u8-parser";
import PQueue from "p-queue";
import * as path from "path";
import { URL } from "url";
import { download, get, HttpHeaders } from "./http";

export class ChunksDownloader {
    private queue: PQueue;
    private lastSegment?: m3u8.ManifestSegment;

    private resolve?: () => void;
    private reject?: () => void;
    private timeoutHandle?: NodeJS.Timeout;
    private refreshHandle?: NodeJS.Timeout;

    constructor(
        private playlistUrl: string,
        private concurrency: number,
        private fromEnd: number,
        private segmentDirectory: string,
        private timeoutDuration: number = 60,
        private playlistRefreshInterval: number = 5,
        private httpHeaders?: HttpHeaders,
    ) {
        this.queue = new PQueue({
            concurrency: this.concurrency,
        });
    }

    public start(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;

            this.queue.add(() => this.refreshPlayList());
        });
    }

    private async refreshPlayList(): Promise<void> {
        const playlist = await this.loadPlaylist();

        const interval = playlist.targetDuration || this.playlistRefreshInterval;
        const segments = playlist.segments!;
        this.refreshHandle = setTimeout(() => this.refreshPlayList(), interval * 1000);

        let toLoad: m3u8.ManifestSegment[] = [];
        if (!this.lastSegment) {
            toLoad = segments.slice(segments.length - this.fromEnd);
        } else {
            const index = segments.findIndex(segment => segment.uri == this.lastSegment?.uri);
            if (index < 0) {
                console.error("Could not find last segment in playlist");
                toLoad = segments;
            } else if (index === segments.length - 1) {
                console.log("No new segments since last check");
                return;
            } else {
                toLoad = segments.slice(index + 1);
            }
        }

        this.lastSegment = toLoad[toLoad.length - 1];
        for (const segment of toLoad) {
            console.log("Queued:", segment.uri);
            this.queue.add(() => this.downloadSegment(segment));
        }

        // Timeout after X seconds without new segment
        if (this.timeoutHandle) {
            clearTimeout(this.timeoutHandle);
        }
        this.timeoutHandle = setTimeout(() => this.timeout(), this.timeoutDuration * 1000);
    }

    private timeout(): void {
        console.log("No new segment for a while, stopping");
        if (this.refreshHandle) {
            clearTimeout(this.refreshHandle);
        }
        this.resolve!();
    }

    private async loadPlaylist(): Promise<m3u8.Manifest> {
        const response = await get(this.playlistUrl, this.httpHeaders);

        const parser = new m3u8.Parser();
        parser.push(response);
        parser.end();

        return parser.manifest;
    }

    private async downloadSegment(segment: m3u8.ManifestSegment): Promise<void> {
        // Get filename from URL
        const segmentUrl = new URL(segment.uri, this.playlistUrl);
        let filename = segmentUrl.pathname;
        const slash = filename.lastIndexOf("/");
        filename = filename.substr(slash + 1);

        // Download file
        await download(segmentUrl.href, path.join(this.segmentDirectory, filename), this.httpHeaders);
        console.log("Received:", segmentUrl);
    }
}
