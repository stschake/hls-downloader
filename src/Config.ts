import { HttpHeaders } from "./http";

export interface IConfig {
    mergeUsingFfmpeg?: boolean;
    concurrency?: number;
    fromEnd?: number;
    quality?: "worst" | "best" | number;
    streamUrl: string;
    segmentsDir?: string;
    outputFile: string;
    httpHeaders?: HttpHeaders;
}
