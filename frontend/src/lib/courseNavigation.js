// src/lib/courseNavigation.js
// Utility for computing next/previous module items and deep-link hrefs

/**
 * Map a module item to its correct student route.
 *
 * Materials   → full-page reader  (route exists: /materials/[materialId])
 * Assignments → list page + auto-open via ?open=ID
 * Quizzes     → list page + auto-start via ?start=ID
 */
export function itemHref(courseId, item) {
  if (item.type === 'material')   return `/student/courses/${courseId}/materials/${item.refId}`
  if (item.type === 'assignment') return `/student/courses/${courseId}/assignments?open=${item.refId}`
  if (item.type === 'quiz')       return `/student/courses/${courseId}/quiz?start=${item.refId}`
  return '#'
}

/**
 * Flatten all module items into a single ordered list.
 * Skips modules with no items.
 */
export function flattenModuleItems(modules) {
  const flat = []
  for (const mod of modules) {
    if (!mod.items || mod.items.length === 0) continue
    for (const item of mod.items) {
      flat.push({ item, moduleTitle: mod.title })
    }
  }
  return flat
}

/**
 * Given modules, the current item's refId and type, find prev and next entries.
 *
 * Returns: { prev, next }
 * Each is { item, moduleTitle, title, href } or null.
 */
export function getNextAndPrevious(modules, currentRefId, currentType, courseId) {
  const flat = flattenModuleItems(modules)
  const idx  = flat.findIndex(
    ({ item }) =>
      String(item.refId) === String(currentRefId) && item.type === currentType
  )
  if (idx === -1) return { prev: null, next: null }

  const build = (entry) => {
    if (!entry) return null
    const { item, moduleTitle } = entry
    return {
      item,
      moduleTitle,
      title: item.title || item.ref?.title || `${item.type} #${item.refId}`,
      href:  itemHref(courseId, item),
    }
  }

  return {
    prev: build(flat[idx - 1] ?? null),
    next: build(flat[idx + 1] ?? null),
  }
}