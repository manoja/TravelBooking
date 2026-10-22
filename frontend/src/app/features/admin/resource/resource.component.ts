import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, catchError, debounceTime, of, switchMap, tap } from 'rxjs';
import { Page } from '../../../core/models/api.models';
import { errorMessage } from '../../../core/interceptors/error.interceptor';
import { AdminResource, ApiService } from '../../../core/services/api.service';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { AdminStatsService } from '../shared/admin-stats.service';
import { ConfirmService } from '../shared/confirm.service';
import { ToastService } from '../shared/toast.service';

interface Row {
  id: number;
  name: string;
  slug?: string;
  description?: string | null;
  image_url?: string | null;
  address?: string | null;
  is_visible?: boolean;
  is_active?: boolean;
  destination_id?: number;
  hotel_id?: number;
  capacity?: number;
  price_per_night?: string;
  amenities?: string[];
  images?: { image_url: string }[];
  hotel?: { name: string };
}

interface Parent {
  id: number;
  name: string;
}

interface ResourceConfig {
  singular: string;
  plural: string;
  blurb: string;
  searchable: boolean;
  parentLabel: string | null;
}

const CONFIG: Record<AdminResource, ResourceConfig> = {
  destinations: {
    singular: 'Destination',
    plural: 'Destinations',
    blurb: 'Cities and regions guests can browse.',
    searchable: true,
    parentLabel: null,
  },
  hotels: {
    singular: 'Hotel',
    plural: 'Hotels',
    blurb: 'Properties grouped by destination.',
    searchable: true,
    parentLabel: 'Destination',
  },
  rooms: {
    singular: 'Room',
    plural: 'Rooms',
    blurb: 'Bookable rooms and their nightly rates.',
    searchable: false,
    parentLabel: 'Hotel',
  },
};

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

