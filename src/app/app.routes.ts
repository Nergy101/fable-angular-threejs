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
    path: 'games',
    loadComponent: () => import('./games/games-index').then((m) => m.GamesIndex),
  },
  {
    path: 'music',
    loadComponent: () => import('./music/music').then((m) => m.Music),
  },
  {
    path: 'map',
    loadComponent: () => import('./map/map').then((m) => m.MapStudio),
  },
  {
    path: 'games/blobby-volley',
    loadComponent: () => import('./games/blobby-volley').then((m) => m.BlobbyVolley),
  },
  {
    path: 'games/tiny-legend',
    loadComponent: () => import('./games/tiny-legend').then((m) => m.TinyLegend),
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
