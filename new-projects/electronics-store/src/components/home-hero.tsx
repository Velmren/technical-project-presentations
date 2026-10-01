'use client';

import Link from 'next/link';
import {useEffect, useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {useReducedMotionPreference} from '@/lib/use-reduced-motion';
import {ArrowRight, ChevronLeft, ChevronRight, CreditCard, Pause, Play, ShieldCheck, Truck} from 'lucide-react';

const slides = [
  {id:'everyday', label:'Технологии ближе', title:'Больше,', emphasis:'чем гаджеты.', text:'Для больших идей, любимой музыки и каждого дня. Найдите технику, с которой вам по пути.', href:'/catalog', action:'Найти свою технику', caption:'Для вашей цифровой жизни', alt:'iPhone 13 Pro, MacBook Pro и AirPods — настоящая техника для каждого дня'},
  {id:'work', label:'Пространство для идей', title:'Ваши идеи.', emphasis:'Без границ.', text:'От первой заметки до большого проекта. Ноутбуки, с которыми хочется создавать больше.', href:'/category/laptops', action:'Выбрать ноутбук', caption:'Работайте. Создавайте. Вдохновляйтесь.', alt:'MacBook Pro с открытым дисплеем и оригинальными обоями Apple'},
  {id:'sound', label:'Время услышать больше', title:'Включите', emphasis:'свой мир.', text:'Любимые треки, тишина большого города и детали, которых вы раньше не замечали.', href:'/category/audio', action:'Найти свой звук', caption:'Каждая деталь имеет звучание', alt:'Серебристые полноразмерные наушники AirPods Max и беспроводные AirPods'},
];

export function HomeHero() {
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const reducedMotion = useReducedMotionPreference();
  const stopped = paused || hovered || focused || hidden || reducedMotion !== false;
  const current = slides[slide];

  useEffect(() => {
    const update = () => setHidden(document.hidden);
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  useEffect(() => {
    if (stopped) return;
    const timer = window.setTimeout(() => setSlide(index => (index + 1) % slides.length), 6500);
    return () => window.clearTimeout(timer);
  }, [slide, stopped]);

  const changeSlide = (offset:number) => setSlide(index => (index + offset + slides.length) % slides.length);
  const duration = reducedMotion ? 0 : .48;

  return <section
    className={`hero storefront-hero hero-theme-${current.id}`}
    aria-roledescription="карусель"
    aria-label="Предложения магазина"
    onMouseEnter={() => setHovered(true)}
    onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)}
    onBlurCapture={event => {if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);}}
  >
    <div className="hero-stage" aria-live={stopped ? 'polite' : 'off'} aria-atomic="true">
      <AnimatePresence initial={false} mode="sync">
        <motion.div key={current.id} className="hero-slide" role="group" aria-roledescription="слайд" aria-label={`${slide + 1} из ${slides.length}`}
          initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0, pointerEvents:'none'}} transition={{duration}}
        >
          <motion.div className="hero-copy" initial={{transform:reducedMotion ? 'none' : 'translateY(12px)'}} animate={{transform:'translateY(0px)'}} exit={{transform:reducedMotion ? 'none' : 'translateY(-8px)'}} transition={{duration, ease:[.22,1,.36,1]}}>
            <span className="hero-label">{current.label}</span>
            <h1>{current.title}<br/><em>{current.emphasis}</em></h1>
            <p>{current.text}</p>
            <Link href={current.href} className="button">{current.action}<ArrowRight size={18}/></Link>
          </motion.div>
          <motion.div className={`hero-art hero-composition-${current.id}`} role="img" aria-label={current.alt}
            initial={{transform:reducedMotion ? 'none' : 'translateX(22px) scale(.98)'}} animate={{transform:'translateX(0px) scale(1)'}} exit={{transform:reducedMotion ? 'none' : 'translateX(-12px) scale(.99)'}} transition={{duration:reducedMotion ? 0 : .65, ease:[.22,1,.36,1]}}
          >
            <div className="hero-orbit"/>
            <div className="hero-plinth"/>
            {current.id !== 'sound' && <img className="scene-laptop" src="/media/hero-laptop.webp" alt="" fetchPriority="high"/>}
            {current.id === 'everyday' && <img className="scene-phone" src="/media/hero-phone-v2.png" alt="" fetchPriority="high"/>}
            {current.id === 'sound' && <img className="scene-headphones" src="/media/hero-headphones.webp" alt=""/>}
            {current.id !== 'work' && <img className="scene-earbuds" src="/media/hero-earbuds.webp" alt=""/>}
            <span className="scene-caption">{current.caption}</span>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
    <div className="hero-perks"><span><Truck/>Доставка<br/>на ваш выбор</span><span><ShieldCheck/>Помощь<br/>после покупки</span><span><CreditCard/>Удобная<br/>оплата</span></div>
    <div className="hero-controls">
      <div className="hero-dots" aria-label="Выбор предложения">{slides.map((item,index) => <button key={item.id} aria-label={`Показать предложение: ${item.label}`} aria-current={slide === index ? 'true' : undefined} onClick={() => setSlide(index)}><i/></button>)}</div>
      <button aria-label="Предыдущий баннер" onClick={() => changeSlide(-1)}><ChevronLeft size={18}/></button>
      <button aria-label="Следующий баннер" onClick={() => changeSlide(1)}><ChevronRight size={18}/></button>
      <span className="hero-page-number"><b>0{slide+1}</b> / 03</span>
      {!reducedMotion && <button className="hero-playback" aria-label={paused ? 'Включить автоматическую смену баннеров' : 'Приостановить автоматическую смену баннеров'} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? <Play size={16}/> : <Pause size={16}/>}</button>}
    </div>
  </section>;
}
