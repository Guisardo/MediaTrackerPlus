const j = require('./coverage/coverage-summary.json');
const rows = Object.entries(j)
  .filter(([k]) => k !== 'total')
  .map(([k, v]) => ({
    file: k.replace('/Users/lucas.rancez/Documents/Code/MediaTrackerPlus/trees/kevin/client/', ''),
    stmts: v.statements.pct,
    branches: v.branches.pct,
    funcs: v.functions.pct,
  }))
  .sort((a, b) => a.stmts - b.stmts)
  .slice(0, 35);

rows.forEach(r => console.log(`${r.stmts}% stmts\t${r.branches}% br\t${r.funcs}% fn\t${r.file}`));
console.log('\nTotal:', j.total.statements.pct, '% stmts |', j.total.branches.pct, '% branches |', j.total.functions.pct, '% funcs |', j.total.lines.pct, '% lines');
