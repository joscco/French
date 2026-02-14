import {bootstrapApplication} from '@angular/platform-browser';
import {ShellComponent} from './shell/shell';
import {shellConfig} from './shell/shell.config';
bootstrapApplication(ShellComponent, shellConfig)
  .catch((err) => console.error(err));
