import * as cp from "child_process";
import * as fs from "fs";

async function spawnFfmpeg(argss: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        console.log("Spawning FFMPEG", "ffmpeg", argss.join(" "));

        const ffmpeg = cp.spawn("ffmpeg", argss);
        ffmpeg.on("message", (msg) => console.log("ffmpeg message:", msg));
        ffmpeg.on("error", (msg) => {
            console.error("ffmpeg error:", msg);
            reject(msg);
        });
        ffmpeg.on("close", (status) => {
            if (status !== 0) {
                console.error(`ffmpeg closed with status ${status}`);
                reject(`ffmpeg closed with status ${status}`);
            } else {
                resolve();
            }
        });

        ffmpeg.stdout.on("data", (data) => console.log(`ffmpeg stdout: ${data}`));
        ffmpeg.stderr.on("data", (data) => console.log(`ffmpeg stderr: ${data}`));
    });
}

export async function mergeChunks(segments: string[], outputFile: string): Promise<void> {
    // Temporary files
    const segmentsFile = "ffmpeg-input.txt";

    // Generate a FFMPEG input file
    const inputStr = segments.map((f) => `file '${f}'\n`).join("");
    fs.writeFileSync(segmentsFile, inputStr);

    // Merge chunks
    const mergeArgs = [
        "-y",
        "-loglevel", "warning",
        "-f", "concat",
        "-i", segmentsFile,
        "-c", "copy",
        outputFile,
    ];
    await spawnFfmpeg(mergeArgs);

    // Clear temporary file
    fs.unlinkSync(segmentsFile);
}

export async function transmuxTsToMp4(inputFiles: string[], outputFile: string): Promise<void> {
    const inputParams = inputFiles.flatMap(file => ["-i", file]);
    const params = ["-y", "-loglevel", "warning"].concat(inputParams)
        .concat("-c", "copy", "-bsf:a", "aac_adtstoasc", outputFile);  

    await spawnFfmpeg(params);
}
