/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DEFAULT_MODEL_CONFIGS,
  type ModelConfigServiceConfig,
} from '@google/gemini-cli-core';

export const COMPANY_MODELS = [
  'gemini-3-flash-preview',
  'gemini-3.1-pro-preview',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
] as const;

const pro = 'gemini-3.1-pro-preview';
const flash = 'gemini-3.8-flash';
const router = 'gemini-3.5-flash-lite';
const resolution = (model: string) => ({ default: model, contexts: [] });
const policy = (model: string) => ({
  model,
  actions: {
    terminal: 'prompt',
    transient: 'prompt',
    not_found: 'prompt',
    unknown: 'prompt',
  } as const,
  stateTransitions: {
    terminal: 'terminal',
    transient: 'terminal',
    not_found: 'terminal',
    unknown: 'terminal',
  } as const,
});

export const COMPANY_MODEL_CONFIGS: ModelConfigServiceConfig = {
  customAliases: {
    classifier: {
      extends: 'base',
      modelConfig: {
        model: router,
        generateContentConfig: { maxOutputTokens: 1024 },
      },
    },
  },
  modelDefinitions: {
    ...Object.fromEntries(
      Object.entries(DEFAULT_MODEL_CONFIGS.modelDefinitions ?? {}).map(
        ([id, definition]) => [id, { ...definition, isVisible: false }],
      ),
    ),
    ...Object.fromEntries(
      COMPANY_MODELS.map((id) => [
        id,
        {
          ...DEFAULT_MODEL_CONFIGS.modelDefinitions?.[id],
          displayName: id,
          tier: id === pro ? 'pro' : id === router ? 'flash-lite' : 'flash',
          family: 'gemini-3',
          // Availability comes from the company gateway, not Google preview access.
          isPreview: false,
          isVisible: true,
        },
      ]),
    ),
    auto: {
      displayName: 'Auto (Company)',
      tier: 'auto',
      family: 'gemini-3',
      isPreview: false,
      isVisible: true,
      dialogDescription: `Router: ${router}; reasoning: ${pro}; general: ${flash}`,
    },
  },
  modelIdResolutions: {
    ...Object.fromEntries(COMPANY_MODELS.map((id) => [id, resolution(id)])),
    auto: resolution(flash),
    pro: resolution(pro),
    flash: resolution(flash),
    'flash-lite': resolution(router),
    'auto-gemini-3': resolution(flash),
    'auto-gemini-2.5': resolution(flash),
    'gemini-3.1-pro-preview-customtools': resolution(pro),
    'gemini-3-pro-preview': resolution(pro),
    'gemini-3-flash': resolution(flash),
    'gemini-3.1-flash-lite': resolution(router),
    'gemini-2.5-pro': resolution(pro),
    'gemini-2.5-flash': resolution(flash),
    'gemini-2.5-flash-lite': resolution(router),
  },
  classifierIdResolutions: { pro: resolution(pro), flash: resolution(flash) },
  modelChains: {
    auto: [policy(flash), policy(pro)],
    'auto-preview': [policy(flash), policy(pro)],
    'auto-default': [policy(flash), policy(pro)],
    preview: [policy(pro), policy(flash)],
    default: [policy(flash), policy(pro)],
    lite: [policy(router)],
  },
};

export const COMPANY_SETTINGS_DEFAULTS = {
  model: { name: 'auto' },
  experimental: { dynamicModelConfiguration: true },
  modelConfigs: COMPANY_MODEL_CONFIGS,
};
