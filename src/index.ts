import axios from 'axios';
import axiosRetry from 'axios-retry';
import { getName } from 'i18n-iso-countries';
import ISO6391 from 'iso-639-1';
import isURL from 'validator/lib/isURL';

axiosRetry(axios, { retries: 3 });

export type StringOrNull = string | null;

export type M3uParserOptions = { userAgent?: string; timeout?: number };

export interface StreamInfo {
    name: StringOrNull;
    logo: StringOrNull;
    url: StringOrNull;
    category: StringOrNull;
    live?: boolean;
    tvg: {
        id: StringOrNull;
        name: StringOrNull;
        url: StringOrNull;
    };
    country: {
        code: StringOrNull;
        name: StringOrNull;
    };
    language: {
        code: StringOrNull;
        name: StringOrNull;
    };
}

export interface Parser {
    filterBy: (
        key: string,
        filters: string[] | boolean[],
        retrieve?: boolean,
        nestedKey?: boolean,
        keySplitter?: string
    ) => void;
    sortBy: (key: string, asc?: boolean, nestedKey?: boolean, keySplitter?: string) => void;
    parseM3u: (fileOrPath: string | File, checkLive?: boolean) => Promise<void>;
    saveToFile: (fileNameOrPath: string, format?: string) => Promise<void>;
    removeByExtension: (extensions: string[]) => void;
    retrieveByCategory: (category: string[] | boolean[]) => void;
    getRandomStream: (shuffle?: boolean) => StreamInfo;
    getStreamsInfo: () => StreamInfo[];
    resetOperations: () => void;
    getJSON: () => string;
}

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
export class M3uParser implements Parser {
    protected streamsInfo: StreamInfo[] = [];
    protected streamsInfoBackup: StreamInfo[] = [];
    protected lines: string[] = [];
    protected checkLive = true;
    protected content = '';
    protected timeout: number;
    protected userAgent: string;
    protected isNodeJS: boolean;
    protected regexes = {
        tvgName: new RegExp('tvg-name="(.*?)"', 'i'),
        tvgID: new RegExp('tvg-id="(.*?)"', 'i'),
        tvgLogo: new RegExp('tvg-logo="(.*?)"', 'i'),
        tvgURL: new RegExp('tvg-url="(.*?)"', 'i'),
        tvgCountry: new RegExp('tvg-country="(.*?)"', 'i'),
        tvgLanguage: new RegExp('tvg-language="(.*?)"', 'i'),
        groupTitle: new RegExp('group-title="(.*?)"', 'i'),
        title: new RegExp('([^,]+)$', 'i'),
        streams: new RegExp('acestream://[a-zA-Z0-9]+'),
        file: new RegExp('^[a-zA-Z]:\\((?:.*?\\)*).*.[dw]{3,5}$|^/(?:[^/]*)+/?.[dw]{3,5}$'),
    };

    constructor(options: M3uParserOptions = {}) {
        const defaultUserAgent =
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36';
        const defaultTimeout = 5;

        this.userAgent = options.userAgent || defaultUserAgent;
        this.timeout = (options.timeout || defaultTimeout) * 1000;
        this.isNodeJS = typeof window === 'undefined';
    }

