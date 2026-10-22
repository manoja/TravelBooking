import { TestBed } from '@angular/core/testing';
import { ConfirmService } from './confirm.service';
import { statusTone } from './status-tone';
import { ToastService } from './toast.service';

describe('admin shared helpers', () => {
  it('maps reservation statuses to badge tones', () => {
    expect(statusTone('confirmed')).toBe('success');
    expect(statusTone('pending')).toBe('warn');
    expect(statusTone('cancelled')).toBe('danger');
    expect(statusTone('anything-else')).toBe('neutral');
  });

  it('queues and dismisses toasts', () => {
    const toast = TestBed.inject(ToastService);
    toast.success('Saved');
    toast.error('Failed');
    expect(toast.toasts().map((t) => t.kind)).toEqual(['success', 'error']);
    toast.dismiss(toast.toasts()[0].id);
    expect(toast.toasts().length).toBe(1);
  });

  it('resolves the confirmation promise with the answer', async () => {
    const confirm = TestBed.inject(ConfirmService);
    const pending = confirm.ask({ title: 'Delete?', message: 'Sure?', destructive: true });
    expect(confirm.request()?.title).toBe('Delete?');
    confirm.answer(true);
    expect(await pending).toBe(true);
    expect(confirm.request()).toBeNull();
  });
});
