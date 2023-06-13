import { M3uParser } from '../common';
import { BrowserParser } from '../common/types';

/**A parser for m3u files.
 *
 * It parses the contents of m3u file to a list of streams information which can be saved as a JSON/M3U file.
 * ```
 *  import { M3uParser } from "@pawanpaudel93/m3u-parser"
 
    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.97 Safari/537.36"
    const parser = new M3uParser(userAgent);
    (async () => {
        await parser.parseM3u(file)
        console.log(parser.getStreamsInfo())
    })();
 * ```
 */
export class BrowserM3uParser extends M3uParser implements BrowserParser {
    /**Parses the content of local file/URL.
     *
     * It downloads the file from the given url or use the local file path to get the content and parses line by line to a structured format of streams information.
     * @param {File} file - M3U file
     * @param {boolean} [checkLive=false] - Check if the stream is live
     * @returns {Promise<void>} - Promise that resolves when the file is parsed
     */
    public async parseM3u(file: File, checkLive = true): Promise<void> {
        this.checkLive = checkLive;
        this.lines.length = 0;
        this.content = await new Response(file).text();
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

    /** Save to file (JSON or M3U)
     *
     * It saves streams information as a JSON or M3U file with a given filename and format parameters.
     * @param {string} fileName - Filename.
     * @param {string} [format='json'] - Format of the file to save. Can be 'json' or 'm3u'.
     * @returns {void}
     */
    public saveToFile(fileName: string, format = 'json'): void {
        format =
            fileName.split('.').length > 1 ? fileName.split('.').pop() : format;
        if (!fileName.includes(`.${format}`)) {
            fileName = `${fileName}.${format}`;
        }

        let data = '';
        if (format === 'json') {
            data = JSON.stringify(this.getJSON(), null, 2);
        } else if (format === 'm3u') {
            data = this.getM3U();
        }

        const element = document.createElement('a');
        element.setAttribute(
            'href',
            'data:text/plain;charset=utf-8,' + encodeURIComponent(data)
        );
        element.setAttribute('download', fileName);

        element.style.display = 'none';
        document.body.appendChild(element);

        element.click();

        document.body.removeChild(element);
    }
}
