import * as fs from 'fs';

import test from 'ava';

import { M3uParser, Parser, StreamInfo } from './parser';

test.beforeEach(async (t) => {
    const userAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36';
    const timeout = 5;
    t.context = new M3uParser(userAgent, timeout);
    await (t.context as Parser).parseM3u(
        'https://iptv-org.github.io/iptv/countries/np.m3u',
        false
    );
});

test('Parse m3u file', async (t) => {
    t.assert((t.context as Parser).getStreamsInfo().length > 0);
});

test('Remove Extension', async (t) => {
    let streams: StreamInfo[] = (t.context as Parser).getStreamsInfo();
    t.assert(streams.length > 0);
    (t.context as Parser).removeByExtension(['.m3u8']);
    streams = (t.context as Parser).getStreamsInfo();
    for (const stream of streams) {
        t.is(stream.url.includes('.m3u8'), false);
    }
});

test('Reset operations', (t) => {
    (t.context as Parser).removeByExtension(['m3u8']);
    t.is((t.context as Parser).getStreamsInfo().length, 0);
    (t.context as Parser).resetOperations();
    t.assert((t.context as Parser).getStreamsInfo().length > 0);
});

test('Save to M3u File', (t) => {
    (t.context as Parser).saveToFile('test.m3u');
    t.is(fs.existsSync('test.m3u'), true);
});

test('Save to JSON File', (t) => {
    (t.context as Parser).saveToFile('test.json');
    t.is(fs.existsSync('test.json'), true);
});

test('Sort name in ascending order', (t) => {
    (t.context as Parser).sortBy('name', '-', true, false);
    const streams: StreamInfo[] = (t.context as Parser).getStreamsInfo();
    t.assert(streams.length > 0);
    // check if sorted
    let prev = streams[0].name;
    for (const stream of streams) {
        t.assert(prev <= stream.name);
        prev = stream.name;
    }
});

test.after.always(() => {
    fs.unlinkSync('test.m3u');
    fs.unlinkSync('test.json');
});
