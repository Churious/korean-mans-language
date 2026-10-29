// web/ 과 examples/ 를 dist/ 로 모아 GitHub Pages 에 올릴 사이트를 만든다.
//
// 로컬 미리보기:
//   npm run build:site
//   npx http-server dist   (또는 py -m http.server 8000 -d dist)
import { cpSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));

rmSync(root('dist'), { recursive: true, force: true });
cpSync(root('web'), root('dist'), { recursive: true });
cpSync(root('examples'), root('dist/examples'), { recursive: true });
writeFileSync(root('dist/.nojekyll'), '');
console.log(`built ${root('dist')}`);
