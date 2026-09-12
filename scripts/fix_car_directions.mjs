import sharp from 'sharp';
import path from 'path';

const dir = 'public/assets/vehicles';

// 1. lamborghini_left.png を lamborghini_right.png の左右反転（flop）で生成
const rightPath = path.join(dir, 'lamborghini_right.png');
const leftPath = path.join(dir, 'lamborghini_left.png');
await sharp(rightPath).flop().toFile(leftPath);
console.log(`Updated left: ${leftPath}`);

// 2. lamborghini_up_left.png を lamborghini_up_right.png の左右反転（flop）で生成
const upRightPath = path.join(dir, 'lamborghini_up_right.png');
const upLeftPath = path.join(dir, 'lamborghini_up_left.png');
await sharp(upRightPath).flop().toFile(upLeftPath);
console.log(`Updated up-left: ${upLeftPath}`);

console.log('Fixed left and up-left directions successfully!');
