const fs = require('fs');
const path = require('path');

console.log('🔧 Building for production...');

// Create dist directory
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist', { recursive: true });
}

// Copy source files
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else if (entry.name.endsWith('.ts')) {
      // Copy TypeScript files as is (will be run with ts-node)
      fs.copyFileSync(srcPath, destPath);
      console.log(`  ✓ ${entry.name}`);
    } else if (entry.name !== 'tsconfig.json') {
      fs.copyFileSync(srcPath, destPath);
      console.log(`  ✓ ${entry.name}`);
    }
  }
}

if (fs.existsSync('src')) {
  copyDir('src', 'dist');
  console.log('✅ Source files copied to dist/');
}

// Copy prisma schema
if (fs.existsSync('prisma')) {
  const prismaDest = path.join('dist', 'prisma');
  if (!fs.existsSync(prismaDest)) fs.mkdirSync(prismaDest, { recursive: true });
  if (fs.existsSync('prisma/schema.prisma')) {
    fs.copyFileSync('prisma/schema.prisma', path.join(prismaDest, 'schema.prisma'));
    console.log('  ✓ prisma/schema.prisma');
  }
}

console.log('✅ Build completed!');
