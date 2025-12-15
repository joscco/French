import { Injectable, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PracticeMode, PracticeKind } from '../models/types';

@Injectable({ providedIn: 'root' })
export class PracticeRouteStateService {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly qp = signal<Record<string, any>>({});

  // qp: kind=vocab|sentence, mode=de-fr|fr-de|mixed, lesson=all|12, i=0
  readonly kind = computed<PracticeKind>(() => (this.qp()['kind'] as PracticeKind) ?? 'sentence');
  readonly mode = computed<PracticeMode>(() => (this.qp()['mode'] as PracticeMode) ?? 'de-fr');
  readonly lesson = computed<string>(() => (this.qp()['lesson'] as string) ?? 'all');
  readonly index = computed<number>(() => {
    const n = Number(this.qp()['i']);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  });

  constructor() {
    this.route.queryParamMap.subscribe(map => {
      const obj: Record<string, any> = {};
      map.keys.forEach(k => (obj[k] = map.get(k)));
      this.qp.set(obj);
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
