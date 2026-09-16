'use strict';

const { appendFileSync, mkdirSync } = require('node:fs');
const { dirname, resolve } = require('node:path');

const EVIDENCE_ENV = 'PCAD_G2_CONTEXT_EVIDENCE_JSONL';
const CAPTURE_LABELS = new Set([
  'ai context diagnostics',
  'ai step started',
  'ai step diagnostics',
  'ai context actual usage',
]);

const configuredPath = process.env[EVIDENCE_ENV]?.trim();

if (configuredPath) {
  const evidencePath = resolve(configuredPath);
  mkdirSync(dirname(evidencePath), { recursive: true });

  const originalInfo = console.info.bind(console);
  let sequence = 0;

  console.info = (...args) => {
    const label = typeof args[0] === 'string' ? args[0] : undefined;

    if (label && CAPTURE_LABELS.has(label)) {
      try {
        const payload = args.length === 2 ? args[1] : args.slice(1);
        const record = {
          schemaVersion: 1,
          recordedAt: new Date().toISOString(),
          pid: process.pid,
          sequence: (sequence += 1),
          label,
          payload,
        };
        appendFileSync(evidencePath, `${JSON.stringify(record)}\n`, 'utf8');
      } catch (error) {
        originalInfo('g2 context evidence capture failed', {
          errorClass:
            error instanceof Error
              ? error.name || error.constructor.name
              : typeof error,
        });
      }
    }

    originalInfo(...args);
  };
}
