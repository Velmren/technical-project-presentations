// The services data, checked once at build time.
import raw from '@/content/services.json';
import { servicesSchema } from './services';

export const services = servicesSchema.parse(raw);
