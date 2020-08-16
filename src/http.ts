import * as fs from "fs";
import axios from "axios";
import { Transform } from "stream";

export type HttpHeaders = { [name: string]: string };

export async function get(url: string, headers?: HttpHeaders): Promise<string> {
    const response = await axios.get(url, { responseType: "text", headers });
    return response.data;
}

export async function getBuffer(url: string, headers?: HttpHeaders): Promise<ArrayBuffer> {
    const response = await axios.get(url, { responseType: "arraybuffer", headers });
    return response.data;
}

export async function download(url: string, file: string, headers?: HttpHeaders, decipher?: Transform): Promise<void> {
    const response = await axios(url, { responseType: "stream", headers });
    let stream = response.data;
    if (decipher) {
        stream = stream.pipe(decipher);
    }
    stream = stream.pipe(fs.createWriteStream(file));
    return new Promise((resolve, reject) => {
        stream.on("finish", resolve);
        stream.on("error", reject);
    });
}
