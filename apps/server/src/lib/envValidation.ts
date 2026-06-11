export function validateEnvContent(content: string) {
  const lines = content.split('\n')

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (!line || line.startsWith('#')) continue
    if (line.startsWith('export ')) continue
    if (!line.includes('=')) {
      throw new Error(`Env validation failed on line ${index + 1}: expected KEY=value format.`)
    }
  }
}
