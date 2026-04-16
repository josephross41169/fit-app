const fs = require('fs');
const path = require('path');

const replacements = [
  { old: /#10B981/g, new: '#7C3AED' },
  { old: /#06B6D4/g, new: '#7C3AED' },
  { old: /["']#22c55e["']/g, new: '"#7C3AED"' },
  { old: /rgba\(16,185,129,/g, new: 'rgba(124,58,237,' },
];

function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;
    
    replacements.forEach(({ old, new: newVal }) => {
      content = content.replace(old, newVal);
    });
    
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ ${filePath}`);
      return true;
    }
  } catch (e) {
    //ignore
  }
  return false;
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  let count = 0;
  
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !file.startsWith('.')) {
      count += walkDir(fullPath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      if (processFile(fullPath)) count++;
    }
  });
  
  return count;
}

const updated = walkDir('./app') + walkDir('./components');
console.log(`\nUpdated ${updated} files`);
