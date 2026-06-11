export interface LessonMeta {
  slug: string;
  num: string;
  title: string;
  subtitle: string;
  /** which axis color tags this lesson (x | y | z) — purely decorative */
  axis: 'x' | 'y' | 'z';
  minutes: number;
  concepts: string[];
}

export const LESSONS: LessonMeta[] = [
  {
    slug: 'the-stage',
    num: '01',
    title: 'The Stage',
    subtitle: 'Scene, camera, renderer — the three objects every frame needs',
    axis: 'x',
    minutes: 12,
    concepts: ['Scene', 'PerspectiveCamera', 'WebGLRenderer', 'NgZone', 'afterNextRender'],
  },
  {
    slug: 'meshes',
    num: '02',
    title: 'Geometry × Material',
    subtitle: 'A mesh is data times surface — the two halves of every visible thing',
    axis: 'y',
    minutes: 14,
    concepts: ['BufferGeometry', 'Material', 'Mesh', 'PBR', 'metalness/roughness'],
  },
  {
    slug: 'scene-graph',
    num: '03',
    title: 'The Scene Graph',
    subtitle: 'Nested transforms — the DOM tree you already know, in 3D',
    axis: 'z',
    minutes: 10,
    concepts: ['Object3D', 'Group', 'position/rotation/scale', 'local vs world space'],
  },
  {
    slug: 'light-and-shadow',
    num: '04',
    title: 'Light & Shadow',
    subtitle: 'Four kinds of light, and why shadows cost extra',
    axis: 'x',
    minutes: 13,
    concepts: ['AmbientLight', 'DirectionalLight', 'PointLight', 'SpotLight', 'shadow maps'],
  },
  {
    slug: 'cameras',
    num: '05',
    title: 'Cameras & Controls',
    subtitle: 'Frustums, perspective vs orthographic, and OrbitControls',
    axis: 'y',
    minutes: 11,
    concepts: ['fov', 'aspect', 'near/far', 'OrthographicCamera', 'OrbitControls'],
  },
  {
    slug: 'render-loop',
    num: '06',
    title: 'The Render Loop',
    subtitle: 'requestAnimationFrame, delta time, and staying out of Angular’s zone',
    axis: 'z',
    minutes: 12,
    concepts: ['requestAnimationFrame', 'Clock', 'delta time', 'lerp', 'runOutsideAngular'],
  },
  {
    slug: 'raycasting',
    num: '07',
    title: 'Pointing at Pixels',
    subtitle: 'Raycasting — how a 2D click finds a 3D object',
    axis: 'x',
    minutes: 10,
    concepts: ['Raycaster', 'NDC coordinates', 'intersections', 'hover & click'],
  },
  {
    slug: 'gltf',
    num: '08',
    title: 'Loading Worlds',
    subtitle: 'glTF, the JPEG of 3D — load real assets into your scene',
    axis: 'y',
    minutes: 14,
    concepts: ['GLTFLoader', 'async loading', 'traverse', 'Box3 framing', 'Sketchfab'],
  },
];

export const lessonBySlug = (slug: string) => LESSONS.find((l) => l.slug === slug);
