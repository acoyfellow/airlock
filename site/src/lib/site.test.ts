import { describe, expect, test } from 'bun:test';
import { boundaries, fanoutBackends, pipeline, ports, quickStart, site } from './site';

const bannedFragments = [
  "In today's rapidly evolving landscape",
  'game-changer',
  'paradigm shift',
  'seamless',
  'robust',
  'revolutionary',
  'the key insight',
  'it turns out',
  'real power',
  'just the beginning',
  '→',
] as const;

describe('site content', () => {
  test('Given the pipeline steps When rendered Then they mirror runPipeline order', () => {
    expect(pipeline).toHaveLength(4);
    expect(pipeline.map((step) => step.call)).toEqual([
      'deploy(candidate)',
      'runFanout(jobs, slot)',
      'verifySignedProof(proof, candidate, trusted)',
      'setFeatureGate(candidate, true)',
    ]);
    for (const step of pipeline) {
      expect(step.body.length).toBeGreaterThan(20);
    }
  });

  test('Given the ports When listed Then each names a pipeline port', () => {
    expect(ports.map((p) => p.port).sort()).toEqual(
      ['deploy', 'runFanout', 'setFeatureGate', 'sign', 'trusted'].sort(),
    );
  });

  test('Given the fanout backends When listed Then terrarium, cloudflare, and local are present', () => {
    expect(fanoutBackends.map((b) => b.name).sort()).toEqual(['cloudflare', 'local', 'terrarium']);
  });

  test('Given the quick start When read Then it matches the README carrier commands', () => {
    expect(quickStart.map((q) => q.command)).toEqual(['bun install', 'bun test', 'bun run napkin']);
  });

  test('Given the public copy When checked Then unsupported launch claims are absent', () => {
    const copy = [
      site.title,
      site.description,
      ...pipeline.flatMap((step) => [step.title, step.body]),
      ...ports.flatMap((p) => [p.role]),
      ...fanoutBackends.flatMap((b) => [b.body]),
      ...quickStart.flatMap((item) => [item.command, item.note]),
      ...boundaries,
    ].join('\n');

    for (const fragment of bannedFragments) {
      expect(copy).not.toContain(fragment);
    }
  });
});
