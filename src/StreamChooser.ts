import * as m3u8 from "m3u8-parser";
import { URL } from "url";
import { get, HttpHeaders } from "./http";

export interface IStreamAudio {
    name: string;
    uri: string;
    language: string;
}

export interface IStream {
    playlist: string;
    externalAudio?: IStreamAudio[];
}

export class StreamChooser {
    private manifest?: m3u8.Manifest;

    constructor(
        private streamUrl: string,
        private httpHeaders?: HttpHeaders,
    ) {}

    public async load(): Promise<boolean> {
        const streams = await get(this.streamUrl, this.httpHeaders);

        const parser = new m3u8.Parser();
        parser.push(streams);
        parser.end();

        this.manifest = parser.manifest;

        return (this.manifest.segments && this.manifest.segments.length > 0)
            || (this.manifest.playlists && this.manifest.playlists.length > 0)
            || false;
    }

    public isMaster(): boolean {
        if (!this.manifest) {
            throw Error("You need to call 'load' before 'isMaster'");
        }

        return this.manifest.playlists && this.manifest.playlists.length > 0 || false;
    }

    public getPlaylistUrl(maxBandwidth?: "worst" | "best" | number): IStream | undefined {
        if (!this.manifest) {
            throw Error("You need to call 'load' before 'getPlaylistUrl'");
        }

        // If we already provided a playlist URL
        if (this.manifest.segments && this.manifest.segments.length > 0) {
            return { playlist: this.streamUrl };
        }

        // You need a quality parameter with a master playlist
        if (!maxBandwidth) {
            console.error("You need to provide a quality with a master playlist");
            return undefined;
        }

        if (!this.manifest.playlists || this.manifest.playlists.length == 0) {
            console.error("No stream or playlist found in URL:", this.streamUrl);
            return undefined;
        }

        // Find the most relevant playlist
        let compareFn: (prev: m3u8.ManifestPlaylist, current: m3u8.ManifestPlaylist) => m3u8.ManifestPlaylist;
        if (maxBandwidth === "best") {
            compareFn = (prev, current) => (prev.attributes.BANDWIDTH > current.attributes.BANDWIDTH) ? prev : current;
        } else if (maxBandwidth === "worst") {
            compareFn = (prev, current) => (prev.attributes.BANDWIDTH > current.attributes.BANDWIDTH) ? current : prev;
        } else {
            compareFn = (prev, current) => (prev.attributes.BANDWIDTH > current.attributes.BANDWIDTH || current.attributes.BANDWIDTH > maxBandwidth) ? prev : current;
        }
        const relevant = this.manifest.playlists.reduce(compareFn);
        const url = new URL(relevant.uri, this.streamUrl).href;

        // Find any separate audio tracks
        if ("AUDIO" in relevant.attributes) {
            const group = relevant.attributes.AUDIO;
            const tracks = Object.entries(this.manifest.mediaGroups.AUDIO[group])
                .filter((kv) => kv[1].autoselect || kv[1].default)
                .map(([key, value]) => { return { name: key, language: value.language, uri: new URL(value.uri, this.streamUrl).href } as IStreamAudio; });
            return { playlist: url, externalAudio: tracks };
        }

        // No separate tracks
        return { playlist: url };
    }
}
