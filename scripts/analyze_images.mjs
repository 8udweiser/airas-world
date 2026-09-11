import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const reviewerPath = 'C:/Applications/Antigravity_Portable/Data/.gemini/config/skills/thorium-reviewer/scripts/thorium_reviewer.mjs';
const { ThoriumController } = await import(pathToFileURL(reviewerPath).href);

async function main() {
  const controller = new ThoriumController();
  await controller.connect();

  const carJpg = fs.readFileSync(path.resolve(rootDir, 'nanobanana/Gemini_Generated_Image_lakgjylakgjylakg.jpg')).toString('base64');
  const retroJpg = fs.readFileSync(path.resolve(rootDir, 'nanobanana/Gemini_Generated_Image_1t7j351t7j351t7j.jpg')).toString('base64');

  const script = `
    (async () => {
      async function inspect(b64) {
        const img = new Image();
        await new Promise(r => { img.onload = r; img.src = 'data:image/jpeg;base64,' + b64; });
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, c.width, c.height).data;
        return { w: img.width, h: img.height };
      }
      return {
        car: await inspect(${JSON.stringify(carJpg)}),
        retro: await inspect(${JSON.stringify(retroJpg)})
      };
    })()
  `;

  const res = await controller.evaluate(script);
  console.log('Result:', JSON.stringify(res, null, 2));
  controller.close();
}

main().catch(console.error);
