// Interface texts of the video pages and the player, in both languages.
import type { Locale } from '@/lib/i18n';
import type { SectionId } from '@/lib/videos';

export const VIDEO_UI = {
  ru: {
    gallery: 'Видео', allVideos: 'Все видео', all: 'Все', sectionsLabel: 'Разделы',
    galleryAbout: 'Реклама, промо, трейлеры и заставки VELMREN. У каждого ролика своя ссылка.',
    next: 'Дальше', collection: 'Подборка', inCollection: 'В подборке', openAlone: 'Открыть отдельно',
    // 1 ролик, 2 ролика, 5 роликов, 21 ролик.
    clips: (count: number) => `${count} ${count % 10 === 1 && count % 100 !== 11 ? 'ролик' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'ролика' : 'роликов'}`,
    sections: { promo: 'Реклама и промо', games: 'Игры и трейлеры', motion: 'Моушен и заставки', '3d': '3D', editing: 'Монтаж' } as Record<SectionId, string>,
    vertical: 'Вертикальные',
    copyLink: 'Скопировать ссылку', copied: 'Ссылка скопирована', copyFailed: 'Не удалось скопировать. Адрес в строке браузера',
    fromTime: (time: string) => `Ссылка с ${time}`, fromTimeHint: 'Скопированная ссылка откроет ролик с этого момента',
    format: 'Формат кадра', sound: 'Звук и музыка', workPage: 'Страница работы',
    player: (title: string) => `Плеер: ${title}`,
    watch: 'Смотреть', play: 'Продолжить', pause: 'Пауза', replay: 'Смотреть ещё раз',
    mute: 'Выключить звук', unmute: 'Включить звук', volume: 'Громкость', percent: (value: number) => `${value} процентов`,
    seek: 'Позиция в ролике', position: (now: string, all: string) => `${now} из ${all}`,
    captionsOn: 'Показать субтитры', captionsOff: 'Скрыть субтитры', captionsLabel: 'Русские',
    fullscreen: 'На весь экран', exitFullscreen: 'Выйти из полного экрана',
    failed: 'Ролик не загрузился.', openFile: 'Открыть файл',
  },
  en: {
    gallery: 'Video', allVideos: 'All videos', all: 'All', sectionsLabel: 'Sections',
    galleryAbout: 'Ads, promos, trailers and idents by VELMREN. Every video has its own link.',
    next: 'Next', collection: 'Collection', inCollection: 'In this collection', openAlone: 'Open on its own page',
    clips: (count: number) => `${count} ${count === 1 ? 'video' : 'videos'}`,
    sections: { promo: 'Ads and promos', games: 'Games and trailers', motion: 'Motion and idents', '3d': '3D', editing: 'Editing' } as Record<SectionId, string>,
    vertical: 'Vertical',
    copyLink: 'Copy link', copied: 'Link copied', copyFailed: 'Could not copy. The address is in the browser bar',
    fromTime: (time: string) => `Link from ${time}`, fromTimeHint: 'The copied link will open the video at this moment',
    format: 'Frame format', sound: 'Sound and music', workPage: 'Project page',
    player: (title: string) => `Player: ${title}`,
    watch: 'Watch', play: 'Resume', pause: 'Pause', replay: 'Watch again',
    mute: 'Mute', unmute: 'Unmute', volume: 'Volume', percent: (value: number) => `${value} percent`,
    seek: 'Position in the video', position: (now: string, all: string) => `${now} of ${all}`,
    captionsOn: 'Show subtitles', captionsOff: 'Hide subtitles', captionsLabel: 'English',
    fullscreen: 'Full screen', exitFullscreen: 'Exit full screen',
    failed: 'The video did not load.', openFile: 'Open the file',
  },
} as const satisfies Record<Locale, unknown>;
