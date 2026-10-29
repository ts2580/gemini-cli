/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleGenAI } from '@google/genai';
import { NdjsonGoogleGenAI, parseNdjsonStream } from './ndjsonGoogleGenAI.js';

function responseFromChunks(chunks: Uint8Array[]): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
    { headers: { 'Content-Type': 'application/x-ndjson' } },
  );
}

async function readAll(chunks: Uint8Array[]): Promise<unknown[]> {
  const values: unknown[] = [];
  for await (const item of parseNdjsonStream(responseFromChunks(chunks))) {
    values.push(await item.json());
  }
  return values;
}

const bytes = (input: string) => new TextEncoder().encode(input);

describe('parseNdjsonStream', () => {
  it('handles CRLF, blank lines, and a split end marker', async () => {
    expect(
      await readAll([
        bytes('\r\n {"text":" a "}\r'),
        bytes('\n[DO'),
        bytes('NE]\r\nignored'),
      ]),
    ).toEqual([{ text: ' a ' }]);
  });

  it('rejects a missing body', async () => {
    await expect(parseNdjsonStream(new Response(null)).next()).rejects.toThrow(
      'NDJSON response body is empty',
    );
  });

  it('rejects invalid UTF-8 including an incomplete character at EOF', async () => {
    await expect(readAll([new Uint8Array([0xff])])).rejects.toThrow();
    await expect(readAll([new Uint8Array([0xed])])).rejects.toThrow();
  });

  it.each(['done', 'error', 'consumer exit'])(
    'cancels and unlocks the reader on %s',
    async (reason) => {
      const cancel = vi.fn();
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            bytes(
              reason === 'done'
                ? '[DONE]\nignored'
                : reason === 'error'
                  ? 'invalid\n'
                  : '{"n":1}\n',
            ),
          );
        },
        cancel,
      });
      const stream = parseNdjsonStream(new Response(body));
      if (reason === 'error') {
        await expect(stream.next()).rejects.toThrow('Invalid NDJSON JSON line');
      } else {
        await stream.next();
        await stream.return(undefined);
      }
      expect(cancel).toHaveBeenCalledOnce();
      expect(body.locked).toBe(false);
    },
  );

  it('propagates a read failure and unlocks the reader', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error('connection lost'));
      },
    });
    await expect(parseNdjsonStream(new Response(body)).next()).rejects.toThrow(
      'connection lost',
    );
    expect(body.locked).toBe(false);
  });
  it('reads multiple lines in one chunk', async () => {
    expect(await readAll([bytes('{"n":1}\n{"n":2}\n')])).toEqual([
      { n: 1 },
      { n: 2 },
    ]);
  });

  it('reassembles one JSON line split across chunks', async () => {
    expect(await readAll([bytes('{"n":'), bytes('1}\n')])).toEqual([{ n: 1 }]);
  });

  it('handles UTF-8 split inside a multibyte character', async () => {
    const input = bytes('{"text":"한글"}\n');
    const index = input.indexOf(0xed) + 1;
    expect(await readAll([input.slice(0, index), input.slice(index)])).toEqual([
      { text: '한글' },
    ]);
  });

  it('stops at [DONE] with newline', async () => {
    expect(await readAll([bytes('{"n":1}\n[DONE]\n')])).toEqual([{ n: 1 }]);
  });

  it('accepts [DONE] without a final newline', async () => {
    expect(await readAll([bytes('{"n":1}\n[DONE]')])).toEqual([{ n: 1 }]);
  });

  it('flushes final JSON when no trailing newline exists', async () => {
    expect(await readAll([bytes('{"n":1}')])).toEqual([{ n: 1 }]);
  });

  it('accepts empty stream and blank trailing lines', async () => {
    expect(await readAll([])).toEqual([]);
    expect(await readAll([bytes('{"n":1}\n\n')])).toEqual([{ n: 1 }]);
  });

  it('rejects malformed final JSON instead of dropping it', async () => {
    await expect(readAll([bytes('{"n":')])).rejects.toThrow(
      'Invalid NDJSON JSON line',
    );
  });

  it('propagates in-band error objects', async () => {
    await expect(
      readAll([bytes('{"error":{"message":"bad"}}\n')]),
    ).rejects.toThrow('Streaming API error');
  });
});

describe('NdjsonGoogleGenAI SDK integration', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const options = {
    apiKey: 'test-key',
    apiVersion: 'v1beta',
    httpOptions: {
      baseUrl: 'https://gateway.example.test',
      headers: { 'X-Project-Id': 'test-project' },
    },
  };
  const payload = {
    candidates: [{ content: { role: 'model', parts: [{ text: 'hello' }] } }],
  };

  it('streams NDJSON through the real SDK and preserves request options', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        responseFromChunks([bytes(JSON.stringify(payload) + '\n[DONE]\n')]),
      );
    vi.stubGlobal('fetch', fetchMock);
    const client = new NdjsonGoogleGenAI(options);
    const stream = await client.models.generateContentStream({
      model: 'custom-model',
      contents: 'hi',
    });
    const texts = [];
    for await (const chunk of stream) texts.push(chunk.text);
    expect(texts).toEqual(['hello']);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      'https://gateway.example.test/v1beta/models/custom-model:streamGenerateContent?alt=sse',
    );
    expect(new Headers(init.headers).get('X-Project-Id')).toBe('test-project');
    expect(new Headers(init.headers).get('x-goog-api-key')).toBe('test-key');
  });

  it('keeps ordinary JSON generation on the SDK path', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(payload));
    vi.stubGlobal('fetch', fetchMock);
    const response = await new NdjsonGoogleGenAI(
      options,
    ).models.generateContent({ model: 'custom-model', contents: 'hi' });
    expect(response.text).toBe('hello');
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'https://gateway.example.test/v1beta/models/custom-model:generateContent',
    );
  });

  it('does not change SSE handling on other SDK instances', async () => {
    new NdjsonGoogleGenAI(options);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('data: ' + JSON.stringify(payload) + '\n\n'),
        ),
    );
    const stream = await new GoogleGenAI(options).models.generateContentStream({
      model: 'custom-model',
      contents: 'hi',
    });
    const texts = [];
    for await (const chunk of stream) texts.push(chunk.text);
    expect(texts).toEqual(['hello']);
  });

  it('preserves SDK HTTP error handling', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json(
          {
            error: {
              code: 403,
              message: 'forbidden',
              status: 'PERMISSION_DENIED',
            },
          },
          { status: 403 },
        ),
      ),
    );
    await expect(
      new NdjsonGoogleGenAI(options).models.generateContentStream({
        model: 'custom-model',
        contents: 'hi',
      }),
    ).rejects.toThrow('forbidden');
  });

  it('preserves function calls and response metadata', async () => {
    const part = {
      functionCall: { name: 'lookup', args: { id: '1' } },
      thoughtSignature: 'test-signature',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        responseFromChunks([
          bytes(
            JSON.stringify({
              candidates: [
                {
                  content: { role: 'model', parts: [part] },
                  finishReason: 'STOP',
                },
              ],
              usageMetadata: { totalTokenCount: 12 },
            }),
          ),
        ]),
      ),
    );
    const stream = await new NdjsonGoogleGenAI(
      options,
    ).models.generateContentStream({ model: 'custom-model', contents: 'hi' });
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].candidates?.[0].content?.parts).toEqual([part]);
    expect(chunks[0].candidates?.[0].finishReason).toBe('STOP');
    expect(chunks[0].usageMetadata?.totalTokenCount).toBe(12);
  });
});
