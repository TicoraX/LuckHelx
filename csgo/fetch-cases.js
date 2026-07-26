import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localCratesPath = path.join(__dirname, 'public', 'api', 'en', 'crates.json');

function extractCS2Cases() {
  console.log('Leyendo datos de cajas locales desde public/api/en/crates.json...');
  try {
    if (!fs.existsSync(localCratesPath)) {
      throw new Error(`No se encontró el archivo: ${localCratesPath}`);
    }

    const rawData = fs.readFileSync(localCratesPath, 'utf-8');
    const crates = JSON.parse(rawData);

    // Filtrar solo las cajas reales que contienen items (excluyendo paquetes simples)
    const validCases = crates.filter((c) => c.contains && c.contains.length > 0);

    console.log(`¡Encontradas ${validCases.length} cajas válidas con skins y cuchillos!`);

    // Formatear las cajas y sus armas para integrarlas a EStiri
    const formattedCases = validCases.slice(0, 15).map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description || `Caja oficial de CS2: ${c.name}`,
      image: c.image,
      items: c.contains.map((item) => ({
        id: item.id,
        name: item.name,
        rarity: item.rarity?.name || 'Común',
        rarityColor: item.rarity?.color || '#b0c3d9',
        image: item.image,
      })),
    }));

    const outputPath = path.join(__dirname, 'cs2-cases-preset.json');
    fs.writeFileSync(outputPath, JSON.stringify(formattedCases, null, 2), 'utf-8');
    console.log(`✅ ${formattedCases.length} Cajas de CS2 extraídas correctamente en: ${outputPath}`);
  } catch (err) {
    console.error('Error al procesar las cajas:', err.message);
  }
}

extractCS2Cases();
