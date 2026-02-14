import {computed, Injectable, signal} from '@angular/core';
import {UnitRow} from '../shared/contract/contract';
import {parseCSV, toNum} from '../features/editor/helpers/csv-utils';

@Injectable({providedIn: 'root'})
export class UnitsService {
  private readonly _units = signal<UnitRow[]>([]);
  readonly units = this._units.asReadonly();
  readonly byId = computed(() => {
    const unitMap = new Map<number, UnitRow>();
    for (const unit of this._units()) {
      unitMap.set(unit.id, unit);
    }
    return unitMap;
  });

  private loaded = false;

  async loadAll(): Promise<void> {
    if (this.loaded) {
      return;
    }
    this.loaded = true;

    const response = await fetch('data/units.csv');
    if (!response.ok) {
      throw new Error('Failed to load units.csv');
    }

    const csvRows = parseCSV(await response.text());
    const parsedUnits: UnitRow[] = [];

    for (const row of csvRows) {
      const id = toNum(row['id']);
      if (!id) {
        continue;
      }
      const group = (row['group'] || '').trim();
      const name = (row['name'] || '').trim();
      if (!group || !name) {
        continue;
      }

      parsedUnits.push({
        id,
        group,
        name,
        date: (row['date'] || '').trim() || undefined,
        order: toNum(row['order']) ?? undefined,
      });
    }

    parsedUnits.sort((a, b) => (a.group.localeCompare(b.group) || (a.order ?? 9999) - (b.order ?? 9999) || a.id - b.id));
    this._units.set(parsedUnits);
  }
}