@Component({
  selector: 'app-admin-resource',
  imports: [ReactiveFormsModule, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './resource.component.html',
})
export class ResourceComponent {
  readonly resource = input.required<AdminResource>();

  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly stats = inject(AdminStatsService);
  private readonly formDialog = viewChild.required<ElementRef<HTMLDialogElement>>('formDlg');

  protected readonly config = computed(() => CONFIG[this.resource()]);

  // List state
  protected readonly search = signal('');
  protected readonly searchText = signal('');
  protected readonly parentFilter = signal<number | null>(null);
  protected readonly page = signal(1);
  private readonly tick = signal(0);
  protected readonly data = signal<Page<Row> | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly parents = signal<Parent[]>([]);
  protected readonly menuOpenId = signal<number | null>(null);
  protected readonly hasFilters = computed(() => !!this.search() || this.parentFilter() !== null);

  // Dialog state
  protected readonly editing = signal<Row | null>(null);
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  private readonly search$ = new Subject<string>();

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    slug: ['', [Validators.maxLength(180), Validators.pattern(SLUG)]],
    description: [''],
    image_url: [''],
    address: [''],
    parent_id: [null as number | null],
    capacity: [2],
    price: [100],
    amenities: [''],
    is_visible: [true],
  });

  constructor() {
    toObservable(
      computed(() => ({
        resource: this.resource(),
        q: this.search(),
        page: this.page(),
        parent: this.parentFilter(),
        tick: this.tick(),
      })),
    )
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap((p) =>
          this.api
            .adminList<Row>(p.resource, { page: p.page, q: p.q, parentId: p.parent })
            .pipe(
              catchError((e) => {
                this.error.set(errorMessage(e));
                return of(null);
              }),
            ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        this.loading.set(false);
        if (result) this.data.set(result);
      });

    toObservable(this.resource)
      .pipe(
        switchMap((r) =>
          r === 'destinations'
            ? of(null)
            : this.api
                .adminList<Parent>(r === 'hotels' ? 'destinations' : 'hotels', { pageSize: 100 })
                .pipe(catchError(() => of(null))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((p) => this.parents.set(p?.items ?? []));

    this.search$
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe((q) => {
        this.search.set(q.trim());
        this.page.set(1);
      });
  }

  @HostListener('document:click')
  @HostListener('document:keydown.escape')
  protected closeMenu(): void {
    this.menuOpenId.set(null);
  }

  // ---------- presentation helpers ----------
  protected subtitle(r: Row): string {
    switch (this.resource()) {
      case 'destinations':
        return r.slug ? `/${r.slug}` : '';
      case 'hotels':
        return r.address ?? '';
      default:
        return `${r.hotel?.name ?? 'Hotel #' + r.hotel_id} · Sleeps ${r.capacity ?? '-'}`;
    }
  }

  protected readonly brokenImages = signal<ReadonlySet<string>>(new Set());

  protected thumb(r: Row): string | null {
    const src = this.resource() === 'rooms' ? (r.images?.[0]?.image_url ?? null) : (r.image_url ?? null);
    return src && !this.brokenImages().has(src) ? src : null;
  }

  protected markBroken(src: string): void {
    this.brokenImages.update((s) => new Set(s).add(src));
  }

  protected isLive(r: Row): boolean {
    return (this.resource() === 'rooms' ? r.is_active : r.is_visible) !== false;
  }

  protected liveLabel(r: Row): string {
    const live = this.isLive(r);
    if (this.resource() === 'rooms') return live ? 'Active' : 'Inactive';
    return live ? 'Visible' : 'Hidden';
  }

  protected toggleLabel(r: Row): string {
    const live = this.isLive(r);
    if (this.resource() === 'rooms') return live ? 'Deactivate' : 'Activate';
    return live ? 'Hide from guests' : 'Make visible';
  }

  protected parentName(id: number | undefined): string {
    return this.parents().find((p) => p.id === id)?.name ?? '';
  }

  // ---------- list actions ----------
  protected onSearch(value: string): void {
    this.searchText.set(value);
    this.search$.next(value);
  }

  protected setParent(value: string): void {
    this.parentFilter.set(value ? Number(value) : null);
    this.page.set(1);
  }

  protected clearFilters(): void {
    this.searchText.set('');
    this.search.set('');
    this.parentFilter.set(null);
    this.page.set(1);
  }

  protected goTo(page: number): void {
    this.page.set(page);
  }

  protected reload(): void {
    this.tick.update((t) => t + 1);
  }

  protected toggleMenu(id: number, event: Event): void {
    event.stopPropagation();
    this.menuOpenId.update((cur) => (cur === id ? null : id));
  }

  protected toggleVisibility(r: Row): void {
    const field = this.resource() === 'rooms' ? 'is_active' : 'is_visible';
    const next = !this.isLive(r);
    this.menuOpenId.set(null);
    this.api.adminUpdate(this.resource(), r.id, { [field]: next }).subscribe({
      next: () => {
        this.toast.success(`${r.name} is now ${this.stateWord(next)}.`);
        this.afterChange();
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  protected async remove(r: Row): Promise<void> {
    this.menuOpenId.set(null);
    const ok = await this.confirm.ask({
      title: `Delete ${this.config().singular.toLowerCase()}?`,
      message: `“${r.name}” will be permanently deleted. This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    this.api.adminDelete(this.resource(), r.id).subscribe({
      next: () => {
        this.toast.success(`${r.name} was deleted.`);
        const rows = this.data()?.items.length ?? 0;
        if (rows <= 1 && this.page() > 1) this.page.update((p) => p - 1);
        this.afterChange();
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  private stateWord(live: boolean): string {
    if (this.resource() === 'rooms') return live ? 'active' : 'inactive';
    return live ? 'visible' : 'hidden';
  }

  private afterChange(): void {
    this.reload();
    this.stats.refresh();
  }

  // ---------- create / edit dialog ----------
  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset({
      name: '',
      slug: '',
      description: '',
      image_url: '',
      address: '',
      parent_id: this.parentFilter(),
      capacity: 2,
      price: 100,
      amenities: '',
      is_visible: true,
    });
    this.openDialog();
  }

  protected openEdit(r: Row): void {
    this.menuOpenId.set(null);
    this.editing.set(r);
    this.form.reset({
      name: r.name,
      slug: r.slug ?? '',
      description: r.description ?? '',
      image_url: r.image_url ?? '',
      address: r.address ?? '',
      parent_id: r.destination_id ?? r.hotel_id ?? null,
      capacity: r.capacity ?? 2,
      price: Number(r.price_per_night ?? 100),
      amenities: (r.amenities ?? []).join(', '),
      is_visible: this.isLive(r),
    });
    this.openDialog();
  }

  private openDialog(): void {
    this.submitted.set(false);
    this.applyValidators();
    this.formDialog().nativeElement.showModal();
  }

  protected closeDialog(): void {
    this.formDialog().nativeElement.close();
  }

  private applyValidators(): void {
    const c = this.form.controls;
    const r = this.resource();
    c.parent_id.setValidators(r === 'destinations' ? [] : [Validators.required]);
    c.address.setValidators(r === 'hotels' ? [Validators.required, Validators.maxLength(10000)] : []);
    c.capacity.setValidators(r === 'rooms' ? [Validators.required, Validators.min(1), Validators.max(20)] : []);
    c.price.setValidators(r === 'rooms' ? [Validators.required, Validators.min(0.01)] : []);
    c.image_url.setValidators(r === 'destinations' ? [Validators.pattern(/^(https?:\/\/\S+)?$/)] : []);
    Object.values(c).forEach((ctrl) => ctrl.updateValueAndValidity({ emitEvent: false }));
  }

  protected fieldError(name: string): string | null {
    const ctrl = this.form.get(name);
    if (!ctrl || !this.submitted() || ctrl.valid) return null;
    if (ctrl.errors?.['required']) return 'This field is required.';
    if (ctrl.errors?.['pattern']) {
      return name === 'slug'
        ? 'Use lowercase letters, numbers and hyphens.'
        : 'Enter a full URL starting with http:// or https://.';
    }
    if (ctrl.errors?.['min'] || ctrl.errors?.['max']) return 'Value is out of range.';
    return 'Invalid value.';
  }

  protected save(): void {
    this.submitted.set(true);
    if (this.form.invalid) return;

    const editing = this.editing();
    const body = this.buildBody(editing !== null);
    this.saving.set(true);

    const request = editing
      ? this.api.adminUpdate(this.resource(), editing.id, body)
      : this.api.adminCreate(this.resource(), body);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeDialog();
        this.toast.success(
          `${this.config().singular} ${editing ? 'updated' : 'created'} successfully.`,
        );
        this.afterChange();
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }

  private buildBody(isUpdate: boolean): Record<string, unknown> {
    const v = this.form.getRawValue();
    const optional = (text: string): string | null => text.trim() || null;
    const body: Record<string, unknown> = { name: v.name.trim() };

    switch (this.resource()) {
      case 'destinations':
        if (v.slug.trim()) body['slug'] = v.slug.trim();
        body['is_visible'] = v.is_visible;
        this.setOptional(body, 'description', optional(v.description), isUpdate);
        this.setOptional(body, 'image_url', optional(v.image_url), isUpdate);
        break;
      case 'hotels':
        body['destination_id'] = v.parent_id;
        body['address'] = v.address.trim();
        body['is_visible'] = v.is_visible;
        this.setOptional(body, 'description', optional(v.description), isUpdate);
        break;
      case 'rooms':
        // The API does not allow moving a room to another hotel.
        if (!isUpdate) body['hotel_id'] = v.parent_id;
        body['capacity'] = Number(v.capacity);
        body['price_per_night'] = Number(v.price).toFixed(2);
        body['amenities'] = v.amenities
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean);
        body['is_active'] = v.is_visible;
        break;
    }
    return body;
  }

  // On update an empty optional field must be sent as null so it can be cleared.
  private setOptional(
    body: Record<string, unknown>,
    key: string,
    value: string | null,
    isUpdate: boolean,
  ): void {
    if (value !== null || isUpdate) body[key] = value;
  }
}
