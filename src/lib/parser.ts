import * as fs from 'fs';

import axios from 'axios';
import axiosRetry from 'axios-retry';
import * as countries from 'i18n-iso-countries';
import isURL from 'validator/lib/isURL';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ISO6391 = require('iso-639-1');

type StringOrNull = string | null;

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
    sortBy: (
        key: string,
        asc?: boolean,
        nestedKey?: boolean,
        keySplitter?: string
    ) => void;
    parseM3u: (path: string, checkLive?: boolean) => Promise<void>;
    removeByExtension: (extensions: string[]) => void;
    resetOperations: () => void;
    retrieveByCategory: (category: string[] | boolean[]) => void;
    getRandomStream: (shuffle?: boolean) => StreamInfo;
    saveToFile: (file: string, format?: string) => void;
    getStreamsInfo: () => StreamInfo[];
    getJSON: () => string;
}

axiosRetry(axios, { retries: 3 });

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
    private streamsInfo: StreamInfo[] = [];
    private streamsInfoBackup: StreamInfo[] = [];
    private lines: string[] = [];
    private checkLive = true;
    private content = '';
    private timeout: number;
    private userAgent: string;
    private regexes = {
        tvgName: new RegExp('tvg-name="(.*?)"', 'i'),
        tvgID: new RegExp('tvg-id="(.*?)"', 'i'),
        tvgLogo: new RegExp('tvg-logo="(.*?)"', 'i'),
        tvgURL: new RegExp('tvg-url="(.*?)"', 'i'),
        tvgCountry: new RegExp('tvg-country="(.*?)"', 'i'),
        tvgLanguage: new RegExp('tvg-language="(.*?)"', 'i'),
        groupTitle: new RegExp('group-title="(.*?)"', 'i'),
        title: new RegExp('(?!.*=",?.*")[,](.*?)$', 'i'),
    };

    constructor(userAgent: string, timeout = 5) {
        this.userAgent = userAgent;
        this.timeout = timeout * 1000;
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

    protected async parseLine(
        lineNumber: number,
        resolve: () => void
    ): Promise<void> {
        const lineInfo = this.lines[lineNumber];
        let streamLink = '';
        let live = false;

        try {
            for (const i of [1, 2]) {
                if (
                    this.lines[lineNumber + i] &&
                    isURL(this.lines[lineNumber + i])
                ) {
                    streamLink = this.lines[lineNumber + i];
                    break;
                } else {
                    live = true;
                    streamLink = this.lines[lineNumber + i];
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
                        countries.getName(country, 'en', {
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
            let line = '#EXTINF:-1';
            if (stream.tvg) {
                if (stream.tvg.id) line += ` tvg-id="${stream.tvg.id}"`;
                if (stream.tvg.name) line += ` tvg-name="${stream.tvg.name}"`;
                if (stream.tvg.url) line += ` tvg-url="${stream.tvg.url}"`;
            }
            if (stream.logo) {
                line += ` tvg-logo="${stream.logo}"`;
            }
            if (stream.country && stream.country.code) {
                if (stream.country.code)
                    line += ` tvg-country="${stream.country.code}"`;
                if (stream.country.name)
                    line += ` tvg-country="${stream.country.name}"`;
            }
            if (stream.language && stream.language.name) {
                if (stream.language.code)
                    line += ` tvg-language="${stream.language.code}"`;
                if (stream.language.name)
                    line += ` tvg-language="${stream.language.name}"`;
            }
            if (stream.category) {
                line += ` group-title="${stream.category}"`;
            }
            if (stream.name) {
                line += `,${stream.name}`;
            }
            content.push(line);
            content.push(stream.url);
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
     * @param {boolean} [retrieve=false] - True to retrieve and False for removing based on key.
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
                throw new Error(
                    `Invalid nested key: ${key} with keySplitter: ${keySplitter}`
                );
            }
        }
        this.streamsInfo = this.streamsInfo.filter((stream) => {
            let check: unknown;
            if (nestedKey) {
                check = new RegExp(filters.join('|'), 'i').test(
                    stream[key0][key1]
                );
            } else {
                check = new RegExp(filters.join('|'), 'i').test(stream[key]);
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
    public retrieveByExtension(extensions: string[]) {
        this.filterBy('url', extensions, true);
    }

    /**Removes streams information with certain extensions.
     *
     * It removes stream information based on extensions provided.
     * @param {string[]} extensions - List of extensions like mp4, m3u8 etc.
     * @returns {void}
     */
    public removeByExtension(extensions: string[]) {
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
    public sortBy(
        key: string,
        asc = true,
        nestedKey = false,
        keySplitter = '-'
    ): void {
        let [key0, key1] = ['', ''];
        if (nestedKey) {
            [key0, key1] = key.split(keySplitter);
            if (key0 === undefined || key1 === undefined) {
                throw new Error(
                    `Invalid nested key: ${key} with keySplitter: ${keySplitter}`
                );
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
     * @param {boolean} [shuffle=false] - True to shuffle and False for not.
     * @returns {StreamInfo} - Stream information object.
     */
    public getRandomStream(shuffle = true): StreamInfo {
        if (shuffle) {
            this.streamsInfo = this.getShuffledArr(this.streamsInfo);
        }
        return this.streamsInfo[
            Math.floor(Math.random() * this.streamsInfo.length)
        ];
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
