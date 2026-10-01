import { useRef, useState, useEffect, useId } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, ArrowRight, ShoppingBag, X, Plus, Minus, Check, ChevronDown, BatteryCharging, Radio, Usb } from 'lucide-react';
import { models, price, type Item, type Model } from './products';
import { translate, restoreLanguage, type Language } from './i18n';
import './style.css';
const colours = ['Cobalt', 'Chalk', 'Graphite'] as const;
type Colour = typeof colours[number];
type Selection = { modelId: string; colour: Colour; quantity: number };
type Enquiry = Selection & { name: string; email: string; space: string };
const initial: Selection = { modelId: 'one', colour: 'Cobalt', quantity: 1 };
function restore(): Selection {
  try { const s = JSON.parse(localStorage.getItem('sono.selection.v1') || 'null'); if (s && models.some(m => m.id === s.modelId) && colours.includes(s.colour) && Number.isInteger(s.quantity) && s.quantity >= 1 && s.quantity <= 4) return s; } catch {}
  return initial;
}
function Product({ colour = 'Cobalt', className = '', alt }: {colour?: Colour; className?: string; alt: string}) {
  return <img src="./speaker.webp" className={`product-image tone-${colour.toLowerCase()} ${className}`} alt={alt} width="1024" height="1024"/>;
}
function LanguagePicker({language, onChange}: {language: Language; onChange: (language: Language) => void}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const options = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId(), languages: Language[] = ['ru','en'];
  function close(restoreFocus = false) {
    if (restoreFocus) trigger.current?.focus();
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    options.current[languages.indexOf(language)]?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return <div className="language-picker" ref={root} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
  }}>
    <button type="button" className="language-trigger" ref={trigger} aria-label={translate(language,'language')}
      aria-haspopup="menu" aria-expanded={open} aria-controls={menuId}
      onClick={() => setOpen(value => !value)} onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); }
        if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(true); }
      }}>
      <span aria-hidden="true">{language.toUpperCase()}</span><ChevronDown aria-hidden="true"/>
    </button>
    <div className="language-menu" id={menuId} role="menu" aria-label={translate(language,'language')}
      aria-hidden={!open} inert={!open} data-open={open} onKeyDown={event => {
        const index = options.current.indexOf(document.activeElement as HTMLButtonElement);
        const destinations: Record<string,number> = {ArrowDown:(index+1)%2,ArrowUp:(index+1)%2,Home:0,End:1};
        if (event.key in destinations) { event.preventDefault(); options.current[destinations[event.key]]?.focus(); }
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
        if (event.key === 'Tab') close(true);
      }}>
      {languages.map((value,index) => <button key={value} ref={element => {options.current[index] = element;}}
        type="button" role="menuitemradio" aria-checked={language === value} tabIndex={open ? 0 : -1}
        lang={value} onClick={() => {onChange(value); close(true);}}>
        <span>{value === 'ru' ? 'Русский' : 'English'}</span>
        <Check aria-hidden="true" className={language === value ? 'selected' : ''}/>
      </button>)}
    </div>
  </div>;
}
function App() {
  const [language, setLanguage] = useState<Language>(restoreLanguage);
  const t = (key: Parameters<typeof translate>[1], values?: Record<string,string|number>) => translate(language,key,values);
  const money = (n: number) => price(n,language);
  const colourName = (c: string) => t(c.toLowerCase() as 'cobalt'|'chalk'|'graphite');
  const usage = (m: Model) => t(m.id === 'one' ? 'oneUse' : 'plusUse');
  const [selection, setSelection] = useState(restore);
  const model = models.find(m => m.id === selection.modelId)!;
  const { colour, quantity } = selection;
  const [items, setItems] = useState<Item[]>([]);
  const [compare, setCompare] = useState(false);
  const [errors, setErrors] = useState<{name?: boolean; email?: boolean}>({});
  const [result, setResult] = useState<Enquiry | null>(null);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const dialog = useRef<HTMLDialogElement>(null), summary = useRef<HTMLDivElement>(null), trigger = useRef<HTMLElement | null>(null);
  const count = items.reduce((s,i) => s+i.quantity,0), total = items.reduce((s,i) => s+i.quantity*i.model.price,0);
  useEffect(() => { try { localStorage.setItem('sono.selection.v1',JSON.stringify(selection)); } catch { setStorageAvailable(false); } },[selection]);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = translate(language,'title');
    document.querySelector('meta[name="description"]')?.setAttribute('content',translate(language,'description'));
    try { localStorage.setItem('sono.language.v1',language); } catch { setStorageAvailable(false); }
  },[language]);
  function configure(patch: Partial<Selection>) { setSelection(s => ({...s,...patch})); setResult(null); }
  function openBag() { trigger.current = document.activeElement as HTMLElement; dialog.current?.showModal(); document.body.style.overflow = 'hidden'; }
  function closeBag() { dialog.current?.close(); }
  function add() { setItems(prev => { const match = prev.find(i => i.model.id === model.id && i.color === colour); return match ? prev.map(i => i === match ? {...i,quantity:i.quantity+quantity} : i) : [...prev,{model,color:colour,quantity}]; }); openBag(); }
  function adjust(index: number, delta: number) { setItems(prev => prev.flatMap((item,i) => i !== index ? [item] : item.quantity+delta > 0 ? [{...item,quantity:item.quantity+delta}] : [])); }
  function enquire(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const d = new FormData(event.currentTarget), name = String(d.get('name')||'').trim(), email = String(d.get('email')||'').trim(), space = String(d.get('space')||'').trim();
    const next = {...(name.length < 2 ? {name:true} : {}), ...(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? {email:true} : {})};
    setErrors(next); setResult(null); if (Object.keys(next).length) { requestAnimationFrame(() => summary.current?.focus()); return; }
    setResult({...selection,name,email,space});
  }
  const resultModel = result ? models.find(m => m.id === result.modelId)! : null;
  return <>
    <a className="skip-link" href="#main">{t('skip')}</a>
    <header>
      <a href="#" className="logo" aria-label={t('home')}>SONO<span>●</span></a>
      <nav aria-label={t('nav')}><a href="#sound">{t('speaker')}</a><a href="#models">{t('models')}</a><a href="#setup">{t('setup')}</a></nav>
      <div className="header-actions"><LanguagePicker language={language} onChange={setLanguage}/><button className="bagbutton" aria-label={t('openBag',{count})} onClick={openBag}><ShoppingBag aria-hidden="true"/><span className="bag-label">{t('bag')}</span><span className="bagcount">{count}</span></button></div>
    </header>
    <main id="main">
      <section className="hero" id="sound">
        <div className="herocopy"><div className="eyebrow">{t('eyebrow')}</div><h1>{t('hero1')}<br/>{t('hero2')}</h1><p>{t('intro1')}<br/>{t('intro2')}</p><a className="button primary" href="#setup">{t('build')} <ArrowUpRight aria-hidden="true"/></a><div className="heronote"><span>{t('from')} {money(models[0].price)}</span></div></div>
        <figure className="heroimage"><Product alt={t('heroAlt')}/><figcaption className="imagecaption"><span>SONO One / {colourName('Cobalt')}</span><span>{t('render')}</span></figcaption></figure>
      </section>
      <section className="features" aria-label={t('conceptSpecs')}><div><BatteryCharging aria-hidden="true"/><strong>{t('batteryFeature')}</strong><small>{t('batteryNote')}</small></div><div><Usb aria-hidden="true"/><strong>{t('usbFeature')}</strong><small>{t('usbNote')}</small></div><div><Radio aria-hidden="true"/><strong>{t('stereoFeature')}</strong><small>{t('stereoNote')}</small></div></section>
      <section id="models" className="models">
        <div className="sectionheading"><div><div className="eyebrow">{t('fit')}</div><h2>{t('rhythm')}</h2></div><p>{t('modelsIntro1')}<br/>{t('modelsIntro2')}</p></div>
        <div className="modelgrid">{models.map(m => <button key={m.id} className={`model ${model.id===m.id?'selected':''}`} aria-label={`${t('choose',{model:m.name})}, ${money(m.price)}`} aria-pressed={model.id===m.id} onClick={() => configure({modelId:m.id})}>
          <div className="modelvisual"><Product className={m.id==='one'?'small-model':''} alt={t('modelAlt',{model:m.name})}/><span>{t(m.id==='one'?'compact':'fuller')}</span></div>
          <div className="modeltitle"><h3>{m.name}</h3><span>{money(m.price)}</span></div><p>{t(m.id==='one'?'oneCaption':'plusCaption')}</p><div className="modelspec"><span>{m.power} {t('watts')} · {t('output')}</span><span>{m.battery} {t('hours')} · {t('battery')}</span><span>{m.weight} {t('grams')}</span></div>
          <div className="selectlabel">{model.id===m.id?<><Check aria-hidden="true"/>{t('selected')}</>:<>{t('choose',{model:m.name})}<ArrowRight aria-hidden="true"/></>}</div>
        </button>)}</div>
        <button className="compare" aria-expanded={compare} aria-controls="comparison" onClick={() => setCompare(!compare)}>{t('compare')} <ChevronDown aria-hidden="true" className={compare?'rotated':''}/></button>
        {compare&&<div className="comparisontable" id="comparison" tabIndex={0} role="region" aria-label={t('scrollCompare')}><table><caption>{t('tableCaption')}</caption><thead><tr><th scope="col">{t('spec')}</th>{models.map(m=><th scope="col" key={m.id}>{m.name}</th>)}</tr></thead><tbody>{[[t('outputSpec'),...models.map(m=>`${m.power} ${t('watts')}`)],[t('batterySpec'),...models.map(m=>`${m.battery} ${t('hours')}`)],[t('weightSpec'),...models.map(m=>`${m.weight} ${t('grams')}`)],[t('dimensionsSpec'),...models.map(m=>`${m.dimensions.join(' × ')} ${t('mm')}`)],[t('madeFor'),...models.map(usage)]].map(row=><tr key={row[0]}>{row.map((c,i)=>i===0?<th scope="row" key={i}>{c}</th>:<td key={i}>{c}</td>)}</tr>)}</tbody></table></div>}
      </section>
      <section id="setup" className="setup">
        <div><div className="eyebrow">{t('own')}</div><h2>{t('own1')}<br/>{t('own2')}</h2><p>{t('ownIntro1')}<br/>{t('ownIntro2')}</p></div>
        <div className="config"><div className="configtop"><h3>{model.name}</h3><strong>{money(model.price)} <small>{t('each')}</small></strong></div><p>{usage(model)}</p><div className="config-preview"><Product colour={colour} alt={t('finishAlt',{model:model.name,colour:colourName(colour)})}/><span>{t('finishPreview')} · {colourName(colour)}</span></div>
          <fieldset><legend>{t('finish')} <span>/ {colourName(colour)}</span></legend><div className="finish-options">{colours.map(c=><button key={c} type="button" className={`finish-option ${colour===c?'chosen':''}`} aria-pressed={colour===c} onClick={()=>configure({colour:c})}><span className={`swatch ${c.toLowerCase()}`}>{colour===c&&<Check aria-hidden="true"/>}</span>{colourName(c)}</button>)}</div></fieldset>
          <div className="quantity"><div><span>{t('speakers')}</span><small>{t(quantity===2?'pair':'limit')}</small></div><div className="stepper"><button aria-label={t('decrease')} disabled={quantity===1} onClick={()=>configure({quantity:quantity-1})}><Minus aria-hidden="true"/></button><output aria-live="polite" aria-label={t('quantity')}>{quantity}</output><button aria-label={t('increase')} disabled={quantity===4} onClick={()=>configure({quantity:quantity+1})}><Plus aria-hidden="true"/></button></div></div>
          <div className="configuration-total" aria-live="polite"><span>{t('total')} <small>{quantity} × {model.name} / {colourName(colour)}</small></span><strong>{money(model.price*quantity)}</strong></div><button className="button primary add" onClick={add}>{t('add')} <ArrowUpRight aria-hidden="true"/></button><small className="storage-note">{t(storageAvailable?'saved':'unsaved')}</small><button className="reset" onClick={()=>{setSelection(initial);setResult(null)}}>{t('reset')}</button>
        </div>
      </section>
      <section className="enquiry" id="enquiry"><div><div className="eyebrow">{t('talk')}</div><h2>{t('contact1')}<br/>{t('contact2')}</h2><p>{t('contactIntro1')}<br/>{t('contactIntro2')}</p><div className="form-note">{t('formNote')}</div></div>
        <form onSubmit={enquire} onChange={()=>setResult(null)} noValidate>
          <label htmlFor="name">{t('name')}</label><input id="name" name="name" placeholder={t('namePlaceholder')} autoComplete="name" required minLength={2} maxLength={100} aria-invalid={!!errors.name} aria-describedby={errors.name?'name-error':undefined}/>{errors.name&&<p className="field-error" id="name-error">{t('nameError')}</p>}
          <label htmlFor="email">{t('email')}</label><input id="email" name="email" type="email" placeholder="alex@example.com" autoComplete="email" required maxLength={254} aria-invalid={!!errors.email} aria-describedby={errors.email?'email-error':undefined}/>{errors.email&&<p className="field-error" id="email-error">{t('emailError')}</p>}
          <label htmlFor="space">{t('space')} <span>{t('optional')}</span></label><textarea id="space" name="space" placeholder={t('spacePlaceholder')} rows={2} maxLength={1000}/>
          {Object.keys(errors).length>0&&<div className="error-summary" role="alert" tabIndex={-1} ref={summary}><strong>{t('checkContact')}</strong>{errors.name&&<a href="#name">{t('nameError')}</a>}{errors.email&&<a href="#email">{t('emailError')}</a>}</div>}
          <button className="button dark" type="submit">{t('preview')} <ArrowUpRight aria-hidden="true"/></button>
          {result&&resultModel&&<div className="result" role="status"><Check aria-hidden="true"/><div><strong>{t('ready')}</strong><p>{t('prepared',{name:result.name,quantity:result.quantity,model:resultModel.name,colour:colourName(result.colour),price:money(resultModel.price*result.quantity),email:result.email})} {result.space&&`${t('yourSpace',{space:result.space})} `}{t('localResult')}</p></div></div>}
        </form>
      </section>
    </main>
    <footer><a className="logo" href="#" aria-label={t('home')}>SONO<span>●</span></a><p>{t('footer')}</p><small><a className="site-link" href="https://velmren.com/">VELMREN</a></small></footer>
    <dialog ref={dialog} className="bag" aria-labelledby="bag-title" onClose={()=>{document.body.style.overflow='';trigger.current?.focus()}} onClick={e=>{if(e.target===dialog.current)closeBag()}}>
      <div className="baghead"><h2 id="bag-title">{t('yourBag')} <span>({count})</span></h2><button aria-label={t('closeBag')} autoFocus onClick={closeBag}><X aria-hidden="true"/></button></div><div className="bag-language"><LanguagePicker language={language} onChange={setLanguage}/></div><p>{t('bagIntro')}</p>
      {items.length===0?<div className="emptybag"><ShoppingBag aria-hidden="true"/><h3>{t('emptyTitle')}</h3><p>{t('empty')}</p><button className="button primary" onClick={closeBag}>{t('explore')} <ArrowRight aria-hidden="true"/></button></div>:<><div className="bagitems">{items.map((i,index)=><div className="bagitem" key={`${i.model.id}${i.color}`}><Product colour={i.color as Colour} alt={t('bagAlt',{model:i.model.name,colour:colourName(i.color)})}/><div><h3>{i.model.name}</h3><p>{colourName(i.color)} / {money(i.model.price)} {t('perUnit')}</p><div className="bagquantity"><button aria-label={t('removeOne',{model:i.model.name,colour:colourName(i.color)})} onClick={()=>adjust(index,-1)}><Minus aria-hidden="true"/></button><output aria-live="polite" aria-label={t('quantity')}>{i.quantity}</output><button aria-label={t('addOne',{model:i.model.name,colour:colourName(i.color)})} onClick={()=>adjust(index,1)}><Plus aria-hidden="true"/></button></div></div><b>{money(i.quantity*i.model.price)}</b></div>)}</div><div className="subtotal" aria-live="polite"><span>{t('subtotal')}</span><strong>{money(total)}</strong></div><p className="bagdisclaimer">{t('bagNote')}</p><button className="button primary" onClick={closeBag}>{t('continue')} <ArrowRight aria-hidden="true"/></button><button className="reset" onClick={()=>setItems([])}>{t('clear')}</button></>}
    </dialog>
  </>;
}
createRoot(document.getElementById('root')!).render(<App/>);

