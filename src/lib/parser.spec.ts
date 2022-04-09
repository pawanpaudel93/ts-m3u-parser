import * as fs from 'fs';

import test from 'ava';

import { M3uParser, Parser, StreamInfo } from './parser';

test.beforeEach(async (t) => {
    const userAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36';
    t.context = new M3uParser(userAgent);
    await (t.context as Parser).parseM3u(
        'https://iptv-org.github.io/iptv/countries/np.m3u',
        false
    );
});

test('Parse a local m3u file', async (t) => {
    await (t.context as Parser).parseM3u('np.m3u');
    t.assert((t.context as Parser).getStreamsInfo().length > 0);
});

test('Error on parsing invalid path', async (t) => {
    await t.throwsAsync(async () => {
        await (t.context as Parser).parseM3u('invalid.m3u');
    });
});

test('Error on parsing invalid url', async (t) => {
    await t.throwsAsync(async () => {
        await (t.context as Parser).parseM3u('https://invalid.com/invalid.m3u');
    });
});

test('Error on parsing url/file with no content', async (t) => {
    fs.writeFileSync('empty.m3u', '');
    await t.throwsAsync(async () => {
        await (t.context as Parser).parseM3u('empty.m3u');
    });
});

test('Remove streams by Extension', async (t) => {
    let streams: StreamInfo[] = (t.context as Parser).getStreamsInfo();
    t.assert(streams.length > 0);
    (t.context as Parser).removeByExtension(['.m3u8']);
    streams = (t.context as Parser).getStreamsInfo();
    for (const stream of streams) {
        t.is(stream.url.includes('.m3u8'), false);
    }
});

test('Retrieve streams by category', async (t) => {
    let streams: StreamInfo[] = (t.context as Parser).getStreamsInfo();
    t.assert(streams.length > 0);
    (t.context as Parser).retrieveByCategory(['sports']);
    streams = (t.context as Parser).getStreamsInfo();
    t.assert(streams.length > 0);
});

test('Reset operations', (t) => {
    (t.context as Parser).removeByExtension(['m3u8']);
    t.is((t.context as Parser).getStreamsInfo().length, 0);
    (t.context as Parser).resetOperations();
    t.assert((t.context as Parser).getStreamsInfo().length > 0);
});

test('Save to M3u File', async (t) => {
    await (t.context as Parser).parseM3u('np.m3u');
    (t.context as Parser).saveToFile('test.m3u');
    t.is(fs.existsSync('test.m3u'), true);
});

test('Save to JSON File', (t) => {
    (t.context as Parser).saveToFile('test');
    t.is(fs.existsSync('test.json'), true);
});

// Filtering
test('Filter failed on invalid keySplitter passed', async (t) => {
    await t.throwsAsync(
        async () =>
            await (t.context as Parser).filterBy(
                'tvg-name',
                ['news'],
                true,
                true,
                '+'
            )
    );
    await t.throwsAsync(
        async () =>
            await (t.context as Parser).filterBy(
                'tvg-name',
                ['news'],
                false,
                true,
                '+'
            )
    );
});

test('Filter failed on no filters passed', async (t) => {
    const beforeStreams = (t.context as Parser).getStreamsInfo();
    await (t.context as Parser).filterBy('name', []);
    const afterStreams = (t.context as Parser).getStreamsInfo();
    t.deepEqual(beforeStreams, afterStreams);
});

test('Filter by nestedKey: tvg-id', async (t) => {
    await (t.context as Parser).filterBy('tvg-id', ['bbc'], true, true);
    t.assert((t.context as Parser).getStreamsInfo().length > 0);
});

// Sorting
test('Sort failed on invalid keySplitter passed', async (t) => {
    await t.throwsAsync(
        async () =>
            await (t.context as Parser).sortBy('tvg-name', true, true, '+')
    );
    await t.throwsAsync(
        async () =>
            await (t.context as Parser).sortBy('tvg-name', false, true, '+')
    );
});

test('Sort single key: name in ascending order', (t) => {
    (t.context as Parser).sortBy('name');
    const streams: StreamInfo[] = (t.context as Parser).getStreamsInfo();
    t.assert(streams.length > 0);
    // check if sorted
    let prev = streams[0].name;
    for (const stream of streams) {
        t.assert(prev <= stream.name);
        prev = stream.name;
    }
});

test('Sort single key: name in descending order', (t) => {
    (t.context as Parser).sortBy('name', false);
    const streams: StreamInfo[] = (t.context as Parser).getStreamsInfo();
    t.assert(streams.length > 0);
    // check if sorted
    let prev = streams[0].name;
    for (const stream of streams) {
        t.assert(prev >= stream.name);
        prev = stream.name;
    }
});

test('Sort nestedKey: tvg-name in ascending order', (t) => {
    (t.context as Parser).sortBy('tvg-id', true, true);
    const streams: StreamInfo[] = (t.context as Parser).getStreamsInfo();
    t.assert(streams.length > 0);
    // check if sorted
    let prev = streams[0].tvg.name;
    for (const stream of streams) {
        t.assert(prev <= stream.tvg.name);
        prev = stream.tvg.name;
    }
});

test('Sort nestedKey: tvg-name in descending order', (t) => {
    (t.context as Parser).sortBy('tvg-id', false, true);
    const streams: StreamInfo[] = (t.context as Parser).getStreamsInfo();
    t.assert(streams.length > 0);
    // check if sorted
    let prev = streams[0].tvg.name;
    for (const stream of streams) {
        t.assert(prev >= stream.tvg.name);
        prev = stream.tvg.name;
    }
});

test('Get a random stream', async (t) => {
    const stream = (t.context as Parser).getRandomStream();
    t.assert(stream.url.length > 0);
});

test.after.always(() => {
    fs.unlinkSync('empty.m3u');
    fs.unlinkSync('test.m3u');
    fs.unlinkSync('test.json');
});
