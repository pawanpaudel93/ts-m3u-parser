# @pawanpaudel93/m3u-parser

## Description

`@pawanpaudel93/m3u-parser` is a package that provides a parser for M3U files. It allows you to parse the contents of an M3U file and convert it into a list of stream information. The parsed information can be saved as a JSON or M3U file.

## Installation

You can install it using npm:

```sh
npm install @pawanpaudel93/m3u-parser
```

Using `yarn`:

```sh
yarn add @pawanpaudel93/m3u-parser
```

Or using `pnpm`:

```sh
pnpm add @pawanpaudel93/m3u-parser
```

## Usage

Initialize the M3uParser class and parse the M3U file:

For Node,

```ts
import { M3uParser } from '@pawanpaudel93/m3u-parser';

const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.97 Safari/537.36";
const timeout = 5
const parser = new M3uParser({userAgent, timeout});

(async () => {
    await parser.parseM3u("https://iptv-org.github.io/iptv/countries/np.m3u");
    console.log(parser.getStreamsInfo());
})();
```

For Browser,

```ts
import { M3uParser } from '@pawanpaudel93/m3u-parser';

const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.97 Safari/537.36";
const timeout = 5
const parser = new M3uParser({userAgent, timeout});

(async () => {
    await parser.parseM3u(file);
    console.log(parser.getStreamsInfo());
})();
```

Perform various operations on the parsed stream information:

```ts
// Filter by key and filters
parser.filterBy('category', ['news', 'sports'], true);
parser.filterBy('language-name', ['English'], true, true, '-');
parser.filterBy('live', [true], true);

// Sort by key
parser.sortBy('name', true);
parser.sortBy('category', false, false, '-');

// Retrieve stream information with certain extensions
parser.retrieveByExtension(['.ts', '.m3u8']);

// Remove stream information with certain extensions
parser.removeByExtension(['.mkv', '.avi']);

// Retrieve stream information with certain categories
parser.retrieveByCategory(['sports', 'entertainment']);

// Remove stream information with certain categories
parser.removeByCategory(['news']);

// Reset operations
parser.resetOperations();
```

## API

The @pawanpaudel93/m3u-parser package provides the following API:

### M3uParser

The M3uParser class provides the following methods:

- `parseM3u(fileOrPath: string | File, checkLive?: boolean): Promise<void>`: Parses the content of a local file or URL. It downloads the file from the given URL or uses the local file path to get the content or read the file in the browser and parses it line by line to a structured format of stream information. The optional `checkLive` parameter can be used to determine whether to check if the stream is live or not.

- `getJSON(indent?: number): string`: Returns the parsed stream information as a JSON string. The optional `indent` parameter specifies the number of spaces for indentation in the JSON string.

- `getStreamsInfo(): StreamInfo[]`: Returns the parsed stream information as an array of `StreamInfo` objects.

- `resetOperations(): void`: Resets the stream information list to its initial state before various operations.

- `filterBy(key: string, filters: string[] | boolean[], retrieve?: boolean, nestedKey?: boolean, keySplitter?: string): void`: Filters the stream information based on the specified key and filters. If `retrieve` is `true`, it retrieves the stream information that matches the filters. If `retrieve` is `false`, it removes the stream information that matches the filters. The `nestedKey` parameter is used to indicate whether the key is nested or not. The `keySplitter` parameter is used to split nested keys.

- `sortBy(key: string, asc?: boolean, nestedKey?: boolean, keySplitter?: string): void`: Sorts the stream information list by the specified key in ascending or descending order. The `asc` parameter determines whether the sorting is done in ascending (default) or descending order. The `nestedKey` parameter is used to indicate whether the key is nested or not. The `keySplitter` parameter is used to split nested keys.

- `retrieveByExtension(extensions: string[]): void`: Retrieves only the stream information with certain extensions.

- `removeByExtension(extensions: string[]): void`: Removes the stream information with certain extensions.

- `retrieveByCategory(categories: string[] | boolean[]): void`: Retrieves only the stream information with certain categories.

- `removeByCategory(categories: string[] | boolean[]): void`: Removes the stream information with certain categories.

- `getRandomStream(shuffle?: boolean): StreamInfo`: Returns a random stream from the stream information list. If `shuffle` is `true`, the stream information list is shuffled before selecting a random stream.

- `saveToFile(fileNameOrPath: string, format?: string): void`: Saves the parsed stream information to a file. The file parameter specifies the file path or file name, and the `format` parameter determines the format of the file. If `format` is not provided or not supported, the default format is JSON.

### StreamInfo

The `StreamInfo` interface represents a single stream with the following properties:

- `name`: The name of the stream.
- `logo`: The URL or path to the logo image of the stream.
- `url`: The URL or path to the stream.
- `category`: The category of the stream.
- `live` (optional): Indicates whether the stream is live or not.
- `tvg`: An object containing the TV guide information with the following properties:
  - `id`: The ID of the TV guide.
  - `name`: The name of the TV guide.
  - `url`: The URL of the TV guide.
- `country`: An object containing the country information with the following properties:
  - `code`: The ISO 3166-1 alpha-2 country code.
  - `name`: The name of the country.
- `language`: An object containing the language information with the following properties:
  - `code`: The ISO 639-1 language code.
  - `name`: The name of the language.

## Other Implementations

- `Golang`: [go-m3u-parser](https://github.com/pawanpaudel93/go-m3u-parser)
- `Python`: [m3u-parser](https://github.com/pawanpaudel93/m3u-parser)
- `Rust`: [rs-m3u-parser](https://github.com/pawanpaudel93/rs-m3u-parser)

## Author

👤 **Pawan Paudel**

- Github: [@pawanpaudel93](https://github.com/pawanpaudel93)

## 🤝 Contributing

Contributions, issues and feature requests are welcome!<br />Feel free to check [issues page](https://github.com/pawanpaudel93/ts-m3u-parser/issues).

## Show your support

Give a ⭐️ if this project helped you!

Copyright © 2023 [Pawan Paudel](https://github.com/pawanpaudel93).<br />
