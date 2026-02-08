import {bootstrapApplication} from '@angular/platform-browser';
import {AppFrameComponent} from './components/app-frame/frame';
import {appConfig} from './components/app-frame/app.config';

bootstrapApplication(AppFrameComponent, appConfig)
  .catch((err) => console.error(err));
