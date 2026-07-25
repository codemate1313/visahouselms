const fs = require('fs');
let css = fs.readFileSync('frontend/src/index.css', 'utf-8');

// Replacements
css = css.replace(/background:\s*#ffffff;?/g, 'background: var(--surface);');
css = css.replace(/background-color:\s*#ffffff;?/g, 'background-color: var(--surface);');
css = css.replace(/background:\s*#fff;?/g, 'background: var(--surface);');
css = css.replace(/background-color:\s*#fff;?/g, 'background-color: var(--surface);');

css = css.replace(/color:\s*#111113;?/g, 'color: var(--text);');
css = css.replace(/color:\s*#6e6e73;?/g, 'color: var(--text-muted);');

// Handle gradients
css = css.replace(/linear-gradient\(135deg,\s*#ffffff\s*0%,\s*#f6f6f8\s*46%,\s*#e7e7eb\s*100%\)/g, 'var(--app-bg-gradient)');
css = css.replace(/linear-gradient\(135deg,\s*#ffffff\s*0%,\s*#f6f6f8\s*48%,\s*#e7e7eb\s*100%\)/g, 'var(--app-bg-gradient)');

// Borders
css = css.replace(/border:\s*1px solid #e7e7eb;?/g, 'border: 1px solid var(--border);');
css = css.replace(/border-color:\s*#e7e7eb;?/g, 'border-color: var(--border);');

fs.writeFileSync('frontend/src/index.css', css);
console.log('CSS updated');
