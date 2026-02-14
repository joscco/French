import {PracticeKind, PracticeMode} from './types';

export interface PracticeConfig {
  mode: PracticeMode;    // fr-de / de-fr
  kind: PracticeKind;    // vocab / sentence
}
