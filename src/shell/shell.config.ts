import {ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection} from '@angular/core';
import {provideRouter, withComponentInputBinding} from '@angular/router';
import {AppComponent} from '../features/app/app';
import {
  BilingualSentenceEditorComponent
} from '../features/editor/components/editor/bilingual-sentence-editor.component';

export const shellConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      [
        { path: '', component: AppComponent },
        { path: 'editor', component: BilingualSentenceEditorComponent }
      ],
      withComponentInputBinding()
    ),
  ]
};
