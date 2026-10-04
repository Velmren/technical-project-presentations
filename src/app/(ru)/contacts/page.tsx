import { ContactsPage } from '@/components/concepts/ContactsPage';
import { CONTACTS } from '@/lib/contacts';
import { UI } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({ locale: 'ru', path: CONTACTS, title: UI.ru.contact, description: UI.ru.contactsAbout });

export default function Contacts() {
  return <ContactsPage locale="ru"/>;
}
