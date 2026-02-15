export type LessonOptionType = 'all' | 'group' | 'unit';

export interface LessonOption {
  type: LessonOptionType;
  id: 'all' | number;
  label: string;
  groupId?: number;
  unitId?: number;
  date?: string;
}
