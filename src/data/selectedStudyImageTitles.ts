import type { Locale } from '../i18n/messages';

const imageTitles: Record<string, Record<string, Record<Locale, string>>> = {
  astroingenieria: {
    'v08.webp': { es: 'Ensamblaje de anillos orbitales', en: 'Assembling orbital rings' },
    '11.webp': { es: 'Construcción de un colector estelar', en: 'Building a stellar collector' },
    'v07.webp': { es: 'Un reflector sobre la Tierra', en: 'A reflector above Earth' },
  },
  iss: {
    'v01.webp': { es: 'Sobre las auroras de la Tierra', en: 'Above Earth’s auroras' },
  },
  'artificial-gravity': {
    'v08.webp': { es: 'La estructura giratoria del hábitat', en: 'The habitat’s rotating structure' },
    'v06.webp': { es: 'Paisaje interior bajo la curvatura', en: 'A landscape beneath the curved interior' },
  },
  'life-support': {
    'v01.webp': { es: 'Huerto y reciclaje de agua', en: 'Growing food and recycling water' },
    'v06.webp': { es: 'Cultivo de algas en biorreactores', en: 'Growing algae in bioreactors' },
  },
  'bernal-sphere': {
    'v12.webp': { es: 'La esfera y sus reflectores', en: 'The sphere and its reflectors' },
    'v13.webp': { es: 'Un valle bajo el cielo curvo', en: 'A valley beneath a curved sky' },
    'v11.webp': { es: 'Mirador sobre la biosfera', en: 'An overlook above the biosphere' },
    'v14.webp': { es: 'Una ventana al paisaje interior', en: 'A window onto the interior landscape' },
  },
  'stanford-torus': {
    'v10.webp': { es: 'El anillo y su núcleo central', en: 'The ring and its central hub' },
    'v11.webp': { es: 'El hábitat visto desde el exterior', en: 'The habitat seen from outside' },
    'v12.webp': { es: 'Costa y nubes bajo el anillo', en: 'Coast and clouds beneath the ring' },
  },
  'oneill-cylinder': {
    'v10-reflejo.webp': { es: 'Vista exterior del cilindro habitado', en: 'An exterior view of the inhabited cylinder' },
    'v09.webp': { es: 'Un paisaje que se curva hacia el cielo', en: 'A landscape curving into the sky' },
    'v11.webp': { es: 'Campos y ferrocarril bajo la tormenta', en: 'Fields and railway beneath the storm' },
  },
  'bishop-ring': {
    'v01.webp': { es: 'Un océano dentro de un anillo abierto', en: 'An ocean inside an open ring' },
  },
  'mckendree-cylinder': {
    'v01.webp': { es: 'El cilindro entre el tráfico orbital', en: 'The cylinder amid orbital traffic' },
    'v14.webp': { es: 'Mar y montañas en el interior', en: 'Sea and mountains inside the habitat' },
    'interior-cinematic-v01.webp': { es: 'Costa bajo la bóveda del cilindro', en: 'A coast beneath the cylinder’s vault' },
  },
  ringworld: {
    'v01.webp': { es: 'Un mar junto a la muralla del anillo', en: 'A sea beside the ring’s retaining wall' },
  },
  'asteroid-habitat': {
    'v05.webp': { es: 'Acceso a una base excavada en roca', en: 'Entrance to a base carved into rock' },
    'v06.webp': { es: 'Terrazas de cultivo en la cavidad central', en: 'Growing terraces in the central cavern' },
    'v07.webp': { es: 'Un lago dentro del asteroide', en: 'A lake inside the asteroid' },
  },
};

export const selectedStudyImageTitle = (conceptId: string, src: string, locale: Locale) => {
  const filename = src.split(/[?#]/)[0].split('/').pop() ?? '';
  return imageTitles[conceptId]?.[filename]?.[locale];
};
