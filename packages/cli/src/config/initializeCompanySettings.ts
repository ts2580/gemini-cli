/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse, stringify } from 'comment-json';
import { Storage } from '@google/gemini-cli-core';
import { COMPANY_SETTINGS_DEFAULTS } from './companyModelDefaults.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fillMissing(
  target: Record<string, unknown>,
  defaults: Record<string, unknown>,
): void {
  for (const [key, value] of Object.entries(defaults)) {
    if (!Object.hasOwn(target, key)) {
      target[key] = structuredClone(value);
    } else if (isRecord(target[key]) && isRecord(value)) {
      fillMissing(target[key], value);
    }
  }
}

/** Seed once, preserving existing values, comments, and subsequent user edits. */
export function initializeCompanySettings(
  settingsPath = Storage.getGlobalSettingsPath(),
): boolean {
  const directory = path.dirname(settingsPath);
  const marker = path.join(directory, '.company-models-v1.initialized');
  const lock = path.join(directory, '.company-models-v1.lock');
  if (fs.existsSync(marker)) return false;
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  let lockFd: number;
  try {
    lockFd = fs.openSync(lock, 'wx', 0o600);
  } catch (error) {
    if (isRecord(error) && error['code'] === 'EEXIST') return false;
    throw error;
  }
  const temporary = path.join(
    directory,
    `.settings.company.${process.pid}.tmp`,
  );
  try {
    if (fs.existsSync(marker)) return false;
    const original = fs.existsSync(settingsPath)
      ? fs.readFileSync(settingsPath, 'utf8')
      : '';
    const settings: unknown = original.trim() ? parse(original) : {};
    if (!isRecord(settings)) throw new Error('Settings must be a JSON object');
    fillMissing(settings, COMPANY_SETTINGS_DEFAULTS);
    fs.writeFileSync(temporary, stringify(settings, null, 2) + '\n', {
      mode: 0o600,
      flag: 'wx',
    });
    fs.renameSync(temporary, settingsPath);
    fs.writeFileSync(marker, '1\n', { mode: 0o600 });
    return true;
  } finally {
    fs.rmSync(temporary, { force: true });
    fs.closeSync(lockFd);
    fs.rmSync(lock, { force: true });
  }
}

/** Installation must still work when the home directory is not writable. */
export function tryInitializeCompanySettings(): void {
  try {
    initializeCompanySettings();
  } catch {
    process.stderr.write(
      'Company model settings could not be initialized. Check ~/.gemini/settings.json syntax and permissions; initialization will be retried on the next launch.\n',
    );
  }
}
