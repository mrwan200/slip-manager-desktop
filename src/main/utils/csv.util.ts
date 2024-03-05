export function parseCSV<D extends object>(raw: string): { headers: string[]; contents: D[] } {
  const result: D[] = []

  const contents = raw.split('\n') as unknown as string[]
  // Get headers
  const headers = contents[0]
  const headersSperate = headers.split(',')
  // Get content(s)
  for (const content of contents.slice(1)) {
    const contentSperate = content.split(',')
    const resultObj = {} as D
    for (const [idx, key] of headersSperate.entries()) {
      resultObj[key] = contentSperate[idx] || null
    }

    result.push(resultObj)
  }

  return {
    headers: headersSperate,
    contents: result
  }
}

export function stringifyCSV<D extends object>(headers: string[], data: D[]): string {
  // Get headers
  const result: string[] = []
  // Push header(s) first
  result.push(headers.join(','))
  // Push contents
  for (const content of data) {
    const contentCsv = new Array(headers.length)
    for (const key of Object.keys(content)) {
      const idx = headers.indexOf(key)
      contentCsv[idx] = content[key]
    }
    result.push(contentCsv.join(','))
  }

  return result.join('\n')
}
