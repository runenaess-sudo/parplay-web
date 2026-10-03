// Keep the standalone web deployment in sync with the canonical mobile Results helper.
// No build-time dependency on a sibling checkout. Pass its path when stored elsewhere.
const fs = require('node:fs');
const path = require('node:path');
const source = path.resolve(process.argv[2] || '../parplay/src/tournaments/classOrder.ts');
const destination = path.resolve(__dirname, '../src/lib/event-class-order.ts');
fs.writeFileSync(destination, '// Generated from parplay/src/tournaments/classOrder.ts; run scripts/sync-event-class-order.cjs.\n' + fs.readFileSync(source, 'utf8'));
console.log('Synced Results class ordering.');
