import { useState } from 'react';
import { ChevronDown, ChevronUp, CircleDot, Cloud, Eclipse, Hand, Navigation, Orbit, RotateCcw, Sparkles, Waves, X, Zap } from 'lucide-react';
import { LAB_TOOLS, type LabState, type LabTool } from './CosmicLab';
import './cosmicLab.css';

const icons = { hand: Hand, hole: Eclipse, nebula: Cloud, plasma: Zap, galaxy: Orbit, echo: Sparkles, portal: CircleDot, wave: Waves, sail: Navigation };

export function CosmicLabPanel({ state, onCommand }: {
  state: LabState;
  onCommand: (command: LabTool | 'clear' | 'exit') => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <section className={`mo-cosmic-lab${collapsed ? ' is-collapsed' : ''}`} data-lab-ui="true" aria-label="Laboratorio cósmico" data-tool={state.tool}>
      <header className="mo-lab-heading">
        <div><span className="mo-lab-led" /><strong>Laboratorio cósmico</strong><span className="mo-lab-tag">EXPERIMENTOS</span></div>
        <div className="mo-lab-actions">
          <button type="button" onClick={() => onCommand('clear')} aria-label="Limpiar experimentos" title="Limpiar · 8"><RotateCcw size={15} /><span>Limpiar</span><kbd>8</kbd></button>
          <button type="button" onClick={() => setCollapsed(value => !value)} aria-label={collapsed ? 'Mostrar herramientas' : 'Ocultar herramientas'} aria-expanded={!collapsed} aria-controls="mo-lab-tools">{collapsed ? <ChevronUp size={17} /> : <ChevronDown size={17} />}</button>
          <button type="button" onClick={() => onCommand('exit')} aria-label="Salir del laboratorio" title="Salir del laboratorio"><X size={17} /></button>
        </div>
      </header>
      {!collapsed && <>
        <div className="mo-lab-tools" id="mo-lab-tools" role="group" aria-label="Fenómenos espaciales">
          {LAB_TOOLS.map(tool => {
            const Icon = icons[tool.id];
            return <button type="button" key={tool.id} className={`mo-lab-tool mo-lab-tool-${tool.id}`} aria-pressed={state.tool === tool.id} onClick={() => onCommand(tool.id)} title={tool.hint}>
              <span className="mo-lab-tool-top"><Icon size={20} strokeWidth={1.4} /><kbd>{tool.key}</kbd></span>
              <span>{tool.name}</span>
            </button>;
          })}
        </div>
        <p className="mo-lab-hint" role="status" aria-live="polite"><span className={state.pendingPortal ? 'is-pending' : ''} />{state.hint}</p>
        <footer className="mo-lab-footer"><span>Selecciona un fenómeno y pulsa en el cielo</span><span>Esc cancela / sale · Q/E velocidad</span></footer>
      </>}
    </section>
  );
}
