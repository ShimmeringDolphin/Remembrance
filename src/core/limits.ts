/** Most points kept in one category. Keeps reminders short enough to read at a glance. */
export const MAX_POINTS_PER_CATEGORY = 15;

/** `count` is the number of points in the category that are not archived. */
export const canAddPoint = (count: number): boolean => count < MAX_POINTS_PER_CATEGORY;
