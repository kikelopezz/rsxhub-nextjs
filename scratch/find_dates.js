const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
        results = results.concat(walk(filePath));
      }
    } else {
      if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
        results.push(filePath);
      }
    }
  });
  return results;
}

const files = walk(baseDir);
const matches = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('getUTC') || content.includes('Date(') || content.includes('toLocaleString') || content.includes('startsAt')) {
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (line.includes('getUTC') || line.includes('startsAt')) {
        matches.push({
          file: path.relative(baseDir, file),
          lineNum: idx + 1,
          content: line.trim()
        });
      }
    });
  }
});

console.log(JSON.stringify(matches, null, 2));
