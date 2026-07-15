// Plain sync helper. MUST live outside any "use server" module — Next wraps
// every export of a "use server" file as an async server action (returning a
// Promise), which silently breaks string use (Map keys, template literals, ===).
export const slugOfArea = (a: string) => a.toLowerCase().replace(/ph/g, "f").replace(/[^a-z]/g, "");
