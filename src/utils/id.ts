/** Short, collision-unlikely id for locally created records. */
export const createId = (): string => Math.random().toString(36).slice(2, 11);
