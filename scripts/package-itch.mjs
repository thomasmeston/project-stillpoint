import { execSync } from 'child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const dist = join(root, 'dist');
const out = join(root, 'lonniecrow-itch.zip');

execSync('npm run build', { stdio: 'inherit', cwd: root });

if (!existsSync(dist)) {
  throw new Error('dist/ not found after build');
}

if (existsSync(out)) rmSync(out);

const zipCmd = process.platform === 'win32'
  ? `powershell Compress-Archive -Path "${dist}\\*" -DestinationPath "${out}" -Force`
  : `cd dist && zip -r ../lonniecrow-itch.zip .`;

execSync(zipCmd, { stdio: 'inherit', shell: true });
console.log(`Created ${out}`);
