import {Component, computed, EventEmitter, inject, Output, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {GroupsService} from '../../../../services/groups.service';
import {UnitsService} from '../../../../services/units.service';
import {LessonOption} from '../../models/lesson-option';

@Component({
  selector: 'app-lesson-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lesson-selector.component.html'
})
export class LessonSelectorComponent {
  private readonly groupsService = inject(GroupsService);
  private readonly unitsService = inject(UnitsService);

  @Output()
  public selectionChange = new EventEmitter<LessonOption>();

  selectedGroupId = signal<number | 'all'>('all');
  selectedUnitId = signal<number | 'all'>('all');

  readonly groups = computed(() => this.groupsService.groups());

  readonly filteredUnits = computed(() => {
    const groupId = this.selectedGroupId();
    const allUnits = this.unitsService.units();

    if (groupId === 'all') {
      return allUnits;
    }

    return allUnits.filter(unit => unit.group_id === groupId);
  });

  onGroupChange(value: string) {
    const groupId = value === 'all' ? 'all' : Number(value);
    this.selectedGroupId.set(groupId as number | 'all');
    this.selectedUnitId.set('all');
    this.emitSelection();
  }

  onUnitChange(value: string) {
    const unitId = value === 'all' ? 'all' : Number(value);
    this.selectedUnitId.set(unitId as number | 'all');
    this.emitSelection();
  }

  private emitSelection() {
    const groupId = this.selectedGroupId();
    const unitId = this.selectedUnitId();

    if (unitId !== 'all') {
      const unit = this.unitsService.units().find(u => u.id === unitId);
      this.selectionChange.emit({
        type: 'unit',
        id: unitId,
        groupId: unit?.group_id,
        unitId: unitId,
        label: unit?.name ?? `Unit ${unitId}`,
        date: unit?.date,
      });
    } else if (groupId !== 'all') {
      const group = this.groupsService.groups().find(g => g.id === groupId);
      this.selectionChange.emit({
        type: 'group',
        id: groupId,
        groupId: groupId,
        label: group?.name ?? `Group ${groupId}`,
        date: group?.date,
      });
    } else {
      this.selectionChange.emit({
        type: 'all',
        id: 'all',
        label: 'Alle',
      });
    }
  }
}
