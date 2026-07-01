export type UsTimezoneOption = {
  value: string
  label: string
  region: string
  regionSortOrder?: number
  sortOrder?: number
}

export type TimezoneRegionGroup = {
  region: string
  options: UsTimezoneOption[]
}

export function isTimezoneInOptions(value: string, options: UsTimezoneOption[]): boolean {
  const trimmed = value.trim()
  return options.some((option) => option.value === trimmed)
}

/** Keep saved value visible when it is inactive or missing from the active list. */
export function buildTimezoneSelectOptions(
  options: UsTimezoneOption[],
  savedTimezone?: string | null
): UsTimezoneOption[] {
  const saved = savedTimezone?.trim()
  if (!saved || isTimezoneInOptions(saved, options)) return options

  return [{ value: saved, label: saved, region: "Other" }, ...options]
}

export function groupTimezoneOptionsByRegion(options: UsTimezoneOption[]): TimezoneRegionGroup[] {
  const regionOrder = new Map<string, number>()
  const grouped = new Map<string, UsTimezoneOption[]>()

  for (const option of options) {
    const order =
      option.region === "Other"
        ? -1
        : typeof option.regionSortOrder === "number"
          ? option.regionSortOrder
          : Number.MAX_SAFE_INTEGER

    if (!regionOrder.has(option.region) || (regionOrder.get(option.region) ?? 0) > order) {
      regionOrder.set(option.region, order)
    }

    const bucket = grouped.get(option.region) ?? []
    bucket.push(option)
    grouped.set(option.region, bucket)
  }

  return [...grouped.entries()]
    .sort((a, b) => {
      const sortA = regionOrder.get(a[0]) ?? Number.MAX_SAFE_INTEGER
      const sortB = regionOrder.get(b[0]) ?? Number.MAX_SAFE_INTEGER
      if (sortA !== sortB) return sortA - sortB
      return a[0].localeCompare(b[0])
    })
    .map(([region, regionOptions]) => ({
      region,
      options: [...regionOptions].sort((a, b) => {
        const sortA = a.sortOrder ?? Number.MAX_SAFE_INTEGER
        const sortB = b.sortOrder ?? Number.MAX_SAFE_INTEGER
        if (sortA !== sortB) return sortA - sortB
        return a.label.localeCompare(b.label)
      }),
    }))
}

/** @deprecated Use groupTimezoneOptionsByRegion */
export function timezoneRegionsForOptions(options: UsTimezoneOption[]): string[] {
  return groupTimezoneOptionsByRegion(options).map((group) => group.region)
}
