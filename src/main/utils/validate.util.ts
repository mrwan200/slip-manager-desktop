export function validateSlip(input: string, origin: string) {
  const isNumeric = (n: string | number) => !isNaN(parseFloat(n as string)) && isFinite(+n)

  origin = origin?.replaceAll('-', '')
  input = input?.replaceAll('-', '')

  if (origin?.length !== input?.length) return false
  let same = 0
  for (let i = 0; i < input.length; ++i) {
    if (isNumeric(input[i])) {
      if (input[i] !== origin[i]) return false
      same++
    }
  }
  if (same < 3) return false
  return true
}