    protected async axiosGet(url: string) {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': this.userAgent,
            },
            timeout: this.timeout,
        });
        return response;
    }

    protected async parseLines(): Promise<void> {
        const numberOfLines = this.lines.length;
        const promises: Promise<void>[] = [];
        for (let i = 0; i < numberOfLines; i++) {
            if (this.lines[i].includes('#EXTINF')) {
                promises.push(
                    new Promise((resolve) => {
                        this.parseLine(i, resolve);
                    })
                );
            }
        }
        await Promise.all(promises);
        this.streamsInfoBackup = Object.assign([], this.streamsInfo);
    }

    protected getValue(line: string, type: string): string | null {
        const match = this.regexes[type].exec(line);
        return match ? match[1] : null;
    }

    protected async parseLine(lineNumber: number, resolve: () => void): Promise<void> {
        const lineInfo = this.lines[lineNumber];
        let streamLink = '';
        let live = false;

        try {
            for (const i of [1, 2]) {
                const line = this.lines[lineNumber + i];
                const isAceStream = this.getValue(line, 'streams');

                if (line && (isAceStream || isURL(line))) {
                    streamLink = line;
                    if (isAceStream) {
                        live = true;
                    }
                    break;
                } else if (line && this.getValue(line, 'file')) {
                    live = true;
                    streamLink = line;
                    break;
                }
            }
        } catch (error) {
            //
        }

        if (lineInfo && streamLink) {
            if (this.checkLive && !live) {
                try {
                    const response = await this.axiosGet(streamLink);
                    live = response.status === 200;
                } catch (err) {
                    //
                }
            }

            const title = this.getValue(lineInfo, 'title');
            const logo = this.getValue(lineInfo, 'tvgLogo');
            const category = this.getValue(lineInfo, 'groupTitle');
            const tvgID = this.getValue(lineInfo, 'tvgID');
            const tvgName = this.getValue(lineInfo, 'tvgName');
            const tvgURL = this.getValue(lineInfo, 'tvgURL');
            const country = this.getValue(lineInfo, 'tvgCountry');
            const language = this.getValue(lineInfo, 'tvgLanguage');

            const info: StreamInfo = {
                name: title,
                logo,
                url: streamLink,
                category,
                tvg: {
                    id: tvgID,
                    name: tvgName,
                    url: tvgURL,
                },
                country: {
                    code: country,
                    name:
                        getName(country, 'en', {
                            select: 'official',
                        }) ?? null,
                },
                language: {
                    code: language ? ISO6391.getCode(language) || null : null,
                    name: language,
                },
            };
            if (this.checkLive) {
                info.live = live;
            }
            this.streamsInfo.push(info);
        }
        resolve();
    }

    protected getM3U(): string {
        const content = ['#EXTM3U'];
        for (const stream of this.streamsInfo) {
            const { name, logo, url, category, tvg, country, language } = stream;
            let line = '#EXTINF:-1';
            if (tvg) {
                if (tvg.id) line += ` tvg-id="${tvg.id}"`;
                if (tvg.name) line += ` tvg-name="${tvg.name}"`;
                if (tvg.url) line += ` tvg-url="${tvg.url}"`;
            }
            if (logo) {
                line += ` tvg-logo="${stream.logo}"`;
            }
            if (country && country.code) {
                line += ` tvg-country="${stream.country.code}"`;
            }
            if (language && language.name) {
                line += ` tvg-language="${stream.language.name}"`;
            }
            if (category) {
                line += ` group-title="${stream.category}"`;
            }
            if (name) {
                line += `,${name}`;
            }
            content.push(line);
            content.push(url);
        }
        return content.join('\n');
    }

    protected getShuffledArr = (arr: StreamInfo[]): StreamInfo[] => {
        const newArr = arr.slice();
        for (let i = newArr.length - 1; i > 0; i--) {
            const rand = Math.floor(Math.random() * (i + 1));
            [newArr[i], newArr[rand]] = [newArr[rand], newArr[i]];
        }
        return newArr;
    };

    /**Parses the content of local file/URL.
     *
     * It downloads the file from the given url or use the local file path to get the content or read the file in the browser and parses line by line to a structured format of streams information.
     * @param {string | File} fileOrPath - Path/URL to the M3U file or file itself in browser.
     * @param {boolean} [checkLive=true] - Check if the stream is live
     * @returns {Promise<void>} - Promise that resolves when the file is parsed
     */
    public async parseM3u(fileOrPath: string | File, checkLive = true): Promise<void> {
        this.checkLive = checkLive;
        this.lines.length = 0;
        try {
            if (typeof fileOrPath === 'string') {
                if (this.isNodeJS) {
                    if (isURL(fileOrPath)) {
                        const response = await this.axiosGet(fileOrPath);
                        this.content = response.data;
                    } else {
                        const fs = await import('fs');
                        this.content = fs.readFileSync(fileOrPath, 'utf8');
                    }
                } else {
                    const response = await this.axiosGet(fileOrPath);
                    this.content = response.data;
                }
            } else {
                this.content = await new Response(fileOrPath).text();
            }
        } catch (error) {
            throw new Error(error);
        }

        this.lines = this.content.split('\n').filter((line) => line.trim());

        if (this.lines.length > 0) {
            await this.parseLines();
        } else {
            throw new Error('No content found to parse');
        }
    }

    /**Save to file (JSON or M3U)
     *
     * It saves streams information as a JSON, or M3U file with a given filename and format parameters.
     * @param {string} fileNameOrPath - Path or file name to save the file.
     * @param {string} [format='json'] - Format of the file to save. Can be 'json' or 'm3u'.
     * @returns {void}
     */
    public async saveToFile(fileNameOrPath: string, format = 'json'): Promise<void> {
        format = fileNameOrPath.split('.').length > 1 ? fileNameOrPath.split('.').pop() : format;
        if (!fileNameOrPath.includes(`.${format}`)) {
            fileNameOrPath = `${fileNameOrPath}.${format}`;
        }
        if (this.isNodeJS) {
            const fs = await import('fs');

            if (format === 'json') {
                fs.writeFileSync(fileNameOrPath, this.getJSON());
            } else if (format === 'm3u') {
                fs.writeFileSync(fileNameOrPath, this.getM3U());
            }
        } else {
            let data = '';
            if (format === 'json') {
                data = this.getJSON(2);
            } else if (format === 'm3u') {
                data = this.getM3U();
            }

            const element = document.createElement('a');
            element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(data));
            element.setAttribute('download', fileNameOrPath);

            element.style.display = 'none';
            document.body.appendChild(element);

            element.click();

            document.body.removeChild(element);
        }
    }

    /**Get the streams information as json
     * @param {number} [indent=4] - Indentation level
     * @returns {string} - JSON string of the parsed M3U file
     */
    public getJSON(indent = 4): string {
        return JSON.stringify(this.streamsInfo, null, indent);
    }

    /**Get the parsed streams information list.
     * @returns {StreamInfo[]} - Array of StreamInfo objects
     */
    public getStreamsInfo(): StreamInfo[] {
        return this.streamsInfo;
    }

    /**Reset the stream information list to initial state before various operations.
     * @returns {void}
     */
    public resetOperations(): void {
        this.streamsInfo = Object.assign([], this.streamsInfoBackup);
    }

    /**Filter streams information.
     *
     * It retrieves/removes stream information from streams information list using filters on key.
     * If key is not found, it will not raise error and filtering is done silently.
     * @param {string} key - Key can be single or nested. eg. key='name', key='language-name'
     * @param {string[]| boolean[]} filters - List of filters to perform the retrieve or remove operation.
     * @param {boolean} [retrieve=true] - True to retrieve and False for removing based on key.
     * @param {boolean} [nestedKey=false] - True/False for if the key is nested or not.
     * @param {string} [keySplitter='-'] - A splitter to split the nested keys. Default: "-"
     * @returns {void}
     */
    public filterBy(
        key: string,
        filters: string[] | boolean[],
        retrieve = true,
        nestedKey = false,
        keySplitter = '-'
    ): void {
        if (filters.length === 0) return;
        let [key0, key1] = ['', ''];
        if (nestedKey) {
            [key0, key1] = key.split(keySplitter);
            if (key0 === undefined || key1 === undefined) {
                throw new Error(`Invalid nested key: ${key} with keySplitter: ${keySplitter}`);
            }
        }
        const filtersRegex = new RegExp(filters.join('|'), 'i');
        this.streamsInfo = this.streamsInfo.filter((stream) => {
            let check: unknown;
            if (nestedKey) {
                check = filtersRegex.test(stream[key0][key1]);
            } else {
                check = filtersRegex.test(stream[key]);
            }
            if (retrieve) return check;
            return !check;
        });
    }

    /**Retrieve only streams information with certain extensions.
     *
     * It retrieves the stream information based on extensions provided.
     * @param {string[]} extensions - List of extensions like mp4, m3u8 etc.
     * @returns {void}
     */
    public retrieveByExtension(extensions: string[]): void {
        this.filterBy('url', extensions, true);
    }

    /**Removes streams information with certain extensions.
     *
     * It removes stream information based on extensions provided.
     * @param {string[]} extensions - List of extensions like mp4, m3u8 etc.
     * @returns {void}
     */
    public removeByExtension(extensions: string[]): void {
        this.filterBy('url', extensions, false);
    }

    /**Retrieve only streams information with certain categories.
     *
     * It retrieves stream information based on categories provided.
     * @param {string[]|boolean[]} categories - List of categories to perform the retrieve or remove operation.
     */
    public retrieveByCategory(categories: string[] | boolean[]) {
        this.filterBy('category', categories, true);
    }

    /**Removes streams information with certain categories.
     *
     * It removes stream information based on categories provided..
     * @param {string[]|boolean[]} categories - List of categories to perform the retrieve or remove operation.
     */
    public removeByCategory(categories: string[] | boolean[]) {
        this.filterBy('category', categories, true);
    }

    /**Sort streams information.
     *
     * It sorts streams information list sorting by key in asc/desc order.
     * @param {string} key - Key to sort by. It can be single or nested key.
     * @param {boolean} [asc=true] - True for ascending and False for descending.
     * @param {boolean} [nestedKey=false] - True/False for if the key is nested or not.
     * @param {string} [keySplitter='-'] - A splitter to split the nested keys. Default: "-"
     * @returns {void}
     */
    public sortBy(key: string, asc = true, nestedKey = false, keySplitter = '-'): void {
        let [key0, key1] = ['', ''];
        if (nestedKey) {
            [key0, key1] = key.split(keySplitter);
            if (key0 === undefined || key1 === undefined) {
                throw new Error(`Invalid nested key: ${key} with keySplitter: ${keySplitter}`);
            }
        }
        this.streamsInfo.sort((a, b) => {
            let aValue: StringOrNull, bValue: StringOrNull;
            if (nestedKey) {
                aValue = a[key0][key1];
                bValue = b[key0][key1];
            } else {
                aValue = a[key];
                bValue = b[key];
            }

            if (aValue === null && bValue === null) {
                return 0;
            } else if (aValue === null) {
                return asc ? -1 : 1;
            } else if (bValue === null) {
                return asc ? 1 : -1;
            }

            if (asc) {
                return aValue.localeCompare(bValue);
            } else {
                return bValue.localeCompare(aValue);
            }
        });
    }

    /**Return a random stream information
     *
     * It returns a random stream information with shuffle if required.
     * @param {boolean} [shuffle=true] - True to shuffle and False for not.
     * @returns {StreamInfo} - Stream information object.
     */
    public getRandomStream(shuffle = true): StreamInfo {
        if (shuffle) {
            this.streamsInfo = this.getShuffledArr(this.streamsInfo);
        }
        return this.streamsInfo[Math.floor(Math.random() * this.streamsInfo.length)];
    }
}
