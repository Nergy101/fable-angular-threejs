import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./home/home').then((m) => m.Home),
  },
  {
    path: 'learn',
    loadComponent: () => import('./learn/learn-index').then((m) => m.LearnIndex),
  },
  {
    path: 'learn/:slug',
    loadComponent: () => import('./learn/lesson-page').then((m) => m.LessonPage),
  },
  {
    path: 'explorer',
    loadComponent: () => import('./explorer/explorer').then((m) => m.Explorer),
  },
  {
    path: 'explorer/:uid',
    loadComponent: () => import('./explorer/model-detail').then((m) => m.ModelDetail),
  },
  {
    path: 'viewer/:uid',
    loadComponent: () => import('./viewer/atelier-viewer').then((m) => m.AtelierViewer),
  },
  { path: '**', redirectTo: '' },
];
