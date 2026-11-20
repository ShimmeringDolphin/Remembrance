// Builds docs/open-creativity/concept/index.html: the template plus the REAL core logic
// (scheduler, memory, adaptivePlan, queue, insights) transpiled from src/core, so the demo runs
// the same code the unit tests cover. Usage: node scripts/build-concept.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';

const files = ['scheduler', 'labs/memory', 'labs/adaptivePlan', 'labs/queue', 'labs/insights'];
// Each module becomes its own function scope; exported names are shared through one object.
let core = 'const M = {};\n';
for (const f of files) {
  const src = readFileSync(`src/core/${f}.ts`, 'utf8');
  let js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  const imported = [...js.matchAll(/^import\s*\{([^}]*)\}\s*from[^;]*;/gm)].flatMap((m) => m[1].split(',').map((x) => x.trim()).filter(Boolean));
  const exported = [...js.matchAll(/^export (?:const|function) (\w+)/gm)].map((m) => m[1]);
  js = js.replace(/^import[\s\S]*?;\s*$/gm, '').replace(/^export /gm, '');
  core += `(() => {\n${imported.length ? `const { ${imported.join(', ')} } = M;\n` : ''}${js}\nObject.assign(M, { ${exported.join(', ')} });\n})();\n`;
}
const bundle = `const Core = (() => {\n${core}\nreturn M;\n})();`;
const tpl = readFileSync('docs/open-creativity/concept/template.html', 'utf8');
writeFileSync('docs/open-creativity/concept/index.html', tpl.replace('/*CORE*/', () => bundle));
console.log('built', bundle.length, 'bytes of core');
