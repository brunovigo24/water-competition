const KEY_LAST_GROUP = "watercup:lastGroupId";

export function setLastGroupId(groupId: string) {
  try {
    localStorage.setItem(KEY_LAST_GROUP, groupId);
  } catch {
    // ignore
  }
}

export function getLastGroupId(): string | null {
  try {
    return localStorage.getItem(KEY_LAST_GROUP);
  } catch {
    return null;
  }
}

