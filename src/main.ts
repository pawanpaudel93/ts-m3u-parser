import { M3uParser } from "./lib/m3uparser";

(async () => {
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36';
    const timeout = 5
    const m3uParser = new M3uParser(userAgent, timeout)
    await m3uParser.parseM3u("https://iptv-org.github.io/iptv/countries/np.m3u")
    console.log(m3uParser.get())
})();