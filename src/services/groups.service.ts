import {computed, Injectable, signal} from '@angular/core';
import {GroupRow} from '../shared/contract/contract';
import {parseCSV, toNum} from '../features/editor/helpers/csv-utils';

@Injectable({providedIn: 'root'})
export class GroupsService {
  private readonly _groups = signal<GroupRow[]>([]);
  readonly groups = this._groups.asReadonly();

  private loaded = false;

  async loadAll(): Promise<void> {
    if (this.loaded) {
      return;
    }
    this.loaded = true;

    const response = await fetch('data/groups.csv');
    if (!response.ok) {
      throw new Error('Failed to load groups.csv');
    }

    const csvRows = parseCSV(await response.text());
    const parsedGroups: GroupRow[] = [];

    for (const row of csvRows) {
      const id = toNum(row['id']);
      if (!id) {
        continue;
      }
      const name = (row['name'] || '').trim();
      if (!name) {
        continue;
      }

      parsedGroups.push({
        id,
        name,
        date: (row['date'] || '').trim() || undefined,
      });
    }

    parsedGroups.sort((a, b) => a.id - b.id);
    this._groups.set(parsedGroups);
  }
}
