import { ContactsPage } from '@/components/concepts/ContactsPage';
import { CONTACTS } from '@/lib/contacts';
import { UI } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({ locale: 'en', path: CONTACTS, title: UI.en.contact, description: UI.en.contactsAbout });

export default function ContactsEn() {
  return <ContactsPage locale="en"/>;
}
