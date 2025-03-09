import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sizes = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280
};

async function optimizeImage(inputPath) {
  const dir = path.dirname(inputPath);
  const ext = path.extname(inputPath);
  const basename = path.basename(inputPath, ext);

  try {
    // Verify the image can be processed
    await sharp(inputPath).metadata();

    // Create output directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Generate different sizes in original format
    for (const [size, width] of Object.entries(sizes)) {
      const outputPath = path.join(dir, `${basename}-${size}${ext}`);
      try {
        await sharp(inputPath)
          .resize(width, null, { 
            fit: 'contain',
            withoutEnlargement: true
          })
          .toFile(outputPath);
        
        console.log(`✓ Generated ${path.relative(process.cwd(), outputPath)}`);
      } catch (err) {
        console.error(`✗ Failed to generate ${path.relative(process.cwd(), outputPath)}:`, err.message);
      }
    }

    // Generate WebP versions
    for (const [size, width] of Object.entries(sizes)) {
      const outputPath = path.join(dir, `${basename}-${size}.webp`);
      try {
        await sharp(inputPath)
          .resize(width, null, {
            fit: 'contain',
            withoutEnlargement: true
          })
          .webp({ quality: 80 })
          .toFile(outputPath);
        
        console.log(`✓ Generated ${path.relative(process.cwd(), outputPath)}`);
      } catch (err) {
        console.error(`✗ Failed to generate ${path.relative(process.cwd(), outputPath)}:`, err.message);
      }
    }
  } catch (err) {
    console.error(`✗ Skipping ${path.relative(process.cwd(), inputPath)}: ${err.message}`);
  }
}

async function processDirectory(directory) {
  try {
    const files = fs.readdirSync(directory);
    
    for (const file of files) {
      const fullPath = path.join(directory, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        await processDirectory(fullPath);
      } else if (/\.(jpg|jpeg|png)$/i.test(file)) {
        await optimizeImage(fullPath);
      }
    }
  } catch (err) {
    console.error(`✗ Error processing directory ${directory}:`, err.message);
  }
}

// Process all product images
console.log('🔄 Starting image optimization...');
console.log('📁 Target directory:', path.relative(process.cwd(), path.join(__dirname, '../public/assets/images/products')));
console.log('📐 Generating sizes:', Object.entries(sizes).map(([size, width]) => `${size}: ${width}px`).join(', '));
console.log('');

const productsDir = path.join(__dirname, '../public/assets/images/products');
processDirectory(productsDir)
  .then(() => console.log('\n✨ Image optimization complete!'))
  .catch(err => console.error('\n❌ Fatal error:', err.message)); 