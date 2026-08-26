export function isTemporaryHerdrLabel(label: string | undefined): boolean {
  const temporaryLabel = process.env["HERDR_TEMPORARY_LABEL"]?.trim()
  return Boolean(temporaryLabel) && label?.trim() === temporaryLabel
}
