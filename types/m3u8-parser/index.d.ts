declare module "m3u8-parser" {
    interface Key {
        method: string;
        uri: string;
        iv: Uint32Array;
    }

    interface ManifestSegment {
        uri: string;
        key?: Key;
    }

    interface ManifestPlaylist {
        attributes: { [key: string]: string | number };
        uri: string;
        timeline: number;
    }

    interface MediaGroup {
        default: boolean;
        autoselect: boolean;
        language: string;
        uri: string;
    }

    interface MediaGroups {
        AUDIO: { [id: string]: { [name: string]: MediaGroup } };
    }

    interface Manifest {
        targetDuration?: number;
        segments?: ManifestSegment[];
        playlists?: ManifestPlaylist[];
        endList: boolean;

        mediaGroups: MediaGroups;
    }

    export class Parser {
        push(str: string): void;
        end(): void;
        manifest: Manifest;
    }
}