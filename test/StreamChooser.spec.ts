import * as http from "../src/http";
import { StreamChooser } from "../src/StreamChooser";

const HTTP_HEADERS = {};
const MASTER_URL = "https://github.com/Spark-NF/hls-downloader"

const M3U8_MASTER = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=270000,AVERAGE-BANDWIDTH=195000,CODECS="avc1.42e01e,mp4a.40.2"
playlist/URL1
#EXT-X-STREAM-INF:BANDWIDTH=720000,AVERAGE-BANDWIDTH=520000,CODECS="avc1.4d401e,mp4a.40.2"
playlist/URL2
#EXT-X-STREAM-INF:BANDWIDTH=2160000,AVERAGE-BANDWIDTH=1560000,CODECS="avc1.640029,mp4a.40.2"
playlist/URL3
#EXT-X-STREAM-INF:BANDWIDTH=5400000,AVERAGE-BANDWIDTH=3600000,CODECS="avc1.640029,mp4a.40.2"
playlist/URL4`;

const M3U8_PLAYLIST = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:1
#EXT-X-MEDIA-SEQUENCE:1101811
#EXTINF:1
segment/segment1
#EXTINF:1
segment/segment2`;

const M3U8_MASTER_AUDIO = `#EXTM3U
#EXT-X-VERSION:4
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-STREAM-INF:BANDWIDTH=7400938,AVERAGE-BANDWIDTH=6190934,RESOLUTION=1920x1080,FRAME-RATE=50.000,CODECS="avc1.64002A,mp4a.40.2",AUDIO="audio_0"
index_9.m3u8
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio_0",CHANNELS="2",NAME="English",LANGUAGE="eng",DEFAULT=YES,AUTOSELECT=YES,URI="index_11_0.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio_0",CHANNELS="2",NAME="French",LANGUAGE="fra",DEFAULT=NO,AUTOSELECT=YES,URI="index_12_0.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio_0",CHANNELS="2",NAME="Italian",LANGUAGE="ita",DEFAULT=NO,AUTOSELECT=NO,URI="index_13_0.m3u8"`;

jest.mock("../src/http", () => ({
    get: jest.fn(),
}));

describe("StreamChooser", () => {
    function setUpGet(src?: string): void {
        (http.get as any).mockResolvedValue(src);
    }

    it("The constructor shouldn't do anything", () => {
        setUpGet();
        new StreamChooser(MASTER_URL);

        expect(http.get).not.toBeCalled();
    });

    it("Throws when not loaded first", async () => {
        const stream = new StreamChooser(MASTER_URL);

        expect(() => stream.isMaster()).toThrow("You need to call 'load' before 'isMaster'");
        expect(() => stream.getPlaylistUrl()).toThrow("You need to call 'load' before 'getPlaylistUrl'");
    });

    it("Load should make an HTTP call to the stream", async () => {
        setUpGet();

        const stream = new StreamChooser(MASTER_URL, HTTP_HEADERS);
        await stream.load();

        expect(http.get).toBeCalledWith(MASTER_URL, HTTP_HEADERS);
    });

    it("Fail on invalid playlists", async () => {
        setUpGet("");
        const stream = new StreamChooser(MASTER_URL);

        expect(await stream.load()).toBe(false);
    });

    it("Return the url directly for playlists", async () => {
        setUpGet(M3U8_PLAYLIST);
        const stream = new StreamChooser(MASTER_URL);

        expect(await stream.load()).toBe(true);
        expect(stream.isMaster()).toBe(false);
        expect(stream.getPlaylistUrl("best").playlist).toBe(MASTER_URL);
    });

    it("Return the best playlist for master", async () => {
        setUpGet(M3U8_MASTER);
        const stream = new StreamChooser(MASTER_URL);

        expect(await stream.load()).toBe(true);
        expect(stream.isMaster()).toBe(true);
        expect(stream.getPlaylistUrl("best").playlist).toBe("https://github.com/Spark-NF/playlist/URL4");
    });

    it("Returns the worst playlist for master", async () => {
        setUpGet(M3U8_MASTER);
        const stream = new StreamChooser(MASTER_URL);

        expect(await stream.load()).toBe(true);
        expect(stream.isMaster()).toBe(true);
        expect(stream.getPlaylistUrl("worst").playlist).toBe("https://github.com/Spark-NF/playlist/URL1");
    });

    it("Returns the best playlist for master under a given bandwidth", async () => {
        setUpGet(M3U8_MASTER);
        const stream = new StreamChooser(MASTER_URL);

        expect(await stream.load()).toBe(true);
        expect(stream.isMaster()).toBe(true);
        expect(stream.getPlaylistUrl(1000000).playlist).toBe("https://github.com/Spark-NF/playlist/URL2");
    });

    it("Fails for master if no quality is provided", async () => {
        console.error = jest.fn();

        setUpGet(M3U8_MASTER);
        const stream = new StreamChooser(MASTER_URL);

        expect(await stream.load()).toBe(true);
        expect(stream.isMaster()).toBe(true);
        expect(stream.getPlaylistUrl()).toBe(undefined);
        expect(console.error).toBeCalledWith("You need to provide a quality with a master playlist");
    });

    it("Returns default or autoselected external audio", async () => {
        setUpGet(M3U8_MASTER_AUDIO);
        const stream = new StreamChooser(MASTER_URL);

        expect(await stream.load()).toBe(true);
        expect(stream.isMaster()).toBe(true);
        const chosen = stream.getPlaylistUrl("best");
        expect(chosen).toBeDefined();
        expect(chosen.externalAudio).toBeDefined();
        expect(chosen.externalAudio.length).toBe(2);
        expect(chosen.externalAudio[0].name).toBe("English");
        expect(chosen.externalAudio[1].name).toBe("French");
        expect(chosen.externalAudio[0].uri).toBe("https://github.com/Spark-NF/index_11_0.m3u8");
    });
});
