import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { packAsync } from 'free-tex-packer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const INPUT_DIR = path.join(ROOT_DIR, 'client/art_raw/');
const OUTPUT_DIR = path.join(ROOT_DIR, 'public/assets/sprites/');

// Opciones críticas para mantener el Pixel-Perfect y el Anchor Point
const PACKER_OPTIONS = {
    textureName: 'atlas',
    width: 1024,
    height: 1024,
    fixedSize: false,
    padding: 2,              // Evita que los colores se manchen entre sprites
    allowRotation: false,    // Mantiene la orientación original
    detectIdentical: false,
    allowTrim: false,        // ESTRICTO: false para no desfasar el setOrigin(0.5, 1)
    powerOfTwo: true,        // Optimización para GPU
    exporter: 'Phaser3',     // Compatible nativamente con Phaser 4
    removeFileExtension: false,
    prependFolderName: false,
    textureFormat: 'png',
    scale: 1,
    scaleMethod: 'NEAREST_NEIGHBOR' // Escalado sin blur
};

async function loadImages() {
    if (!fs.existsSync(INPUT_DIR)) {
        fs.mkdirSync(INPUT_DIR, { recursive: true });
        console.log(`Se creó el directorio: ${INPUT_DIR}. Agrega imágenes para empaquetar.`);
        return [];
    }
    
    const files = fs.readdirSync(INPUT_DIR).filter(f => f.endsWith('.png'));
    
    if (files.length === 0) {
        console.log(`No hay imágenes .png en: ${INPUT_DIR}`);
        return [];
    }
    
    console.log(`Encontradas ${files.length} imágenes crudas...`);
    
    return files.map(filename => ({
        path: filename,
        contents: fs.readFileSync(path.join(INPUT_DIR, filename))
    }));
}

async function buildAtlas() {
    console.log('🔨 Construyendo Atlas...');
    const images = await loadImages();
    if (images.length === 0) return;
    
    const packed = await packAsync(images, PACKER_OPTIONS);
    
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    for (const file of packed) {
        const outputPath = path.join(OUTPUT_DIR, file.name);
        fs.writeFileSync(outputPath, file.buffer);
        console.log(`Guardado: ${file.name}`);
    }
    console.log(`Pipeline completado con éxito.`);
}

buildAtlas().catch(err => {
    console.error('Error en el empaquetado:', err.message);
    process.exit(1);
});