// Addresses of the service pages, apart from their schema: the header and footer link to them on every page,
// and importing the schema there would put zod into the page script.
// The list of services; English lives at /en/services/.
export const SERVICES = '/services/';
export const servicePath = (name: string) => `${SERVICES}${name}/`;
