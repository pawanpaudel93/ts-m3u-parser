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

    protected async axiosGet(url) {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': this.userAgent,
            },
            timeout: this.timeout,
        });
        return response;
    }

    protected async parseLines() {
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

    protected getValue(line: string, type: string) {
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

    protected getM3U() {
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

    protected getShuffledArr = (arr) => {
        const newArr = arr.slice();
        for (let i = newArr.length - 1; i > 0; i--) {
            const rand = Math.floor(Math.random() * (i + 1));
            [newArr[i], newArr[rand]] = [newArr[rand], newArr[i]];
        }
        return newArr;
    };

    public async parseM3u(path: string, checkLive = true) {
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

    public getJSON(indent = 4) {
        return JSON.stringify(this.streamsInfo, null, indent);
    }

    public getStreamsInfo() {
        return this.streamsInfo;
    }

    public resetOperations() {
        this.streamsInfo = Object.assign([], this.streamsInfoBackup);
    }

    public filterBy(
        key: string,
        filters: string[] | boolean[],
        retrieve = true,
        nestedKey = false,
        keySplitter = '-'
    ) {
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
            let check;
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

    public removeByExtension(extensions: string[]) {
        this.filterBy('url', extensions, false);
    }

    public retrieveByCategory(filters: string[] | boolean[]) {
        this.filterBy('category', filters, true);
    }

    public sortBy(
        key: string,
        asc = true,
        nestedKey = false,
        keySplitter = '-'
    ) {
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
            if (nestedKey) {
                if (asc) {
                    return a[key0][key1] > b[key0][key1] ? 1 : -1;
                } else {
                    return a[key0][key1] < b[key0][key1] ? 1 : -1;
                }
            } else {
                if (asc) {
                    return a[key] > b[key] ? 1 : -1;
                } else {
                    return a[key] < b[key] ? 1 : -1;
                }
            }
        });
    }

    public getRandomStream(shuffle = true) {
        if (shuffle) {
            this.streamsInfo = this.getShuffledArr(this.streamsInfo);
        }
        return this.streamsInfo[
            Math.floor(Math.random() * this.streamsInfo.length)
        ];
    }

    public saveToFile(filePath: string, format = 'json') {
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
