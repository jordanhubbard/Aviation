import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('child_process', () => ({
  spawnSync: vi.fn(),
}));

import { spawnSync } from 'child_process';
import { BeadsIssueCreator } from '../issueCreator';

const spawnMock = spawnSync as unknown as ReturnType<typeof vi.fn>;

describe('BeadsIssueCreator', () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'beads-sdk-'));
    fs.mkdirSync(path.join(repoRoot, '.beads'));
    spawnMock.mockReset();

    process.env.NODE_ENV = 'development';
  });

  it('dedupes repeated createIssue calls', () => {
    spawnMock.mockImplementation((_cmd: string, args: string[]) => {
      if (args[0] === '--help') return { status: 0 };
      if (args[0] === 'create') return { status: 0, stdout: '{"id":"Aviation-abc"}' };
      return { status: 0 };
    });

    const creator = new BeadsIssueCreator({ repoRoot });

    const first = creator.createIssue({ title: 't', description: 'd' });
    expect(first.created).toBe(true);
    expect(first.issueId).toBe('Aviation-abc');

    const second = creator.createIssue({ title: 't', description: 'd' });
    expect(second.created).toBe(false);
    expect(second.reason).toBe('deduped');

    const createCalls = spawnMock.mock.calls.filter((c) => (c[1] as string[])[0] === 'create');
    expect(createCalls).toHaveLength(1);
  });

  it('adds an [auto-filed] comment when using createAutoFiledIssue', () => {
    spawnMock.mockImplementation((_cmd: string, args: string[]) => {
      if (args[0] === '--help') return { status: 0 };
      if (args[0] === 'create') return { status: 0, stdout: '{"id":"Aviation-xyz"}' };
      if (args[0] === 'comments') return { status: 0 };
      return { status: 0 };
    });

    const creator = new BeadsIssueCreator({ repoRoot });
    const res = creator.createAutoFiledIssue({
      title: 'boom',
      description: 'stack',
      autoFiledComment: 'something happened',
    });

    expect(res.created).toBe(true);
    expect(res.issueId).toBe('Aviation-xyz');

    const commentCall = spawnMock.mock.calls.find((c) => {
      const args = c[1] as string[];
      return args[0] === 'comments' && args[1] === 'add' && args[2] === 'Aviation-xyz';
    });

    expect(commentCall).toBeTruthy();
    const commentArgs = commentCall?.[1] as string[];
    expect(commentArgs[3]).toContain('[auto-filed]');
    expect(commentArgs[3]).toContain('something happened');
  });
});
