import * as fs from 'fs';

import axios from 'axios';
import * as countries from 'i18n-iso-countries';
import isURL from 'validator/lib/isURL';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ISO6391 = require('iso-639-1');

type StringOrNull = string | null;

interface StreamInfo {
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

export class M3uParser {
    private streamsInfo: StreamInfo[] = [];
    // private streamsInfoBackup: StreamInfo[] = [];
    private lines: string[] = [];
    private checkLive = true;
    private content = '';
    private timeout: number;
    private userAgent: string;
    private regexes = {
        tvgName: new RegExp('tvg-name="(.*?)"', 'gm'),
        tvgID: new RegExp('tvg-id="(.*?)"', 'gm'),
        tvgLogo: new RegExp('tvg-logo="(.*?)"', 'gm'),
        tvgURL: new RegExp('tvg-url="(.*?)"', 'gm'),
        tvgCountry: new RegExp('tvg-country="(.*?)"', 'gm'),
        tvgLanguage: new RegExp('tvg-language="(.*?)"', 'gm'),
        groupTitle: new RegExp('group-title="(.*?)"', 'gm'),
        title: new RegExp('(?!.*=",?.*")[,](.*?)$', 'gm'),
    };

    constructor(userAgent: string, timeout: number) {
        this.userAgent = userAgent;
        this.timeout = timeout * 1000;
    }

    private async axiosGet(path) {
        const response = await axios.get(path, {
            headers: {
                'User-Agent': this.userAgent,
            },
            timeout: this.timeout,
        });
        return response;
    }

    public async parseM3u(path: string, checkLive = true) {
        this.checkLive = checkLive;
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

    private async parseLines() {
        const numberOfLines = this.lines.length;
        const promises = [];
        for (let i = 0; i < numberOfLines; i++) {
            if (this.lines[i].includes('#EXTINF')) {
                promises.push(
                    new Promise((resolve) => {
                        (async () => {
                            await this.parseLine(i);
                            resolve('done');
                        })();
                    })
                );
            }
        }
        await Promise.all(promises);
    }

    private async parseLine(lineNumber: number) {
        const lineInfo = this.lines[lineNumber];
        let streamLink = '';
        const streamsLink = [];
        let live = false;

        try {
            for (const i of [1, 2]) {
                if (this.lines[lineNumber + i] && isURL(this.lines[lineNumber + i])) {
                    streamsLink.push(this.lines[lineNumber + i]);
                    break;
                } else if (
                    this.lines[lineNumber + i] &&
                    !isURL(this.lines[lineNumber + i])
                ) {
                    console.log(this.lines[lineNumber + i]);
                    live = true;
                    streamsLink.push(this.lines[lineNumber + i]);
                    break;
                }
            }
            streamLink = streamsLink[0];
        } catch (error) {
            //
        }

        if (lineInfo && streamLink) {
            const title = this.regexes.title.exec(lineInfo);
            const logo = this.regexes.tvgLogo.exec(lineInfo);
            const category = this.regexes.groupTitle.exec(lineInfo);
            const tvgID = this.regexes.tvgID.exec(lineInfo);
            const tvgName = this.regexes.tvgName.exec(lineInfo);
            const tvgURL = this.regexes.tvgURL.exec(lineInfo);
            const country = this.regexes.tvgCountry.exec(lineInfo);
            const language = this.regexes.tvgLanguage.exec(lineInfo);

            if (this.checkLive && !live) {
                try {
                    const response = await this.axiosGet(streamLink);
                    if (response.status === 200) {
                        live = true;
                    }
                } catch (err) {
                    //
                }
            }

            const info: StreamInfo = {
                name: title ? title[1] : null,
                logo: logo ? logo[1] : null,
                url: streamLink,
                category: category ? category[1] : null,
                tvg: {
                    id: tvgID ? tvgID[1] : null,
                    name: tvgName ? tvgName[1] : null,
                    url: tvgURL ? tvgURL[1] : null,
                },
                country: {
                    code: country ? country[1] : null,
                    name: country
                        ? countries.getName(country[1], 'en', { select: 'official' })
                        : null,
                },
                language: {
                    code: language ? ISO6391.getCode(language[1]) : null,
                    name: language ? language[1] : null,
                },
            };
            if (this.checkLive) {
                info.live = live;
            }
            this.streamsInfo.push(info);
        }
    }

    public get() {
        return JSON.stringify(this.streamsInfo);
    }
}
