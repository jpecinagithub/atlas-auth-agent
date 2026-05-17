const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }
const currentLevel = LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LEVELS.info

function log(level, ...args) {
  if (LEVELS[level] < currentLevel) return
  const ts = new Date().toTimeString().slice(0, 8) // HH:MM:SS
  const label = level.toUpperCase().padEnd(5)
  const line = `[${ts}] [${label}] ${args.join(' ')}`
  if (level === 'error') console.error(line)
  else if (level === 'warn')  console.warn(line)
  else console.log(line)
}

export const logger = {
  debug: (...a) => log('debug', ...a),
  info:  (...a) => log('info',  ...a),
  warn:  (...a) => log('warn',  ...a),
  error: (...a) => log('error', ...a),
}
