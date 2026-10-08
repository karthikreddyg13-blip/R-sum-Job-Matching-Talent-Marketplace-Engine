const { spawn } = require('node:child_process');

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = new Set();
let stopping = false;

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  for (const child of children) child.kill('SIGTERM');
}

for (const workspace of ['talentmatch-server', 'talentmatch-web']) {
  const env = { ...process.env };
  env.PORT = workspace === 'talentmatch-server'
    ? process.env.API_PORT ?? process.env.PORT ?? '4000'
    : process.env.WEB_PORT ?? '3000';
  const child = spawn(npm, ['run', 'dev', `--workspace=${workspace}`], { stdio: 'inherit', env });
  children.add(child);
  child.on('error', (error) => {
    console.error(`Failed to start ${workspace}:`, error.message);
    stop(1);
  });
  child.on('exit', (code, signal) => {
    children.delete(child);
    if (!stopping) stop(code ?? (signal ? 1 : 0));
  });
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));