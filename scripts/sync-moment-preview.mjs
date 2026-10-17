// Run from parplay-web after editing the app's registry: node scripts/sync-moment-preview.mjs [app-root]
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2] ?? '../parplay');
const registry=fs.readFileSync(path.join(root,'src/features/moments/registry.ts'),'utf8');
fs.mkdirSync('src/lib/moments',{recursive:true});
fs.writeFileSync('src/lib/moments/registry.generated.ts','// Generated from parplay/src/features/moments/registry.ts. Do not edit; run scripts/sync-moment-preview.mjs.\n'+registry);
const vector=path.join(root,'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons');
const glyphs=JSON.parse(fs.readFileSync(path.join(vector,'glyphmaps/MaterialCommunityIcons.json'),'utf8'));
const names=['trophy','trending-up','trending-down','calendar','medal','crown','flag','check-decagram','fire','sword-cross','disc','close'];
fs.writeFileSync('src/lib/moments/icons.generated.json',JSON.stringify(Object.fromEntries(names.map(n=>[n,glyphs[n]])),null,2)+'\n');
fs.mkdirSync('public/fonts',{recursive:true});
fs.copyFileSync(path.join(vector,'Fonts/MaterialCommunityIcons.ttf'),'public/fonts/MomentsMaterialCommunityIcons.ttf');
fs.copyFileSync(path.join(vector,'LICENSE'),'public/fonts/MomentsIcons-LICENSE.txt');
