/** Count how many cards contain each tag, counting a tag at most once per card. */
export function countTagsByCard(
  tagsByCard: Iterable<Iterable<string>>,
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const cardTags of tagsByCard) {
    for (const tag of new Set(cardTags)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return counts;
}
