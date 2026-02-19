import {ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection} from '@angular/core';
import {provideRouter, Routes, withComponentInputBinding} from '@angular/router';
import {AppComponent} from '../features/app/app';
import {EditorComponent} from '../features/editor/components/editor.component';

// Editor nur im lokalen Development-Modus verfügbar
const isLocalDevelopment = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const routes: Routes = [
  { path: '', component: AppComponent },
  // Editor-Route nur lokal verfügbar
  ...(isLocalDevelopment ? [{ path: 'editor', component: EditorComponent }] : []),
  {path: '**', redirectTo: ''}
];

export const shellConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withComponentInputBinding()
    ),
  ]
};
