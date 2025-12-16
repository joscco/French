import { Injectable, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PracticeMode, PracticeKind } from '../models/types';

@Injectable({ providedIn: 'root' })
export class PracticeRouteStateService {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly queryParams = signal<Record<string, any>>({});

  readonly kind = computed<PracticeKind>(() => (this.queryParams()['kind'] as PracticeKind) ?? 'sentence');
  readonly mode = computed<PracticeMode>(() => (this.queryParams()['mode'] as PracticeMode) ?? 'de-fr');
  readonly lesson = computed<string>(() => (this.queryParams()['lesson'] as string) ?? 'all');
  readonly index = computed<number>(() => {
    const n = Number(this.queryParams()['i']);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  });

  constructor() {
    this.route.queryParamMap.subscribe(map => {
      const obj: Record<string, any> = {};
      map.keys.forEach(k => (obj[k] = map.get(k)));
      this.queryParams.set(obj);
    });
  }

  patch(params: Partial<{ kind: PracticeKind; mode: PracticeMode; lesson: string; i: number }>) {
    const queryParams: any = {};
    if (params.kind != null) queryParams.kind = params.kind;
    if (params.mode != null) queryParams.mode = params.mode;
    if (params.lesson != null) queryParams.lesson = params.lesson;
    if (params.i != null) queryParams.i = params.i;

    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true, // wichtig fürs scrubben
    });
  }
}
