/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GoogleGenAI,
  HttpResponse,
  type GoogleGenAIOptions,
} from '@google/genai';

/**
 * Read newline-delimited JSON (NDJSON) from a streaming HTTP response.
 *
 * - Each non-empty line must contain exactly one JSON value.
 * - [DONE] terminates the stream and is not emitted.
 * - A final line without a trailing newline is parsed on EOF.
 * - UTF-8 characters split across network chunks are preserved.
 * - A malformed JSON line is an error, not an incomplete-stream success.
 */
export async function* parseNdjsonStream(
  response: Response,
): AsyncGenerator<HttpResponse> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('NDJSON response body is empty');
  }

  const decoder = new TextDecoder('utf-8', { fatal: true });
  let buffer = '';
  let receivedDone = false;
  let reachedEof = false;

  const toHttpResponse = (rawLine: string): HttpResponse => {
    let payload: unknown;
    try {
      payload = JSON.parse(rawLine);
    } catch (cause) {
      throw new Error('Invalid NDJSON JSON line', { cause });
    }

    if (typeof payload === 'object' && payload !== null && 'error' in payload) {
      // API error objects must not be silently returned as model responses.
      throw new Error(`Streaming API error: ${JSON.stringify(payload.error)}`);
    }

    return new HttpResponse(
      new Response(rawLine, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      }),
    );
  };

  try {
    while (!receivedDone) {
      const { value, done } = await reader.read();
      if (done) {
        reachedEof = true;
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // A network chunk may contain zero, one, or many complete lines.
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (!line) {
          continue;
        }
        if (line === '[DONE]') {
          receivedDone = true;
          buffer = ''; // Discard anything after the explicit end marker.
          break;
        }

        yield toHttpResponse(line);
      }
    }

    if (!receivedDone) {
      // Flush possible trailing UTF-8 decoder state after EOF.
      buffer += decoder.decode();
      const tail = buffer.trim();
      buffer = '';

      if (tail && tail !== '[DONE]') {
        yield toHttpResponse(tail);
      }
    }
  } finally {
    if (!reachedEof) {
      // Also stop delivery on parser errors or when the consumer exits early.
      await reader.cancel().catch(() => undefined);
    }
    reader.releaseLock();
  }
}

/**
 * NDJSON transport adaptation. Ordinary generateContent() continues to use
 * the official SDK unchanged; only streaming response framing is replaced.
 */
export class NdjsonGoogleGenAI extends GoogleGenAI {
  constructor(options: GoogleGenAIOptions) {
    super(options);
    this.apiClient.processStreamResponse = parseNdjsonStream;
  }
}
