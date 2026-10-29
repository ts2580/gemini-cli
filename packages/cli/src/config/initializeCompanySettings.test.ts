/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { parse } from 'comment-json';
import {
  DEFAULT_MODEL_CONFIGS,
  ModelConfigService,
} from '@google/gemini-cli-core';
import { initializeCompanySettings } from './initializeCompanySettings.js';
import {
  COMPANY_MODELS,
  COMPANY_MODEL_CONFIGS,
  COMPANY_SETTINGS_DEFAULTS,
} from './companyModelDefaults.js';
import { validateSettings } from './settings-validation.js';

let directory: string;
let settingsPath: string;
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(tmpdir(), 'company-settings-test-'));
  settingsPath = path.join(directory, '.gemini', 'settings.json');
});
afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

function writeSettings(text: string) {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, text);
}

describe('company settings initialization', () => {
  it('creates schema-valid defaults with Auto and no credentials', () => {
    expect(initializeCompanySettings(settingsPath)).toBe(true);
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    expect(settings).toEqual(COMPANY_SETTINGS_DEFAULTS);
    expect(validateSettings(settings).success).toBe(true);
    expect(settings.security).toBeUndefined();
    expect(settings.model.name).toBe('auto');
  });

  it('preserves existing values and comments while filling missing settings', () => {
    writeSettings(
      '{\n// My configuration\n"model":{"name":"custom"},"security":{"auth":{"selectedType":"gemini-api-key"}},"experimental":{"dynamicModelConfiguration":false},"modelConfigs":{"customAliases":{"classifier":{"modelConfig":{"model":"my-router"}}}}}',
    );
    initializeCompanySettings(settingsPath);
    const text = fs.readFileSync(settingsPath, 'utf8');
    expect(text).toContain('// My configuration');
    expect(parse(text)).toMatchObject({
      model: { name: 'custom' },
      security: { auth: { selectedType: 'gemini-api-key' } },
      experimental: { dynamicModelConfiguration: false },
      modelConfigs: {
        customAliases: { classifier: { modelConfig: { model: 'my-router' } } },
      },
    });
  });

  it('runs only once and respects edits and removals after initialization', () => {
    initializeCompanySettings(settingsPath);
    writeSettings('{"model":{"name":"my-choice"}}');
    expect(initializeCompanySettings(settingsPath)).toBe(false);
    expect(fs.readFileSync(settingsPath, 'utf8')).toBe(
      '{"model":{"name":"my-choice"}}',
    );
  });

  it.each(['{broken', '[]', 'null'])(
    'does not overwrite invalid settings %s',
    (content) => {
      writeSettings(content);
      expect(() => initializeCompanySettings(settingsPath)).toThrow();
      expect(fs.readFileSync(settingsPath, 'utf8')).toBe(content);
      expect(
        fs.existsSync(
          path.join(
            path.dirname(settingsPath),
            '.company-models-v1.initialized',
          ),
        ),
      ).toBe(false);
      expect(
        fs.existsSync(
          path.join(path.dirname(settingsPath), '.company-models-v1.lock'),
        ),
      ).toBe(false);
    },
  );

  it('defers initialization if another process holds the lock', () => {
    writeSettings('{}');
    fs.writeFileSync(
      path.join(path.dirname(settingsPath), '.company-models-v1.lock'),
      '',
    );
    expect(initializeCompanySettings(settingsPath)).toBe(false);
    expect(fs.readFileSync(settingsPath, 'utf8')).toBe('{}');
  });
});

describe('company Auto routing defaults', () => {
  const service = new ModelConfigService({
    ...DEFAULT_MODEL_CONFIGS,
    ...COMPANY_MODEL_CONFIGS,
  });
  it('shows only Auto and the six company models', () => {
    const options = service.getAvailableModelOptions({
      hasAccessToPreview: true,
      hasAccessToProModel: true,
      useGemini3_1: true,
    });
    expect(options.map((option) => option.modelId).sort()).toEqual(
      ['auto', ...COMPANY_MODELS].sort(),
    );
  });
  it('uses Flash-Lite for classification, Pro for reasoning, and Flash for general work', () => {
    expect(service.getResolvedConfig({ model: 'classifier' }).model).toBe(
      'gemini-3.5-flash-lite',
    );
    expect(
      service.resolveClassifierModelId('pro', 'auto', { useCustomTools: true }),
    ).toBe('gemini-3.1-pro-preview');
    expect(
      service.resolveClassifierModelId('flash', 'auto', {
        useLatestFlash: false,
      }),
    ).toBe('gemini-3.8-flash');
    expect(service.resolveModelId('auto')).toBe('gemini-3.8-flash');
    expect(service.resolveChain('auto')?.map((entry) => entry.model)).toEqual([
      'gemini-3.8-flash',
      'gemini-3.1-pro-preview',
    ]);
  });
  it.each(COMPANY_MODELS)('keeps an explicit %s selection', (model) => {
    expect(
      service.resolveModelId(model, {
        useLatestFlash: true,
        useCustomTools: true,
        hasAccessToPreview: false,
      }),
    ).toBe(model);
  });
});
