import {SentenceRow} from '../../../shared/contract/contract';
import {TermRefInSentence} from './term-ref-in-sentence';

export type SentenceVm = SentenceRow & { refs: TermRefInSentence[] };
