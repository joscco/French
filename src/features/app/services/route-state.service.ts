import { Injectable, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {PracticeKind, PracticeMode} from '../models/types';

@Injectable({ providedIn: 'root' })
export class PracticeRouteStateService {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly queryParams = signal<Record<string, string>>({});

  readonly kind = computed<PracticeKind>(() => {
    return (this.queryParams()['kind'] as PracticeKind) ?? 'sentence';
  });

  readonly mode = computed<PracticeMode>(() => {
    return (this.queryParams()['mode'] as PracticeMode) ?? 'de-fr';
  });

  readonly lesson = computed<string>(() => {
    return (this.queryParams()['lesson'] as string) ?? 'all';
  });

  readonly index = computed<number>(() => {
    const parsedIndex = Number(this.queryParams()['i']);
    return Number.isFinite(parsedIndex) ? Math.max(0, parsedIndex) : 0;
  });

  constructor() {
    this.route.queryParamMap.subscribe(paramMap => {
      const params: Record<string, string> = {};
      for (const key of paramMap.keys) {
        const value = paramMap.get(key);
        if (value != null) {
          params[key] = value;
        }
      }
      this.queryParams.set(params);
    });
  }

  patch(params: Partial<{ kind: PracticeKind; mode: PracticeMode; lesson: string; i: number }>) {
    const updatedParams: Record<string, string | number> = {};

    if (params.kind != null) {
      updatedParams['kind'] = params.kind;
    }
    if (params.mode != null) {
      updatedParams['mode'] = params.mode;
    }
    if (params.lesson != null) {
      updatedParams['lesson'] = params.lesson;
    }
    if (params.i != null) {
      updatedParams['i'] = params.i;
    }

    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams: updatedParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
