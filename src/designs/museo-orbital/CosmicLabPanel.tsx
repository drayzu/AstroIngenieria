import { useLocale } from '../../i18n/LocaleProvider';
import { LanguageSwitch } from '../../i18n/LanguageSwitch';
import { translateLabHint } from './lab/messages';
import { useState, type CSSProperties } from 'react';
import { ChevronDown, ChevronUp, Hand, Repeat2, RotateCcw, Search, Star, X } from 'lucide-react';
import { LAB_TOOLS, type LabState, type LabTool, type LabCommand } from './CosmicLab';
import './cosmicLab.css';
const FAVORITES_KEY = 'museo-orbital:lab-favorites:v1';
const filters = ['Nuevos', 'Todos', 'Favoritos', 'Luz', 'Materia', 'Estrellas', 'Estructuras'];
const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function readFavorites(): LabTool[] {
  try { const saved: unknown = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]'); return Array.isArray(saved) ? saved.filter((id): id is LabTool => typeof id === 'string' && LAB_TOOLS.some(t => t.id === id && id !== 'hand')) : []; }
  catch { return []; }
}
export function CosmicLabPanel({ state, onCommand }: { state: LabState; onCommand: (command: LabCommand) => void }) {
  const { locale, t } = useLocale();
  const [collapsed, setCollapsed] = useState(false);
  const [filter, setFilter] = useState('Nuevos');
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState<LabTool[]>(readFavorites);
  const toggleFavorite = (id: LabTool) => {
    const next = favorites.includes(id) ? favorites.filter(t => t !== id) : [...favorites, id];
    setFavorites(next); try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); } catch { /* Private sessions keep in-memory favorites. */ }
  };
  const visible = LAB_TOOLS.filter(tool => tool.id !== 'hand' && normalize(t(tool.name)).includes(normalize(query)) && (filter === 'Todos' || filter === 'Nuevos' && tool.fresh || filter === 'Favoritos' && favorites.includes(tool.id) || filter === tool.category));
  const last = LAB_TOOLS.find(t => t.id === state.lastTool);
  return <section className={`mo-cosmic-lab${collapsed ? ' is-collapsed' : ''}`} data-lab-ui="true" aria-label={t("Laboratorio cósmico")} data-tool={state.tool}>
    <header className="mo-lab-heading">
      <div><span className="mo-lab-led" /><strong>{t("Laboratorio cósmico")}</strong><span className="mo-lab-tag">{t("32 FENÓMENOS")}</span></div>
      <div className="mo-lab-actions">
        <LanguageSwitch />
        <button type="button" className="mo-lab-tool-hand" onClick={() => onCommand('hand')} aria-label={t("Explorar")} aria-pressed={state.tool === 'hand'} title={t("Explorar · 0")}><Hand size={15} /><span>{t("Explorar")}</span></button>
        <button type="button" onClick={() => onCommand('clear')} aria-label={t("Limpiar experimentos")} title={t("Limpiar · 8")}><RotateCcw size={15} /><span>{t("Limpiar")}</span></button>
        <button type="button" onClick={() => setCollapsed(v => !v)} aria-label={t(collapsed ? 'Mostrar herramientas' : 'Ocultar herramientas')} aria-expanded={!collapsed} aria-controls="mo-lab-content">{collapsed ? <ChevronUp size={17} /> : <ChevronDown size={17} />}</button>
        <button type="button" onClick={() => onCommand('exit')} aria-label={t("Salir del laboratorio")} title={t("Salir")}><X size={17} /></button>
      </div>
    </header>
    {!collapsed && <>
      <div className="mo-lab-scroll" id="mo-lab-content">
        <div className="mo-lab-discovery">
          <div className="mo-lab-filters" role="group" aria-label={t("Filtrar fenómenos")}>{filters.map(f => <button type="button" key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{t(f)}{f === 'Favoritos' && favorites.length > 0 ? ` ${favorites.length}` : ''}</button>)}</div>
          <label className="mo-lab-search"><Search size={14} /><input type="search" aria-label={t("Buscar fenómeno")} placeholder={t("Buscar fenómeno…")} value={query} onChange={e => setQuery(e.target.value)} /></label>
        </div>
        <div className="mo-lab-tools" role="group" aria-label={t("Fenómenos espaciales")}>
          {visible.map(tool => <div className="mo-lab-card" key={tool.id} style={{ '--lab-accent': tool.color } as CSSProperties}>
            <button type="button" className={`mo-lab-tool mo-lab-tool-${tool.id}`} aria-pressed={state.tool === tool.id} onClick={() => onCommand(tool.id)} title={t(tool.hint)}>
              <span className="mo-lab-tool-top"><span className="mo-lab-glyph" aria-hidden="true">{tool.icon}</span><kbd>{tool.key ?? t(tool.category)}</kbd></span><span>{t(tool.name)}</span>
            </button>
            <div className="mo-lab-card-actions"><button type="button" className="mo-lab-solo" onClick={() => onCommand({ solo: tool.id })} aria-label={t("Probar solo: {0}", t(tool.name))}>{t("Probar solo")}</button><button type="button" className="mo-lab-favorite" aria-label={t("Favorito: {0}", t(tool.name))} aria-pressed={favorites.includes(tool.id)} onClick={() => toggleFavorite(tool.id)}><Star size={13} fill={favorites.includes(tool.id) ? 'currentColor' : 'none'} /></button></div>
          </div>)}
        </div>
        {!visible.length && <p className="mo-lab-empty">{t(filter === 'Favoritos' && !favorites.length ? 'Marca estrellas en las tarjetas para guardar tus favoritos.' : 'No hay fenómenos con ese nombre en este filtro.')}</p>}
      </div>
      <footer className="mo-lab-bottom"><p className="mo-lab-hint" role="status" aria-live="polite">{state.tool !== 'hand' ? t('Colocar · ') : ''}{translateLabHint(state.hint, locale)}</p><button type="button" className="mo-lab-repeat" disabled={!last} onClick={() => onCommand('repeat')} title={last ? t("Repetir: {0}", t(last.name)) : t('Primero elige un fenómeno')}><Repeat2 size={14} /><span>{t("Repetir último")}</span></button></footer>
      <div className="mo-lab-footer"><span>{visible.length} {t("fenómenos · arrastra los tiradores luminosos")}</span><span>{t("Esc cancela / sale · Q/E velocidad")}</span></div>
    </>}
  </section>;
}
