import { describe, expect, it, vi } from 'vitest';
import { BackgroundService, type ServiceConfig } from '../service.js';
import { ServiceLifecycleError } from '../aviation/service-lifecycle.js';

class TestService extends BackgroundService {
  startHook = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  stopHook = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

  constructor(config: Partial<ServiceConfig> = {}) {
    super({ name: 'test-service', enabled: true, ...config });
  }

  protected onStart(): Promise<void> {
    return this.startHook();
  }

  protected onStop(): Promise<void> {
    return this.stopHook();
  }
}

describe('BackgroundService', () => {
  it('runs hooks through an observable start and stop lifecycle', async () => {
    const service = new TestService();
    expect(service.getStatus()).toEqual({ name: 'test-service', status: 'stopped' });

    await service.start();
    expect(service.getStatus()).toMatchObject({ name: 'test-service', status: 'running' });
    expect(service.getStatus().uptime).toBeGreaterThanOrEqual(0);

    await service.stop();
    expect(service.getStatus()).toEqual({ name: 'test-service', status: 'stopped' });
    expect(service.startHook).toHaveBeenCalledOnce();
    expect(service.stopHook).toHaveBeenCalledOnce();
  });

  it('rejects a concurrent start before invoking the hook twice', async () => {
    let release: (() => void) | undefined;
    const service = new TestService();
    service.startHook.mockImplementation(() => new Promise<void>((resolve) => {
      release = resolve;
    }));

    const firstStart = service.start();
    expect(service.getStatus().status).toBe('starting');
    await expect(service.start()).rejects.toMatchObject({
      code: 'service-lifecycle-transition-invalid',
    });
    expect(service.startHook).toHaveBeenCalledOnce();
    release?.();
    await firstStart;
  });

  it('captures a startup failure and requires an explicit reset', async () => {
    const service = new TestService();
    service.startHook.mockRejectedValueOnce(new Error('startup exploded'));

    await expect(service.start()).rejects.toThrow('startup exploded');
    expect(service.getStatus()).toEqual({
      name: 'test-service',
      status: 'failed',
      lastError: 'startup exploded',
    });
    await expect(service.start()).rejects.toBeInstanceOf(ServiceLifecycleError);

    service.reset();
    expect(service.getStatus()).toEqual({ name: 'test-service', status: 'stopped' });
    await service.start();
  });

  it('captures a stop failure and preserves uptime until reset', async () => {
    const service = new TestService();
    await service.start();
    service.stopHook.mockRejectedValueOnce(new Error('cleanup exploded'));

    await expect(service.stop()).rejects.toThrow('cleanup exploded');
    expect(service.getStatus()).toMatchObject({
      name: 'test-service',
      status: 'failed',
      lastError: 'cleanup exploded',
    });
    expect(service.getStatus().uptime).toBeGreaterThanOrEqual(0);

    service.reset();
    expect(service.getStatus()).toEqual({ name: 'test-service', status: 'stopped' });
  });

  it('does not start a disabled service', async () => {
    const service = new TestService({ enabled: false });
    await expect(service.start()).rejects.toMatchObject({ code: 'service-disabled' });
    expect(service.startHook).not.toHaveBeenCalled();
    expect(service.getStatus().status).toBe('stopped');
  });
});
