/** Turn snake_case API values into readable labels. */
export function formatSlugLabel(value: string) {
  return value.replace(/_/g, ' ');
}

export function formatOrderId(id: string, tail = 8) {
  return id.length > tail ? `…${id.slice(-tail)}` : id;
}
