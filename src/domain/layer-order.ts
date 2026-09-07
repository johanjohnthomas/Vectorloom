export function findCyclicIds(
  ids: readonly number[],
  dependencies: Map<number, Set<number>>,
): Set<number> {
  const cyclic = new Set<number>()
  for (const source of ids) {
    for (const target of dependencies.get(source) ?? []) {
      if (canReach(target, source, dependencies, new Set())) {
        cyclic.add(source)
        cyclic.add(target)
      }
    }
  }
  return cyclic
}

function canReach(
  current: number,
  target: number,
  dependencies: Map<number, Set<number>>,
  visited: Set<number>,
): boolean {
  if (current === target) return true
  if (visited.has(current)) return false
  visited.add(current)
  for (const next of dependencies.get(current) ?? []) {
    if (canReach(next, target, dependencies, visited)) return true
  }
  return false
}

export function topologicalOrder(
  colors: readonly { readonly color: string; readonly id: number; readonly area: number }[],
  dependencies: Map<number, Set<number>>,
): readonly number[] {
  const indegrees = new Map(colors.map(({ id }) => [id, 0]))
  for (const targets of dependencies.values()) {
    for (const target of targets) indegrees.set(target, (indegrees.get(target) ?? 0) + 1)
  }
  const colorById = new Map(colors.map(({ color, id }) => [id, color]))
  const areaById = new Map(colors.map(({ area, id }) => [id, area]))
  const ready = colors.filter(({ id }) => indegrees.get(id) === 0).map(({ id }) => id)
  const ordered: number[] = []
  while (ready.length > 0) {
    ready.sort(
      (left, right) =>
        (areaById.get(right) ?? 0) - (areaById.get(left) ?? 0) ||
        (colorById.get(left) ?? "").localeCompare(colorById.get(right) ?? ""),
    )
    const current = ready.shift()
    if (current === undefined) break
    ordered.push(current)
    for (const target of dependencies.get(current) ?? []) {
      const remaining = (indegrees.get(target) ?? 0) - 1
      indegrees.set(target, remaining)
      if (remaining === 0) ready.push(target)
    }
  }
  return ordered
}
