/** Case- and accent-insensitive form for search: "Müller" matches "muller". */
export const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
