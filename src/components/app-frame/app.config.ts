import {ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection} from '@angular/core';
import {provideRouter, withComponentInputBinding} from '@angular/router';
import {BilingualSentenceEditorComponent} from '../editor/bilingual-sentence-editor.component';
import {AppComponent} from '../app/app';

export const appConfig: ApplicationConfig = {
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
