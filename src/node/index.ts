import * as fs from 'fs';

import isURL from 'validator/lib/isURL';

import { M3uParser } from '../common';
import { NodeParser } from '../common/types';

/**A parser for m3u files.
 *
 * It parses the contents of m3u file to a list of streams information which can be saved as a JSON/M3U file.
 * ```
 *  import { M3uParser } from "@pawanpaudel93/m3u-parser"
 
    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.97 Safari/537.36"
    const parser = new M3uParser(userAgent);
    (async () => {
        await parser.parseM3u("https://iptv-org.github.io/iptv/countries/np.m3u")
        console.log(parser.getStreamsInfo())
    })();
 * ```
 */
export class NodeM3uParser extends M3uParser implements NodeParser {
    /**Parses the content of local file/URL.
     *
     * It downloads the file from the given url or use the local file path to get the content and parses line by line to a structured format of streams information.
     * @param {string} path - Path/URL to the M3U file
     * @param {boolean} [checkLive=false] - Check if the stream is live
     * @returns {Promise<void>} - Promise that resolves when the file is parsed
     */
    public async parseM3u(path: string, checkLive = true): Promise<void> {
        this.checkLive = checkLive;
        this.lines.length = 0;
        if (isURL(path)) {
            try {
                const response = await this.axiosGet(path);
                this.content = response.data;
            } catch (error) {
                throw new Error(error);
            }
        } else {
            try {
                this.content = fs.readFileSync(path, 'utf8');
            } catch (err) {
                throw new Error(err);
            }
        }
        for (const line of this.content.split('\n')) {
            if (line.trim()) {
                this.lines.push(line.trim());
            }
        }

        if (this.lines.length > 0) {
            await this.parseLines();
        } else {
            throw new Error('No content found to parse');
        }
    }

    /**Save to file (JSON or M3U)
     *
     * It saves streams information as a JSON, or M3U file with a given filename and format parameters.
     * @param {string} filePath - Path to save the file.
     * @param {string} [format='json'] - Format of the file to save. Can be 'json' or 'm3u'.
     * @returns {void}
     */
    public saveToFile(filePath: string, format = 'json'): void {
        format =
            filePath.split('.').length > 1 ? filePath.split('.').pop() : format;
        if (!filePath.includes(`.${format}`)) {
            filePath = `${filePath}.${format}`;
        }
        if (format === 'json') {
            fs.writeFileSync(filePath, this.getJSON());
        } else if (format === 'm3u') {
            fs.writeFileSync(filePath, this.getM3U());
        }
    }
}
