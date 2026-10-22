import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-admin-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <div>
        <h1>Settings</h1>
        <p>Your administrator account and connection details.</p>
      </div>
    </div>
    <section class="card panel">
      <h2>Account</h2>
      <dl>
        <dt>Name</dt>
        <dd>{{ auth.profile()?.name || '—' }}</dd>
        <dt>Email</dt>
        <dd>{{ auth.profile()?.email || '—' }}</dd>
        <dt>Role</dt>
        <dd>{{ auth.profile()?.role || '—' }}</dd>
      </dl>
    </section>
    <section class="card panel">
      <h2>Connection</h2>
      <dl>
        <dt>API</dt>
        <dd>{{ apiUrl }}</dd>
      </dl>
      <p class="note">Roles are managed in the database; this page is read-only.</p>
    </section>
  `,
})
export class SettingsComponent {
  protected readonly auth = inject(AuthService);
  protected readonly apiUrl = environment.apiUrl;
}
