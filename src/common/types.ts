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
    sortBy: (
        key: string,
        asc?: boolean,
        nestedKey?: boolean,
        keySplitter?: string
    ) => void;
    removeByExtension: (extensions: string[]) => void;
    retrieveByCategory: (category: string[] | boolean[]) => void;
    getRandomStream: (shuffle?: boolean) => StreamInfo;
    getStreamsInfo: () => StreamInfo[];
    resetOperations: () => void;
    getJSON: () => string;
}

export interface BrowserParser extends Parser {
    parseM3u: (file: File, checkLive?: boolean) => Promise<void>;
    saveToFile: (fileName: string, format?: string) => void;
}

export interface NodeParser extends Parser {
    parseM3u: (path: string, checkLive?: boolean) => Promise<void>;
    saveToFile: (filePath: string, format?: string) => void;
}
