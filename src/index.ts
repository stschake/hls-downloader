import * as fs from "fs-extra";
import * as os from "os";
import { ChunksDownloader } from "./ChunksDownloader";
import { IConfig as IIConfig } from "./Config";
import { mergeChunks as mergeChunksFfmpeg, transmuxTsToMp4 } from "./ffmpeg";
import { mergeFiles as mergeChunksStream } from "./stream";
import { StreamChooser } from "./StreamChooser.js";

export type IConfig = IIConfig;

export async function download(config: IConfig): Promise<void> {
    // Temporary files
    const runId = Date.now();
    const tempDir = config.segmentsDir || os.tmpdir() + "/hls-downloader/" + runId + "/";

    // Create target directory
    fs.mkdirpSync(tempDir);

    // Choose proper stream
    const streamChooser = new StreamChooser(config.streamUrl, config.httpHeaders);
    if (!await streamChooser.load()) {
        return;
    }
    const stream = streamChooser.getPlaylistUrl(config.quality);
    if (!stream) {
        return;
    }

    // Start download
    let lists = [stream.playlist];
    if (stream.externalAudio) {
        lists = lists.concat(stream.externalAudio.map(track => track.uri));
    }
    const dirs = lists.map((pl, index) => tempDir + index);
    dirs.forEach(dir => fs.mkdirpSync(dir));
    const downloaders = lists.map((playlist, i) => new ChunksDownloader(
        playlist,
        config.concurrency || 1,
        config.fromEnd || 1,
        dirs[i],
        config.httpHeaders)
    );
    await Promise.all(downloaders.map(dl => dl.start()));

    // Merge all streams
    const mergeFunction = config.mergeUsingFfmpeg ? mergeChunksFfmpeg : mergeChunksStream;
    let mergedFiles: string[] = [];
    await Promise.all(dirs.map((dir, index) => {
        const segments = fs.readdirSync(dir).map(f => dir + f);
        segments.sort();
        const outputFile = tempDir + index + ".ts";
        mergedFiles = mergedFiles.concat(outputFile);
        return mergeFunction(segments, outputFile);
    }));

    // Transmux
    await transmuxTsToMp4(mergedFiles, config.outputFile);

    // Delete temporary files
    fs.remove(tempDir);
}
