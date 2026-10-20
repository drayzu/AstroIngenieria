# Títulos de escenas v2 · Revisión completa

Se revisaron visualmente las **374 imágenes del catálogo de títulos**, distribuidas en **106 obras**. Incluyen las 356 imágenes listadas actualmente en `selectedStudyImages.ts` y las 18 entradas adicionales ya existentes en `imageTitles`. Se mantienen todas las claves y su orden.

Resultado respecto al catálogo anterior a la primera prueba: **283 pares es/en actualizados** y **91 conservados**. Los títulos de la prueba inicial están incluidos en estas tablas.

Criterio editorial: claridad, naturalidad y fidelidad a la escena. Se identifica el objeto, la máquina o el lugar relevante y su acción o posición; la extensión se adapta al título, sin imponer un límite rígido de palabras. Se conserva el contenido equivalente en español e inglés y se evitan títulos repetidos dentro de cada obra.

Fuentes: imagen web inspeccionada en todos los casos; prompt completo localizado para 345 imágenes. Se siguió la correspondencia archivo web → miniatura en títulos pendientes A/B/C → candidato de `elegir/data.json` → PNG original → `.md` contiguo. Para entradas que no aparecían en esa relación, se consultaron los índices `*-todas.json` y el campo `originalFile`. Se reconoció también el alias de revisión `v'8.webp` para `stellar-engines/v08b.webp`, sin encontrar un prompt contiguo.

De cada prompt se utilizó la descripción del concepto y la escena, ignorando la dirección de arte repetida. Además de `Room and concept:` y `Scene:`, algunos archivos emplean `SCENE:`, `Subject:`, `Room subject:`, una descripción en español o un párrafo específico sin esa etiqueta; se tomó únicamente ese contenido de escena. No se utilizó el campo `prompt` recortado de los JSON de títulos pendientes. Los enlaces «imagen+prompt» llevan al archivo completo consultado.

La imagen prevalece ante diferencias con el prompt. Por ejemplo, los bloques de vidrio de ISRU dejan de llamarse hielo; las superficies de los statites se identifican como velas; y la torre helada de soporte vital se describe sin atribuirle una función técnica no documentada.

Las 29 entradas sin prompt asociado se señalan como «solo imagen» y se enumeran al final. No se transfirió automáticamente el prompt de una imagen a otra variante del catálogo.

## astroingenieria · Astroingeniería

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v08.webp](../../../public/illustrations/selected/astroingenieria/v08.webp) | Ensamblaje de anillos orbitales | Ensamblaje de anillos orbitales | Assembling orbital rings | [imagen+prompt](../00-introduccion/001-astroingenieria/elegida/04.md) |
| [11.webp](../../../public/illustrations/selected/astroingenieria/11.webp) | Construcción de un colector estelar | Construcción de un colector estelar | Building a stellar collector | [imagen+prompt](../00-introduccion/001-astroingenieria/elegida/11.md) |
| [v07.webp](../../../public/illustrations/selected/astroingenieria/v07.webp) | Un reflector sobre la Tierra | Panel de un parasol en construcción | Panel of a sunshade under construction | [imagen+prompt](../00-introduccion/001-astroingenieria/elegida/03.md) |
| [keyframe-tanda-01.webp](../../../public/illustrations/selected/astroingenieria/keyframe-tanda-01.webp) | Arcos en construcción frente a la Tierra | Arcos en construcción frente a la Tierra | Arches under construction facing Earth | [imagen+prompt](../00-introduccion/001-astroingenieria/elegida/06.md) |

## iss · Estaciones espaciales actuales

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v01.webp](../../../public/illustrations/selected/iss/v01.webp) | Sobre las auroras de la Tierra | Estación orbital sobre las auroras terrestres | Orbital station above Earth’s auroras | solo imagen |
| [refb-v02.webp](../../../public/illustrations/selected/iss/refb-v02.webp) | Un módulo abierto hacia la aurora | Laboratorio orbital con una ventana a la aurora | Orbital laboratory with a window onto the aurora | [imagen+prompt](../01-habitats-espaciales/002-iss/elegida/13.md) |
| [v08.webp](../../../public/illustrations/selected/iss/v08.webp) | La estación sobre las nubes | La estación sobre las nubes | The station above the clouds | [imagen+prompt](../01-habitats-espaciales/002-iss/elegida/18.md) |
| [v09.webp](../../../public/illustrations/selected/iss/v09.webp) | Una tormenta eléctrica bajo la estación | Una tormenta eléctrica bajo la estación | A thunderstorm beneath the station | [imagen+prompt](../01-habitats-espaciales/002-iss/elegida/19.md) |

## artificial-gravity · Gravedad artificial por rotación

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v08.webp](../../../public/illustrations/selected/artificial-gravity/v08.webp) | La estructura giratoria del hábitat | Anillo del hábitat visto desde el núcleo | Habitat ring seen from the central hub | [imagen+prompt](../01-habitats-espaciales/003-artificial-gravity/elegida/04.md) |
| [v06.webp](../../../public/illustrations/selected/artificial-gravity/v06.webp) | Paisaje interior bajo la curvatura | Jardines en el interior de un hábitat giratorio | Gardens inside a rotating habitat | [imagen+prompt](../01-habitats-espaciales/003-artificial-gravity/elegida/02.md) |
| [v07.webp](../../../public/illustrations/selected/artificial-gravity/v07.webp) | Módulos atados girando sobre Marte | Módulos atados girando sobre Marte | Tethered modules spinning above Mars | [imagen+prompt](../01-habitats-espaciales/003-artificial-gravity/elegida/03.md) |

## life-support · Ecosistemas cerrados y soporte vital

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v01.webp](../../../public/illustrations/selected/life-support/v01.webp) | Huerto y reciclaje de agua | Huerto y reciclaje de agua | Growing food and recycling water | solo imagen |
| [v06.webp](../../../public/illustrations/selected/life-support/v06.webp) | Cultivo de algas en biorreactores | Cultivo de algas en biorreactores | Growing algae in bioreactors | [imagen+prompt](../01-habitats-espaciales/004-life-support/elegida/05.md) |
| [refb-v04.webp](../../../public/illustrations/selected/life-support/refb-v04.webp) | Columnas de algas bajo la cúpula | Biorreactores de algas bajo la cúpula | Algae bioreactors beneath the dome | [imagen+prompt](../01-habitats-espaciales/004-life-support/elegida/18.md) |
| [v08.webp](../../../public/illustrations/selected/life-support/v08.webp) | Sala de bombas y cultivos hidropónicos | Torre cubierta de hielo en el invernadero | Tower covered in ice inside the greenhouse | solo imagen |

## bernal-sphere · Esfera de Bernal

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v12.webp](../../../public/illustrations/selected/bernal-sphere/v12.webp) | La esfera y sus reflectores | La esfera y sus reflectores | The sphere and its reflectors | [imagen+prompt](../01-habitats-espaciales/005-bernal-sphere/elegida/04.md) |
| [v13.webp](../../../public/illustrations/selected/bernal-sphere/v13.webp) | Un valle bajo el cielo curvo | Lago y ciudades en el interior esférico | Lake and cities inside the spherical habitat | [imagen+prompt](../01-habitats-espaciales/005-bernal-sphere/elegida/05.md) |
| [v11.webp](../../../public/illustrations/selected/bernal-sphere/v11.webp) | Mirador sobre la biosfera | Mirador sobre la biosfera | An overlook above the biosphere | [imagen+prompt](../01-habitats-espaciales/005-bernal-sphere/elegida/03.md) |
| [v14.webp](../../../public/illustrations/selected/bernal-sphere/v14.webp) | Una ventana al paisaje interior | Ventana al interior del hábitat esférico | Window into the spherical habitat | solo imagen |

## stanford-torus · Toro de Stanford

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v10.webp](../../../public/illustrations/selected/stanford-torus/v10.webp) | El anillo y su núcleo central | El anillo y su núcleo central | The ring and its central hub | [imagen+prompt](../01-habitats-espaciales/006-stanford-torus/elegida/04.md) |
| [v11.webp](../../../public/illustrations/selected/stanford-torus/v11.webp) | El hábitat visto desde el exterior | Estación de atraque bajo el anillo habitable | Docking station beneath the inhabited ring | solo imagen |
| [v12.webp](../../../public/illustrations/selected/stanford-torus/v12.webp) | Costa y nubes bajo el anillo | Costa y nubes bajo el anillo | Coast and clouds beneath the ring | solo imagen |
| [refb-v03.webp](../../../public/illustrations/selected/stanford-torus/refb-v03.webp) | Rueda habitada ante los anillos de Saturno | Rueda habitada ante los anillos de Saturno | A habitat wheel against Saturn’s rings | [imagen+prompt](../01-habitats-espaciales/006-stanford-torus/elegida/15.md) |

## oneill-cylinder · Cilindro de O’Neill

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v10-reflejo.webp](../../../public/illustrations/selected/oneill-cylinder/v10-reflejo.webp) | Vista exterior del cilindro habitado | Vista exterior del cilindro habitado | An exterior view of the inhabited cylinder | solo imagen |
| [v09.webp](../../../public/illustrations/selected/oneill-cylinder/v09.webp) | Un paisaje que se curva hacia el cielo | Puente ferroviario sobre los campos del cilindro | Railway bridge above the cylinder’s fields | [imagen+prompt](../01-habitats-espaciales/007-oneill-cylinder/elegida/05.md) |
| [v11.webp](../../../public/illustrations/selected/oneill-cylinder/v11.webp) | Campos y ferrocarril bajo la tormenta | Campos y ferrocarril bajo la tormenta | Fields and railway beneath the storm | solo imagen |
| [keyframe-tanda-03.webp](../../../public/illustrations/selected/oneill-cylinder/keyframe-tanda-03.webp) | Cilindros gemelos sobre un gigante gaseoso | Cilindros gemelos sobre un gigante gaseoso | Twin cylinders above a gas giant | [imagen+prompt](../01-habitats-espaciales/007-oneill-cylinder/elegida/12.md) |

## bishop-ring · Anillo de Bishop

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v01.webp](../../../public/illustrations/selected/bishop-ring/v01.webp) | Un océano dentro de un anillo abierto | Un océano dentro de un anillo abierto | An ocean inside an open ring | solo imagen |
| [keyframe-tanda-04.webp](../../../public/illustrations/selected/bishop-ring/keyframe-tanda-04.webp) | El anillo frente a un gigante gaseoso | El anillo frente a un gigante gaseoso | The ring in front of a gas giant | [imagen+prompt](../01-habitats-espaciales/008-bishop-ring/elegida/11.md) |
| [keyframe-tanda-02.webp](../../../public/illustrations/selected/bishop-ring/keyframe-tanda-02.webp) | Humedal junto a la pared transparente | Humedal junto a la pared transparente | A wetland beside the transparent wall | [imagen+prompt](../01-habitats-espaciales/008-bishop-ring/elegida/09.md) |
| [v09.webp](../../../public/illustrations/selected/bishop-ring/v09.webp) | Valle nocturno junto a la muralla | Delta fluvial junto al muro del anillo | River delta beside the ring wall | [imagen+prompt](../01-habitats-espaciales/008-bishop-ring/elegida/06.md) |

## mckendree-cylinder · Cilindro de McKendree

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v01.webp](../../../public/illustrations/selected/mckendree-cylinder/v01.webp) | El cilindro entre el tráfico orbital | Tráfico de naves entre dos cilindros habitados | Ship traffic between two inhabited cylinders | solo imagen |
| [v14.webp](../../../public/illustrations/selected/mckendree-cylinder/v14.webp) | Mar y montañas en el interior | Mar y montañas dentro del cilindro | Sea and mountains inside the cylinder | solo imagen |
| [interior-cinematic-v01.webp](../../../public/illustrations/selected/mckendree-cylinder/interior-cinematic-v01.webp) | Costa bajo la bóveda del cilindro | Costa bajo la bóveda del cilindro | A coast beneath the cylinder’s vault | solo imagen |
| [v15.webp](../../../public/illustrations/selected/mckendree-cylinder/v15.webp) | Una nave entre dos cilindros | Compuerta abierta al paisaje interior del cilindro | Open hatch revealing the cylinder’s interior landscape | solo imagen |

## asteroid-habitat · Hábitats dentro de asteroides

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v05.webp](../../../public/illustrations/selected/asteroid-habitat/v05.webp) | Acceso a una base excavada en roca | Acceso a una base excavada en roca | Entrance to a base carved into rock | [imagen+prompt](../01-habitats-espaciales/010-asteroid-habitat/elegida/04.md) |
| [v06.webp](../../../public/illustrations/selected/asteroid-habitat/v06.webp) | Terrazas de cultivo en la cavidad central | Terrazas de cultivo en la cavidad central | Crop terraces in the central cavern | [imagen+prompt](../01-habitats-espaciales/010-asteroid-habitat/elegida/05.md) |
| [v07.webp](../../../public/illustrations/selected/asteroid-habitat/v07.webp) | Un lago dentro del asteroide | Depósito de agua excavado en el asteroide | Water reservoir excavated inside the asteroid | [imagen+prompt](../01-habitats-espaciales/010-asteroid-habitat/elegida/06.md) |
| [keyframe-tanda-05.webp](../../../public/illustrations/selected/asteroid-habitat/keyframe-tanda-05.webp) | Una esfera de agua en la caverna | Depósito esférico de agua en la caverna | Spherical water reservoir inside the cavern | [imagen+prompt](../01-habitats-espaciales/010-asteroid-habitat/elegida/12.md) |
| [refb-v05.webp](../../../public/illustrations/selected/asteroid-habitat/refb-v05.webp) | Un robot minero tras el ventanal | Robot de inspección sobre la roca del asteroide | Inspection robot on the asteroid’s rocky surface | [imagen+prompt](../01-habitats-espaciales/010-asteroid-habitat/elegida/17.md) |

## ringworld · Megaestructuras en ciencia ficción

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v01.webp](../../../public/illustrations/selected/ringworld/v01.webp) | Un mar junto a la muralla del anillo | Un mar junto a la muralla del anillo | A sea beside the ring’s retaining wall | [imagen+prompt](../01-habitats-espaciales/011-ringworld/elegida/01.md) |
| [v11.webp](../../../public/illustrations/selected/ringworld/v11.webp) | La muralla del borde sobre el océano | La muralla del borde sobre el océano | The rim wall above the ocean | solo imagen |
| [keyframe-tanda-02.webp](../../../public/illustrations/selected/ringworld/keyframe-tanda-02.webp) | La sombra avanza sobre el salar | Panel de sombra eclipsando el salar | Shadow panel eclipsing the salt flat | [imagen+prompt](../01-habitats-espaciales/011-ringworld/elegida/14.md) |

## reusable-launch · Lanzamiento reutilizable

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v7.webp](../../../public/illustrations/selected/reusable-launch/v7.webp) | Un propulsor recuperado sobre la barcaza | Un propulsor recuperado sobre la barcaza | A recovered booster on the drone ship | solo imagen |
| [v04.webp](../../../public/illustrations/selected/reusable-launch/v04.webp) | Aterrizaje en medio de la tormenta | Propulsor descendiendo hacia una barcaza entre la tormenta | Booster descending toward a barge through the storm | [imagen+prompt](../02-industria-espacial/012-reusable-launch/elegida/02.md) |
| [keyframe-tanda-05.webp](../../../public/illustrations/selected/reusable-launch/keyframe-tanda-05.webp) | La torre atrapa al propulsor | La torre atrapa al propulsor | The tower catches the booster | [imagen+prompt](../02-industria-espacial/012-reusable-launch/elegida/12.md) |

## orbital-ports · Puertos espaciales orbitales

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [refb-v04.webp](../../../public/illustrations/selected/orbital-ports/refb-v04.webp) | Muelles de carga sobre la Tierra | Muelles de carga sobre la Tierra | Cargo docks above Earth | [imagen+prompt](../02-industria-espacial/013-orbital-ports/elegida/14.md) |
| [v07.webp](../../../public/illustrations/selected/orbital-ports/v07.webp) | Una nave atraca frente a la Luna | Una nave atraca frente a la Luna | A ship docking in front of the Moon | [imagen+prompt](../02-industria-espacial/013-orbital-ports/elegida/04.md) |
| [v08.webp](../../../public/illustrations/selected/orbital-ports/v08.webp) | Hangar excavado en un asteroide | Muelles de carga excavados en la roca | Cargo docks excavated into the rock | [imagen+prompt](../02-industria-espacial/013-orbital-ports/elegida/17.md) |

## fuel-depots · Depósitos de combustible orbital

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [refb-v04.webp](../../../public/illustrations/selected/fuel-depots/refb-v04.webp) | Una nave acoplada a los tanques | Nave cisterna conectada al depósito de combustible | Tanker connected to the propellant depot | [imagen+prompt](../02-industria-espacial/014-fuel-depots/elegida/13.md) |
| [refb-v06.webp](../../../public/illustrations/selected/fuel-depots/refb-v06.webp) | Tanques bajo un parasol plegado | Tanques bajo un parasol plegado | Tanks beneath a pleated sunshade | [imagen+prompt](../02-industria-espacial/014-fuel-depots/elegida/15.md) |
| [refb-v03.webp](../../../public/illustrations/selected/fuel-depots/refb-v03.webp) | Tanques esféricos frente a una luna | Tanques esféricos frente a una luna | Spherical tanks facing a moon | [imagen+prompt](../02-industria-espacial/014-fuel-depots/elegida/12.md) |

## lunar-bases · Bases lunares

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [refb-v06.webp](../../../public/illustrations/selected/lunar-bases/refb-v06.webp) | Un puente sobre la grieta lunar | Un puente sobre la grieta lunar | A bridge across a lunar chasm | [imagen+prompt](../02-industria-espacial/015-lunar-bases/elegida/18.md) |
| [refb-v04.webp](../../../public/illustrations/selected/lunar-bases/refb-v04.webp) | Invernadero con vista a la Tierra | Invernadero con vista a la Tierra | A greenhouse overlooking Earth | [imagen+prompt](../02-industria-espacial/015-lunar-bases/elegida/16.md) |
| [v07.webp](../../../public/illustrations/selected/lunar-bases/v07.webp) | Un módulo desciende junto a la base | Módulo de carga descendiendo junto a la base lunar | Cargo lander descending beside the lunar base | [imagen+prompt](../02-industria-espacial/015-lunar-bases/elegida/06.md) |

## isru · Uso de recursos locales (ISRU)

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v04.webp](../../../public/illustrations/selected/isru/v04.webp) | Hielo extraído en la cinta transportadora | Hielo extraído en la cinta transportadora | Mined ice on the conveyor belt | [imagen+prompt](../02-industria-espacial/016-isru/elegida/01.md) |
| [keyframe-tanda-02.webp](../../../public/illustrations/selected/isru/keyframe-tanda-02.webp) | Bloques de hielo al atardecer marciano | Brazo robótico ensamblando un muro de vidrio | Robotic arm assembling a glass wall | [imagen+prompt](../02-industria-espacial/016-isru/elegida/07.md) |
| [v07.webp](../../../public/illustrations/selected/isru/v07.webp) | Ladrillos de regolito recién prensados | Ladrillos de regolito recién prensados | Freshly pressed regolith bricks | [imagen+prompt](../02-industria-espacial/016-isru/elegida/04.md) |

## asteroid-mining · Minería de asteroides

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v05.webp](../../../public/illustrations/selected/asteroid-mining/v05.webp) | Perforación desde el interior de la roca | Taladro robótico excavando una veta del asteroide | Robotic drill excavating an ore vein inside the asteroid | [imagen+prompt](../02-industria-espacial/017-asteroid-mining/elegida/02.md) |
| [v06.webp](../../../public/illustrations/selected/asteroid-mining/v06.webp) | Dos asteroides atrapados en redes | Dos asteroides atrapados en redes | Two asteroids caught in nets | [imagen+prompt](../02-industria-espacial/017-asteroid-mining/elegida/03.md) |
| [keyframe-tanda-05.webp](../../../public/illustrations/selected/asteroid-mining/keyframe-tanda-05.webp) | Una lluvia de rocas bajo el anillo | Colector magnético extrayendo mineral del asteroide | Magnetic collector extracting ore from the asteroid | [imagen+prompt](../02-industria-espacial/017-asteroid-mining/elegida/10.md) |

## shipyards · Astilleros espaciales

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [keyframe-tanda-04.webp](../../../public/illustrations/selected/shipyards/keyframe-tanda-04.webp) | Un anillo suspendido entre dos cascos | Ensamblaje de un módulo anular entre dos cascos | Assembly of a ring module between two hulls | [imagen+prompt](../02-industria-espacial/018-shipyards/elegida/08.md) |
| [keyframe-tanda-02.webp](../../../public/illustrations/selected/shipyards/keyframe-tanda-02.webp) | Una dársena abierta hacia un gigante gaseoso | Astillero orbital con una nave en construcción | Orbital shipyard with a vessel under construction | [imagen+prompt](../02-industria-espacial/018-shipyards/elegida/06.md) |
| [refb-v03.webp](../../../public/illustrations/selected/shipyards/refb-v03.webp) | Brazos robóticos ensamblan el casco | Brazos robóticos ensamblan el casco | Robotic arms assembling a hull | [imagen+prompt](../02-industria-espacial/018-shipyards/elegida/12.md) |

## space-elevator · Ascensor espacial

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v18.webp](../../../public/illustrations/selected/space-elevator/v18.webp) | La base oceánica bajo la tormenta | Cabrestantes del cable en la base oceánica | Cable winches at the ocean base | solo imagen |
| [refb-v02.webp](../../../public/illustrations/selected/space-elevator/refb-v02.webp) | Un escalador sobre las nubes | Escalador del ascensor sobre las nubes | Elevator climber above the clouds | [imagen+prompt](../02-industria-espacial/019-space-elevator/elegida/13.md) |
| [v01.webp](../../../public/illustrations/selected/space-elevator/v01.webp) | El cable sube desde su plataforma en el mar | Cable elevándose desde la plataforma oceánica | Cable rising from the ocean platform | [imagen+prompt](../02-industria-espacial/019-space-elevator/elegida/01.md) |
| [v08.webp](../../../public/illustrations/selected/space-elevator/v08.webp) | La estación del contrapeso sobre la Tierra | La estación del contrapeso sobre la Tierra | The counterweight station above Earth | [imagen+prompt](../02-industria-espacial/019-space-elevator/elegida/05.md) |

## tethers · Cables espaciales (tethers)

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [keyframe-tanda-04.webp](../../../public/illustrations/selected/tethers/keyframe-tanda-04.webp) | Un cable tendido sobre los anillos | Cable orbital liberando una cápsula de carga | Orbital tether releasing a cargo capsule | [imagen+prompt](../02-industria-espacial/020-tethers/elegida/09.md) |
| [keyframe-tanda-05.webp](../../../public/illustrations/selected/tethers/keyframe-tanda-05.webp) | Un cable entre dos asteroides | Un cable entre dos asteroides | A cable between two asteroids | [imagen+prompt](../02-industria-espacial/020-tethers/elegida/10.md) |

## skyhook · Gancho orbital (skyhook)

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [refb-v04.webp](../../../public/illustrations/selected/skyhook/refb-v04.webp) | Traspaso de carga por el cable | Transferencia de una cápsula entre dos garras orbitales | Capsule transfer between two orbital catchers | [imagen+prompt](../02-industria-espacial/021-skyhook/elegida/14.md) |
| [refb-v05.webp](../../../public/illustrations/selected/skyhook/refb-v05.webp) | La garra recibe una cápsula | Cápsula de carga frente a la garra orbital | Cargo capsule facing the orbital catcher | [imagen+prompt](../02-industria-espacial/021-skyhook/elegida/15.md) |

## orbital-ring · Anillo orbital

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [refb-v05.webp](../../../public/illustrations/selected/orbital-ring/refb-v05.webp) | Un túnel de bobinas sobre la Tierra | Carro de inspección entre las bobinas del anillo | Inspection carriage among the ring’s coils | [imagen+prompt](../02-industria-espacial/022-orbital-ring/elegida/14.md) |
| [keyframe-tanda-03.webp](../../../public/illustrations/selected/orbital-ring/keyframe-tanda-03.webp) | Cables que bajan sobre los cultivos | Ascensor de carga descendiendo del anillo orbital | Cargo elevator descending from the orbital ring | [imagen+prompt](../02-industria-espacial/022-orbital-ring/elegida/07.md) |
| [keyframe-tanda-02.webp](../../../public/illustrations/selected/orbital-ring/keyframe-tanda-02.webp) | Una plataforma sobre el huracán | Plataforma de mantenimiento del anillo sobre un huracán | Ring maintenance platform above a hurricane | [imagen+prompt](../02-industria-espacial/022-orbital-ring/elegida/06.md) |

## launch-loop · Bucle de lanzamiento (launch loop)

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [keyframe-tanda-03.webp](../../../public/illustrations/selected/launch-loop/keyframe-tanda-03.webp) | Lanzamiento al atardecer sobre las nubes | Avión espacial lanzado desde la pista elevada | Spaceplane launched from the elevated track | [imagen+prompt](../02-industria-espacial/023-launch-loop/elegida/09.md) |
| [keyframe-tanda-04.webp](../../../public/illustrations/selected/launch-loop/keyframe-tanda-04.webp) | Despegue nocturno bajo la aurora | Avión espacial despegando de la pista sobre el mar | Spaceplane leaving the track above the sea | [imagen+prompt](../02-industria-espacial/023-launch-loop/elegida/10.md) |

## mass-driver · Catapulta electromagnética (mass driver)

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [keyframe-tanda-01.webp](../../../public/illustrations/selected/mass-driver/keyframe-tanda-01.webp) | Lanzamiento sobre el borde del cañón | Cápsula de carga lanzada sobre el cañón lunar | Cargo capsule launched across the lunar canyon | [imagen+prompt](../02-industria-espacial/024-mass-driver/elegida/05.md) |
| [keyframe-tanda-02.webp](../../../public/illustrations/selected/mass-driver/keyframe-tanda-02.webp) | Dentro del túnel de aceleración | Cápsula acelerando entre las bobinas del túnel | Capsule accelerating through the tunnel’s coils | [imagen+prompt](../02-industria-espacial/024-mass-driver/elegida/06.md) |

## space-law · Derecho, economía y política espacial

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v06.webp](../../../public/illustrations/selected/space-law/v06.webp) | Tres astronautas ante una roca en vitrina | Tres astronautas ante una roca en vitrina | Three astronauts facing an encased rock | [imagen+prompt](../02-industria-espacial/025-space-law/elegida/05.md) |
| [v03.webp](../../../public/illustrations/selected/space-law/v03.webp) | Un contenedor suspendido entre dos estaciones | Transbordador de carga entre dos estaciones mineras | Cargo ferry between two mining stations | [imagen+prompt](../02-industria-espacial/025-space-law/elegida/02.md) |

## exoplanets · Exoplanetas

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [keyframe-tanda-05.webp](../../../public/illustrations/selected/exoplanets/keyframe-tanda-05.webp) | Agujas de roca en aguas someras | Agujas de roca en aguas someras | Rock spires in shallow water | [imagen+prompt](../03-ingenieria-planetaria/026-exoplanets/elegida/14.md) |
| [keyframe-tanda-02.webp](../../../public/illustrations/selected/exoplanets/keyframe-tanda-02.webp) | Un mar oscuro bajo un planeta anillado | Un mar oscuro bajo un planeta anillado | A dark sea beneath a ringed planet | [imagen+prompt](../03-ingenieria-planetaria/026-exoplanets/elegida/11.md) |
| [v07.webp](../../../public/illustrations/selected/exoplanets/v07.webp) | Una antena sobre un mundo tormentoso | Sonda sobrevolando un planeta cubierto de tormentas | Probe flying over a planet covered in storms | [imagen+prompt](../03-ingenieria-planetaria/026-exoplanets/elegida/06.md) |

## astrobiology · Astrobiología

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v09.webp](../../../public/illustrations/selected/astrobiology/v09.webp) | Un núcleo de hielo en el laboratorio | Muestra de hielo bajo análisis en el laboratorio | Ice sample under analysis in the laboratory | [imagen+prompt](../03-ingenieria-planetaria/027-astrobiology/elegida/07.md) |
| [keyframe-tanda-05.webp](../../../public/illustrations/selected/astrobiology/keyframe-tanda-05.webp) | Muestreo en una terraza termal | Sonda tomando muestras de una poza termal | Probe sampling a geothermal pool | [imagen+prompt](../03-ingenieria-planetaria/027-astrobiology/elegida/13.md) |
| [v08.webp](../../../public/illustrations/selected/astrobiology/v08.webp) | Una muestra arrancada del hielo | Robot extrayendo una muestra de la costra salina | Robot extracting a sample of the salt crust | [imagen+prompt](../03-ingenieria-planetaria/027-astrobiology/elegida/06.md) |

## habitable-zone · Zona habitable

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [keyframe-tanda-05.webp](../../../public/illustrations/selected/habitable-zone/keyframe-tanda-05.webp) | Lagunas entre el desierto y el hielo | Lagunas entre el desierto y el hielo | Pools between desert and ice | [imagen+prompt](../03-ingenieria-planetaria/028-habitable-zone/elegida/14.md) |
| [v01.webp](../../../public/illustrations/selected/habitable-zone/v01.webp) | Tres mundos a distinta distancia | Tres planetas alrededor de una estrella | Three planets around a star | [imagen+prompt](../03-ingenieria-planetaria/028-habitable-zone/elegida/01.md) |
| [v06.webp](../../../public/illustrations/selected/habitable-zone/v06.webp) | Una estación meteorológica bajo un sol rojo | Una estación meteorológica bajo un sol rojo | A weather station beneath a red sun | [imagen+prompt](../03-ingenieria-planetaria/028-habitable-zone/elegida/06.md) |

## habitability · Habitabilidad planetaria

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [keyframe-tanda-01.webp](../../../public/illustrations/selected/habitability/keyframe-tanda-01.webp) | Estación meteorológica en la costa | Estación meteorológica en la costa | A weather station on the shore | [imagen+prompt](../03-ingenieria-planetaria/029-habitability/elegida/09.md) |
| [keyframe-tanda-04.webp](../../../public/illustrations/selected/habitability/keyframe-tanda-04.webp) | Un rover en el valle brumoso | Un rover en el valle brumoso | A rover in a misty valley | [imagen+prompt](../03-ingenieria-planetaria/029-habitability/elegida/12.md) |
| [v06.webp](../../../public/illustrations/selected/habitability/v06.webp) | Una sonda baja por la grieta helada | Una sonda baja por la grieta helada | A probe lowered into an ice rift | [imagen+prompt](../03-ingenieria-planetaria/029-habitability/elegida/06.md) |

## paraterraforming · Paraterraformación

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v07.webp](../../../public/illustrations/selected/paraterraforming/v07.webp) | Una cúpula ante la tormenta de polvo | Ciudad bajo una cúpula frente a la tormenta | City beneath a dome facing the approaching storm | [imagen+prompt](../03-ingenieria-planetaria/030-paraterraforming/elegida/09.md) |
| [keyframe-tanda-02.webp](../../../public/illustrations/selected/paraterraforming/keyframe-tanda-02.webp) | Un río bajo el techo transparente | Un río bajo el techo transparente | A river beneath the transparent roof | [imagen+prompt](../03-ingenieria-planetaria/030-paraterraforming/elegida/13.md) |
| [keyframe-tanda-03.webp](../../../public/illustrations/selected/paraterraforming/keyframe-tanda-03.webp) | Un muro entre polvo y selva | Compuerta entre el desierto marciano y el bosque | Bulkhead between the Martian desert and the forest | [imagen+prompt](../03-ingenieria-planetaria/030-paraterraforming/elegida/14.md) |

## domed-cities · Domos y ciudades cerradas

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v06.webp](../../../public/illustrations/selected/domed-cities/v06.webp) | Un túnel vidriado entre dos cúpulas | Un túnel vidriado entre dos cúpulas | A glass tunnel between two domes | [imagen+prompt](../03-ingenieria-planetaria/031-domed-cities/elegida/08.md) |
| [v01.webp](../../../public/illustrations/selected/domed-cities/v01.webp) | La plaza bajo la cúpula al anochecer | La plaza bajo la cúpula al anochecer | The plaza beneath the dome at dusk | [imagen+prompt](../03-ingenieria-planetaria/031-domed-cities/elegida/03.md) |
| [keyframe-tanda-02.webp](../../../public/illustrations/selected/domed-cities/keyframe-tanda-02.webp) | Cúpulas en la nieve durante un eclipse | Cúpulas en la nieve durante un eclipse | Domes in the snow during an eclipse | [imagen+prompt](../03-ingenieria-planetaria/031-domed-cities/elegida/12.md) |

## worldhouse · Cubierta planetaria (worldhouse)

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v08.webp](../../../public/illustrations/selected/worldhouse/v08.webp) | La malla del techo sobre las nubes | Techo de paneles hexagonales rodeando el planeta | Roof of hexagonal panels surrounding the planet | [imagen+prompt](../03-ingenieria-planetaria/032-worldhouse/elegida/19.md) |
| [refb-v04.webp](../../../public/illustrations/selected/worldhouse/refb-v04.webp) | Galería de mantenimiento junto al vidrio | Galería de mantenimiento entre las capas del techo planetario | Maintenance gallery between the planetary roof’s layers | [imagen+prompt](../03-ingenieria-planetaria/032-worldhouse/elegida/16.md) |
| [keyframe-tanda-04.webp](../../../public/illustrations/selected/worldhouse/keyframe-tanda-04.webp) | Una terraza bajo el techo suspendido | Una terraza bajo el techo suspendido | A terrace beneath the suspended roof | [imagen+prompt](../03-ingenieria-planetaria/032-worldhouse/elegida/11.md) |

## terraforming · Terraformación

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v01.webp](../../../public/illustrations/selected/terraforming/v01.webp) | Un mar joven visto desde la órbita | Un mar joven visto desde la órbita | A young sea seen from orbit | [imagen+prompt](../03-ingenieria-planetaria/033-terraforming/elegida/01.md) |
| [refb-v04.webp](../../../public/illustrations/selected/terraforming/refb-v04.webp) | Brotes en el suelo recién regado | Brotes en el suelo recién regado | Seedlings in freshly watered soil | [imagen+prompt](../03-ingenieria-planetaria/033-terraforming/elegida/16.md) |
| [v03.webp](../../../public/illustrations/selected/terraforming/v03.webp) | Un mirador sobre los nuevos ríos | Estación de observación sobre el valle y sus ríos | Observation station overlooking the valley and its rivers | [imagen+prompt](../03-ingenieria-planetaria/033-terraforming/elegida/02.md) |

## mars-terraforming · Terraformación de Marte

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [keyframe-tanda-05.webp](../../../public/illustrations/selected/mars-terraforming/keyframe-tanda-05.webp) | Ríos de deshielo vistos desde la órbita | Ríos de deshielo vistos desde la órbita | Meltwater rivers seen from orbit | [imagen+prompt](../03-ingenieria-planetaria/034-mars-terraforming/elegida/11.md) |
| [v09.webp](../../../public/illustrations/selected/mars-terraforming/v09.webp) | Una planta humeante junto al lago | Planta industrial junto al lago marciano | Industrial plant beside the Martian lake | [imagen+prompt](../03-ingenieria-planetaria/034-mars-terraforming/elegida/18.md) |
| [keyframe-tanda-03.webp](../../../public/illustrations/selected/mars-terraforming/keyframe-tanda-03.webp) | Cascada de deshielo bajo un haz | Cascada de deshielo bajo los espejos orbitales | Meltwater waterfall beneath the orbital mirrors | [imagen+prompt](../03-ingenieria-planetaria/034-mars-terraforming/elegida/09.md) |

## venus-terraforming · Terraformación de Venus

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v01.webp](../../../public/illustrations/selected/venus-terraforming/v01.webp) | Torres flotantes sobre las nubes | Aerostatos extrayendo gas sobre las nubes | Aerostats extracting gas above the clouds | [imagen+prompt](../03-ingenieria-planetaria/035-venus-terraforming/elegida/01.md) |
| [v06.webp](../../../public/illustrations/selected/venus-terraforming/v06.webp) | Estación de superficie bajo cielo naranja | Estación de medición en la superficie de Venus | Monitoring station on the surface of Venus | [imagen+prompt](../03-ingenieria-planetaria/035-venus-terraforming/elegida/05.md) |
| [keyframe-tanda-02.webp](../../../public/illustrations/selected/venus-terraforming/keyframe-tanda-02.webp) | Paneles colgando de un dirigible | Dirigible arrastrando cortinas de condensación | Airship towing condensation curtains | [imagen+prompt](../03-ingenieria-planetaria/035-venus-terraforming/elegida/09.md) |

## floating-venus · Ciudades flotantes en Venus

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v13.webp](../../../public/illustrations/selected/floating-venus/v13.webp) | Cascos curvos sobre las nubes doradas | Ciudad aerostática de grandes cascos curvos | Buoyant city with vast curved hulls | [imagen+prompt](../03-ingenieria-planetaria/036-floating-venus/elegida/15.md) |
| [v07.webp](../../../public/illustrations/selected/floating-venus/v07.webp) | Un teleférico hacia la ciudad | Vehículo de mantenimiento rumbo a la ciudad flotante | Maintenance vehicle approaching the floating city | [imagen+prompt](../03-ingenieria-planetaria/036-floating-venus/elegida/07.md) |
| [v14.webp](../../../public/illustrations/selected/floating-venus/v14.webp) | Terrazas con jardines entre las nubes | Terrazas con jardines entre las nubes | Garden terraces among the clouds | [imagen+prompt](../03-ingenieria-planetaria/036-floating-venus/elegida/16.md) |
| [v16.webp](../../../public/illustrations/selected/floating-venus/v16.webp) | Un salón frente a la tormenta | Terraza con vistas a los barrios flotantes | Terrace overlooking the floating districts | [imagen+prompt](../03-ingenieria-planetaria/036-floating-venus/elegida/18.md) |

## orbital-mirrors · Espejos orbitales

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v16-e15.webp](../../../public/illustrations/selected/orbital-mirrors/v16-e15.webp) | Un valle nevado iluminado desde el cielo | Valle nevado iluminado por un reflector orbital | Snowy valley illuminated by an orbital reflector | [imagen+prompt](../03-ingenieria-planetaria/037-orbital-mirrors/elegida/15.md) |
| [v14.webp](../../../public/illustrations/selected/orbital-mirrors/v14.webp) | Una lámina que refleja las nubes | Panel de espejo orientado hacia las nubes | Mirror panel directed toward the clouds | [imagen+prompt](../03-ingenieria-planetaria/037-orbital-mirrors/elegida/13.md) |
| [v06.webp](../../../public/illustrations/selected/orbital-mirrors/v06.webp) | Un haz de luz hacia el cañón | Espejo orbital iluminando un cañón de Marte | Orbital mirror illuminating a Martian canyon | [imagen+prompt](../03-ingenieria-planetaria/037-orbital-mirrors/elegida/04.md) |

## sunshades · Parasoles espaciales

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v16.webp](../../../public/illustrations/selected/sunshades/v16.webp) | Pétalos oscuros sobre las nubes | Membrana de un parasol desplegada sobre las nubes | Sunshade membrane deployed above the clouds | [imagen+prompt](../03-ingenieria-planetaria/038-sunshades/elegida/13.md) |
| [v12.webp](../../../public/illustrations/selected/sunshades/v12.webp) | La sombra avanza sobre el hielo | Sombra de un parasol sobre el lago helado | Sunshade’s shadow crossing the frozen lake | [imagen+prompt](../03-ingenieria-planetaria/038-sunshades/elegida/09.md) |
| [v08.webp](../../../public/illustrations/selected/sunshades/v08.webp) | Un globo bajo la malla de sombra | Globo sonda bajo los paneles del parasol | Probe balloon beneath the sunshade panels | [imagen+prompt](../03-ingenieria-planetaria/038-sunshades/elegida/04.md) |
| [v03.webp](../../../public/illustrations/selected/sunshades/v03.webp) | Una vela tendida frente al planeta | Membrana de un parasol frente a Venus | Sunshade membrane in front of Venus | [imagen+prompt](../03-ingenieria-planetaria/038-sunshades/elegida/01.md) |

## volatile-import · Importación de volátiles

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v09.webp](../../../public/illustrations/selected/volatile-import/v09.webp) | Hielo remolcado sobre el planeta rojo | Hielo remolcado sobre el planeta rojo | Ice towed above the red planet | [imagen+prompt](../03-ingenieria-planetaria/039-volatile-import/elegida/10.md) |
| [v16.webp](../../../public/illustrations/selected/volatile-import/v16.webp) | Una cascada liberada desde el hielo | Depósito de hielo alimentando una cascada | Ice reservoir feeding a waterfall | [imagen+prompt](../03-ingenieria-planetaria/039-volatile-import/elegida/17.md) |
| [v17.webp](../../../public/illustrations/selected/volatile-import/v17.webp) | Un bloque de hielo sujeto con cables | Remolcadores transportando un fragmento de cometa | Tugs transporting a comet fragment | [imagen+prompt](../03-ingenieria-planetaria/039-volatile-import/elegida/18.md) |

## magnetosphere · Magnetosferas artificiales

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v05.webp](../../../public/illustrations/selected/magnetosphere/v05.webp) | Una nave atraviesa el anillo oscuro | Dron de inspección atravesando una cadena de bobinas | Inspection drone passing through a chain of coils | [imagen+prompt](../03-ingenieria-planetaria/040-magnetosphere/elegida/05.md) |
| [v01.webp](../../../public/illustrations/selected/magnetosphere/v01.webp) | El viento solar rodea el anillo | Bobina superconductora desviando el viento solar | Superconducting coil deflecting the solar wind | [imagen+prompt](../03-ingenieria-planetaria/040-magnetosphere/elegida/01.md) |
| [v13.webp](../../../public/illustrations/selected/magnetosphere/v13.webp) | Tuberías escarchadas sobre la bobina | Tuberías escarchadas sobre la bobina | Frosted pipes along a copper coil | [imagen+prompt](../03-ingenieria-planetaria/040-magnetosphere/elegida/14.md) |

## ecopoiesis · Ecopoiesis

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v10.webp](../../../public/illustrations/selected/ecopoiesis/v10.webp) | Tapetes de colores en las pozas | Tapetes microbianos creciendo en las pozas | Microbial mats growing in the pools | [imagen+prompt](../03-ingenieria-planetaria/041-ecopoiesis/elegida/11.md) |
| [v01.webp](../../../public/illustrations/selected/ecopoiesis/v01.webp) | Muestras de suelo bajo el brazo robótico | Muestras de suelo bajo el brazo robótico | Soil samples beneath a robotic arm | [imagen+prompt](../03-ingenieria-planetaria/041-ecopoiesis/elegida/01.md) |
| [v12.webp](../../../public/illustrations/selected/ecopoiesis/v12.webp) | Luz sobre un cráter que reverdece | Primeros tapetes microbianos en el fondo del cráter | First microbial mats on the crater floor | [imagen+prompt](../03-ingenieria-planetaria/041-ecopoiesis/elegida/13.md) |

## planetary-protection · Protección planetaria

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v13.webp](../../../public/illustrations/selected/planetary-protection/v13.webp) | Una muestra sellada tras el vidrio | Muestra de regolito en una cámara de cuarentena | Regolith sample inside a quarantine chamber | [imagen+prompt](../03-ingenieria-planetaria/042-planetary-protection/elegida/13.md) |
| [v10.webp](../../../public/illustrations/selected/planetary-protection/v10.webp) | Un puente sellado sobre el abismo | Pasarela de aislamiento para una sonda sobre la grieta | Isolation walkway carrying a probe above the rift | [imagen+prompt](../03-ingenieria-planetaria/042-planetary-protection/elegida/10.md) |
| [v02.webp](../../../public/illustrations/selected/planetary-protection/v02.webp) | Un testigo de hielo en su cápsula | Cápsula de muestras sellada junto a la grieta | Sealed sample capsule beside the rift | [imagen+prompt](../03-ingenieria-planetaria/042-planetary-protection/elegida/02.md) |

## space-based-solar · Energía solar espacial

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v06.webp](../../../public/illustrations/selected/space-based-solar/v06.webp) | Paneles sobre ciudades de noche | Paneles solares sobre las ciudades de la Tierra | Solar panels above Earth’s cities | [imagen+prompt](../04-energia-estelar/043-space-based-solar/elegida/04.md) |
| [v08.webp](../../../public/illustrations/selected/space-based-solar/v08.webp) | Una lancha entre mástiles en el mar | Lancha de mantenimiento entre antenas receptoras marinas | Maintenance boat among offshore receiving antennas | [imagen+prompt](../04-energia-estelar/043-space-based-solar/elegida/08.md) |
| [v15.webp](../../../public/illustrations/selected/space-based-solar/v15.webp) | Paneles en espiral junto a una luna | Paneles solares en espiral junto a una luna | Spiraling solar panels beside a moon | [imagen+prompt](../04-energia-estelar/043-space-based-solar/elegida/15.md) |

## microwave-power · Transmisión por microondas y láser

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v20-e19.webp](../../../public/illustrations/selected/microwave-power/v20-e19.webp) | Arcos receptores frente al mar | Antenas receptoras de microondas en el estuario | Microwave receiving antennas in the estuary | [imagen+prompt](../04-energia-estelar/044-microwave-power/elegida/19.md) |
| [v08.webp](../../../public/illustrations/selected/microwave-power/v08.webp) | Un rayo láser frente a Júpiter | Nave recibiendo energía láser junto a Júpiter | Ship receiving laser power beside Jupiter | [imagen+prompt](../04-energia-estelar/044-microwave-power/elegida/06.md) |
| [v09.webp](../../../public/illustrations/selected/microwave-power/v09.webp) | Una antena abierta sobre el regolito | Antena receptora de energía sobre un vehículo lunar | Power receiving antenna on a lunar vehicle | [imagen+prompt](../04-energia-estelar/044-microwave-power/elegida/08.md) |

## radiators · Calor residual y radiadores

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v11.webp](../../../public/illustrations/selected/radiators/v11.webp) | Aletas oscuras con bordes incandescentes | Radiador de aletas con extremos incandescentes | Finned radiator with glowing tips | [imagen+prompt](../04-energia-estelar/045-radiators/elegida/10.md) |
| [v01.webp](../../../public/illustrations/selected/radiators/v01.webp) | Paneles abiertos en cruz | Paneles radiadores desplegados alrededor del reactor | Radiator panels deployed around the reactor | [imagen+prompt](../04-energia-estelar/045-radiators/elegida/01.md) |
| [v18.webp](../../../public/illustrations/selected/radiators/v18.webp) | Una cortina de gotas en el vacío | Gotas metálicas circulando entre los colectores del radiador | Metal droplets flowing between the radiator’s manifolds | [imagen+prompt](../04-energia-estelar/045-radiators/elegida/17.md) |

## dyson-swarm · Enjambre de Dyson

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v17.webp](../../../public/illustrations/selected/dyson-swarm/v17.webp) | Colectores en órbita de una estrella roja | Colectores en órbita de una estrella roja | Collectors orbiting a red star | [imagen+prompt](../04-energia-estelar/046-dyson-swarm/elegida/15.md) |
| [v12.webp](../../../public/illustrations/selected/dyson-swarm/v12.webp) | Una excavadora bajo la corriente de colectores | Excavadora en un cometa bajo los colectores solares | Excavator on a comet beneath the solar collectors | [imagen+prompt](../04-energia-estelar/046-dyson-swarm/elegida/10.md) |
| [v21.webp](../../../public/illustrations/selected/dyson-swarm/v21.webp) | Fragmentos de cristal ante la estrella | Colectores independientes alrededor de una estrella | Independent collectors surrounding a star | [imagen+prompt](../04-energia-estelar/046-dyson-swarm/elegida/19.md) |

## dyson-ring · Anillo y red de Dyson

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v02.webp](../../../public/illustrations/selected/dyson-ring/v02.webp) | Un arco de paneles abrazando la estrella | Arco de colectores alrededor de la estrella | Arc of collectors surrounding the star | [imagen+prompt](../04-energia-estelar/047-dyson-ring/elegida/01.md) |
| [v18.webp](../../../public/illustrations/selected/dyson-ring/v18.webp) | Dos anillos cruzados alrededor de la estrella | Dos anillos cruzados alrededor de la estrella | Two rings crossing around the star | [imagen+prompt](../04-energia-estelar/047-dyson-ring/elegida/18.md) |
| [v16.webp](../../../public/illustrations/selected/dyson-ring/v16.webp) | Paneles en órbita de una estrella roja | Paneles en órbita de una estrella roja | Panels circling a red star | [imagen+prompt](../04-energia-estelar/047-dyson-ring/elegida/16.md) |

## dyson-bubble · Burbuja de Dyson y satélites suspendidos (statites)

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v13.webp](../../../public/illustrations/selected/dyson-bubble/v13.webp) | Velas iridiscentes ante la estrella | Velas iridiscentes ante la estrella | Iridescent sails before the star | [imagen+prompt](../04-energia-estelar/048-dyson-bubble/elegida/12.md) |
| [v09.webp](../../../public/illustrations/selected/dyson-bubble/v09.webp) | Una sombra tras la membrana | Robot de inspección tras una vela translúcida | Inspection robot behind a translucent sail | [imagen+prompt](../04-energia-estelar/048-dyson-bubble/elegida/08.md) |
| [v08.webp](../../../public/illustrations/selected/dyson-bubble/v08.webp) | Una sonda entre espejos suspendidos | Sonda de inspección entre velas de statites | Inspection probe among statite sails | [imagen+prompt](../04-energia-estelar/048-dyson-bubble/elegida/07.md) |

## dyson-shell · Esfera rígida de Dyson

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v01.webp](../../../public/illustrations/selected/dyson-shell/v01.webp) | Drones sobre la junta ante el sol | Drones reparando la junta de la coraza estelar | Drones repairing a joint in the stellar shell | [imagen+prompt](../04-energia-estelar/049-dyson-shell/elegida/01.md) |
| [v05.webp](../../../public/illustrations/selected/dyson-shell/v05.webp) | Una nave rasante sobre la coraza | Una nave rasante sobre la coraza | A ship skimming the vast shell | [imagen+prompt](../04-energia-estelar/049-dyson-shell/elegida/04.md) |
| [v17.webp](../../../public/illustrations/selected/dyson-shell/v17.webp) | Luz que cae en el hueco interior | Galería de mantenimiento dentro de la coraza estelar | Maintenance gallery inside the stellar shell | [imagen+prompt](../04-energia-estelar/049-dyson-shell/elegida/17.md) |
| [v07.webp](../../../public/illustrations/selected/dyson-shell/v07.webp) | Una grúa cruza la abertura luminosa | Robot de construcción cruzando la abertura de la coraza | Construction robot crossing the shell’s opening | [imagen+prompt](../04-energia-estelar/049-dyson-shell/elegida/06.md) |

## chemical-rockets · Cohetes químicos

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v01.webp](../../../public/illustrations/selected/chemical-rockets/v01.webp) | Ascenso sobre un mar de nubes | Cohete ascendiendo sobre un mar de nubes | Rocket ascending above a sea of clouds | [imagen+prompt](../05-viaje-interestelar/050-chemical-rockets/elegida/01.md) |
| [v08.webp](../../../public/illustrations/selected/chemical-rockets/v08.webp) | Despegue desde el mar en tormenta | Cohete despegando de una plataforma en plena tormenta | Rocket lifting off from a platform in a storm | [imagen+prompt](../05-viaje-interestelar/050-chemical-rockets/elegida/07.md) |
| [v09.webp](../../../public/illustrations/selected/chemical-rockets/v09.webp) | Lanzamiento desde una zanja lunar | Cohete de carga despegando de una zanja lunar | Cargo rocket lifting off from a lunar trench | [imagen+prompt](../05-viaje-interestelar/050-chemical-rockets/elegida/08.md) |

## ion-engines · Motores iónicos

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v11.webp](../../../public/illustrations/selected/ion-engines/v11.webp) | Un haz azul frente a la luna | Propulsor iónico encendido frente a una luna | Ion thruster firing in front of a moon | [imagen+prompt](../05-viaje-interestelar/051-ion-engines/elegida/13.md) |
| [v12.webp](../../../public/illustrations/selected/ion-engines/v12.webp) | Una nave alada sobre el planeta azul | Sonda iónica sobre el gigante gaseoso azul | Ion probe above the blue gas giant | [imagen+prompt](../05-viaje-interestelar/051-ion-engines/elegida/14.md) |
| [v06.webp](../../../public/illustrations/selected/ion-engines/v06.webp) | Una sonda junto a un asteroide | Sonda iónica junto a un observatorio anclado al cometa | Ion probe beside an observatory anchored to the comet | [imagen+prompt](../05-viaje-interestelar/051-ion-engines/elegida/08.md) |

## hall-thruster · Motores Hall

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v11.webp](../../../public/illustrations/selected/hall-thruster/v11.webp) | Encendido en la sala de pruebas | Propulsor de plasma encendido en la cámara de pruebas | Plasma thruster firing inside the test chamber | [imagen+prompt](../05-viaje-interestelar/052-hall-thruster/elegida/12.md) |
| [v16.webp](../../../public/illustrations/selected/hall-thruster/v16.webp) | Una nave sobre una luna con cráteres | Nave con tres propulsores sobre una luna | Ship with three thrusters above a moon | [imagen+prompt](../05-viaje-interestelar/052-hall-thruster/elegida/17.md) |
| [v13.webp](../../../public/illustrations/selected/hall-thruster/v13.webp) | Una hilera de propulsores encendidos | Una hilera de propulsores encendidos | A row of thrusters firing | [imagen+prompt](../05-viaje-interestelar/052-hall-thruster/elegida/14.md) |

## solar-electric · Propulsión solar eléctrica

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v14.webp](../../../public/illustrations/selected/solar-electric/v14.webp) | Alas solares junto a un gigante gaseoso | Alas solares junto a un gigante gaseoso | Solar wings beside a gas giant | [imagen+prompt](../05-viaje-interestelar/053-solar-electric/elegida/15.md) |
| [v08.webp](../../../public/illustrations/selected/solar-electric/v08.webp) | Paneles dorados en un cañón rocoso | Remolcador de paneles solares sobre un cañón | Tug with solar panels above a canyon | [imagen+prompt](../05-viaje-interestelar/053-solar-electric/elegida/09.md) |
| [v09.webp](../../../public/illustrations/selected/solar-electric/v09.webp) | Tres paneles sobre un planeta azul | Remolcador desplegando tres alas solares sobre el planeta | Tug deploying three solar wings above the planet | [imagen+prompt](../05-viaje-interestelar/053-solar-electric/elegida/10.md) |

## nuclear-electric · Propulsión nuclear eléctrica

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v13.webp](../../../public/illustrations/selected/nuclear-electric/v13.webp) | Una nave larga sobre los cráteres | Nave con radiadores curvos sobre una luna | Ship with curved radiators above a moon | [imagen+prompt](../05-viaje-interestelar/054-nuclear-electric/elegida/12.md) |
| [v18.webp](../../../public/illustrations/selected/nuclear-electric/v18.webp) | Un penacho violeta junto a la luna | Propulsor eléctrico encendido junto a una luna | Electric thruster firing beside a moon | [imagen+prompt](../05-viaje-interestelar/054-nuclear-electric/elegida/17.md) |
| [v09.webp](../../../public/illustrations/selected/nuclear-electric/v09.webp) | Una nave vista desde la caverna | Nave de carga vista desde una caverna | Cargo ship seen from inside a cavern | [imagen+prompt](../05-viaje-interestelar/054-nuclear-electric/elegida/08.md) |

## nuclear-thermal · Propulsión nuclear térmica

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v09.webp](../../../public/illustrations/selected/nuclear-thermal/v09.webp) | El chorro de escape contra el hielo | Nave expulsando un amplio chorro de hidrógeno | Ship emitting a broad hydrogen exhaust plume | [imagen+prompt](../05-viaje-interestelar/055-nuclear-thermal/elegida/10.md) |
| [v11.webp](../../../public/illustrations/selected/nuclear-thermal/v11.webp) | La tobera frente a un planeta anillado | La tobera frente a un planeta anillado | The nozzle in front of a ringed planet | [imagen+prompt](../05-viaje-interestelar/055-nuclear-thermal/elegida/12.md) |
| [v14.webp](../../../public/illustrations/selected/nuclear-thermal/v14.webp) | Una nave de tanques sobre la Luna | Tanques de hidrógeno de una nave sobre una luna | Spacecraft hydrogen tanks above a moon | [imagen+prompt](../05-viaje-interestelar/055-nuclear-thermal/elegida/15.md) |

## project-orion · Proyecto Orión

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v06.webp](../../../public/illustrations/selected/project-orion/v06.webp) | La placa de empuje entre asteroides | La placa de empuje entre asteroides | The pusher plate among asteroids | [imagen+prompt](../05-viaje-interestelar/056-project-orion/elegida/02.md) |
| [v08.webp](../../../public/illustrations/selected/project-orion/v08.webp) | La placa recibe el destello | Placa de empuje frente a una detonación nuclear | Pusher plate in front of a nuclear detonation | [imagen+prompt](../05-viaje-interestelar/056-project-orion/elegida/04.md) |
| [v02.webp](../../../public/illustrations/selected/project-orion/v02.webp) | Una detonación a lo lejos | Primer plano de la placa de empuje | Close view of the pusher plate | solo imagen |

## fusion-propulsion · Propulsión de fusión

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v05.webp](../../../public/illustrations/selected/fusion-propulsion/v05.webp) | Un convoy frente a la nebulosa azul | Convoy de naves con motores de fusión | Convoy of ships with fusion engines | [imagen+prompt](../05-viaje-interestelar/057-fusion-propulsion/elegida/05.md) |
| [v14.webp](../../../public/illustrations/selected/fusion-propulsion/v14.webp) | Una nave afilada sobre los anillos | Nave de fusión sobre los anillos de hielo | Fusion ship above the icy rings | [imagen+prompt](../05-viaje-interestelar/057-fusion-propulsion/elegida/15.md) |
| [v08.webp](../../../public/illustrations/selected/fusion-propulsion/v08.webp) | Una nave rozando la superficie estelar | Nave de fusión frente a una protuberancia estelar | Fusion ship in front of a stellar prominence | [imagen+prompt](../05-viaje-interestelar/057-fusion-propulsion/elegida/09.md) |

## antimatter · Propulsión de antimateria

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v11.webp](../../../public/illustrations/selected/antimatter/v11.webp) | Esferas blancas sobre un páramo gris | Escudos de radiación protegiendo el motor | Radiation shields protecting the engine | [imagen+prompt](../05-viaje-interestelar/058-antimatter/elegida/11.md) |
| [v02.webp](../../../public/illustrations/selected/antimatter/v02.webp) | Un brazo robótico inserta la cápsula | Brazo robótico insertando una cápsula de contención | Robotic arm inserting a containment capsule | [imagen+prompt](../05-viaje-interestelar/058-antimatter/elegida/02.md) |
| [v07.webp](../../../public/illustrations/selected/antimatter/v07.webp) | Vista cenital de la cámara del motor | Vista cenital de la cámara del motor | Overhead view of the engine chamber | [imagen+prompt](../05-viaje-interestelar/058-antimatter/elegida/07.md) |

## bussard-ramjet · Estatorreactor de Bussard

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v05.webp](../../../public/illustrations/selected/bussard-ramjet/v05.webp) | El anillo cruza una nube de polvo | Anillo recolector atravesando una nube de polvo | Collector ring passing through a dust cloud | [imagen+prompt](../05-viaje-interestelar/059-bussard-ramjet/elegida/05.md) |
| [v03.webp](../../../public/illustrations/selected/bussard-ramjet/v03.webp) | La nave en el centro del anillo | La nave en el centro del anillo | The ship at the ring’s center | [imagen+prompt](../05-viaje-interestelar/059-bussard-ramjet/elegida/03.md) |
| [v01.webp](../../../public/illustrations/selected/bussard-ramjet/v01.webp) | Silueta de la nave en el vacío | Nave con un gran anillo recolector frontal | Ship with a large forward collector ring | [imagen+prompt](../05-viaje-interestelar/059-bussard-ramjet/elegida/01.md) |
| [v07.webp](../../../public/illustrations/selected/bussard-ramjet/v07.webp) | Embudo de cables en la nebulosa roja | Colector magnético abierto en una nube interestelar | Open magnetic scoop inside an interstellar cloud | [imagen+prompt](../05-viaje-interestelar/059-bussard-ramjet/elegida/08.md) |
| [v01-e01.webp](../../../public/illustrations/selected/bussard-ramjet/v01-e01.webp) | El embudo magnético abierto al vacío | Bobina recolectora desplegada delante de la nave | Collector coil deployed ahead of the ship | solo imagen |

## solar-sail · Velas solares

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v12.webp](../../../public/illustrations/selected/solar-sail/v12.webp) | Mirando a lo largo de la membrana | Sonda suspendida en el centro de la membrana | Probe suspended at the center of the membrane | [imagen+prompt](../05-viaje-interestelar/060-solar-sail/elegida/12.md) |
| [v06.webp](../../../public/illustrations/selected/solar-sail/v06.webp) | Luz de amanecer tras el asteroide | Vela desplegada saliendo de la sombra del asteroide | Deployed sail emerging from the asteroid’s shadow | [imagen+prompt](../05-viaje-interestelar/060-solar-sail/elegida/05.md) |
| [v08.webp](../../../public/illustrations/selected/solar-sail/v08.webp) | Un cuadrado de luz sobre el hielo | Vela cuadrada sobre la superficie helada | Square sail above the frozen surface | [imagen+prompt](../05-viaje-interestelar/060-solar-sail/elegida/08.md) |

## laser-sail · Velas láser

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v18.webp](../../../public/illustrations/selected/laser-sail/v18.webp) | Una membrana gigante frente a la Luna | Membrana de la sonda frente al transmisor lunar | Probe membrane facing the lunar transmitter | [imagen+prompt](../05-viaje-interestelar/061-laser-sail/elegida/18.md) |
| [v14.webp](../../../public/illustrations/selected/laser-sail/v14.webp) | Una membrana tensada en el laboratorio | Prototipo de vela en la cámara de pruebas | Sail prototype inside the test chamber | [imagen+prompt](../05-viaje-interestelar/061-laser-sail/elegida/14.md) |
| [v04.webp](../../../public/illustrations/selected/laser-sail/v04.webp) | Un haz parte desde la superficie lunar | Matriz de láseres lunares impulsando una vela | Lunar laser array propelling a sail | [imagen+prompt](../05-viaje-interestelar/061-laser-sail/elegida/03.md) |

## beamed-propulsion · Propulsión por haces de energía

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v15.webp](../../../public/illustrations/selected/beamed-propulsion/v15.webp) | Pétalos abiertos para recibir la luz | Nave con receptor de energía abierto | Spacecraft with its energy receiver open | [imagen+prompt](../05-viaje-interestelar/062-beamed-propulsion/elegida/14.md) |
| [v12.webp](../../../public/illustrations/selected/beamed-propulsion/v12.webp) | Un gran espejo ante un faro lejano | Nave receptora frente al transmisor de energía | Receiving spacecraft facing the power transmitter | [imagen+prompt](../05-viaje-interestelar/062-beamed-propulsion/elegida/11.md) |

## magnetic-sail · Velas magnéticas

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v09.webp](../../../public/illustrations/selected/magnetic-sail/v09.webp) | Un gran lazo en la corriente azul | Bobina desplegada en la cola de un cometa | Coil deployed inside a comet’s tail | [imagen+prompt](../05-viaje-interestelar/063-magnetic-sail/elegida/09.md) |
| [v14.webp](../../../public/illustrations/selected/magnetic-sail/v14.webp) | Primer plano del cable trenzado | Primer plano del cable trenzado | A close-up of the braided cable | [imagen+prompt](../05-viaje-interestelar/063-magnetic-sail/elegida/14.md) |
| [v08.webp](../../../public/illustrations/selected/magnetic-sail/v08.webp) | Una estrella roja enmarcada por el aro | Estrella roja vista a través de la bobina | Red star seen through the coil | [imagen+prompt](../05-viaje-interestelar/063-magnetic-sail/elegida/08.md) |

## electric-sail · Velas eléctricas

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v16.webp](../../../public/illustrations/selected/electric-sail/v16.webp) | Cables tendidos sobre una luna | Sonda con cables radiales desplegados sobre una luna | Probe with radial tethers deployed above a moon | [imagen+prompt](../05-viaje-interestelar/064-electric-sail/elegida/17.md) |
| [v06.webp](../../../public/illustrations/selected/electric-sail/v06.webp) | Cables brillantes frente a Marte | Carretes y cables de la sonda frente a Marte | Probe reels and tethers in front of Mars | [imagen+prompt](../05-viaje-interestelar/064-electric-sail/elegida/07.md) |
| [v15.webp](../../../public/illustrations/selected/electric-sail/v15.webp) | Una esfera con cables sobre un asteroide | Sonda de cables radiales sobre un asteroide | Probe with radial tethers above an asteroid | [imagen+prompt](../05-viaje-interestelar/064-electric-sail/elegida/16.md) |

## relativistic-propulsion · Propulsión relativista

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v06.webp](../../../public/illustrations/selected/relativistic-propulsion/v06.webp) | La proa atraviesa una nube de polvo | Escudo de proa atravesando una nube de polvo | Bow shield passing through a dust cloud | [imagen+prompt](../05-viaje-interestelar/065-relativistic-propulsion/elegida/06.md) |
| [v12.webp](../../../public/illustrations/selected/relativistic-propulsion/v12.webp) | Estrellas agolpadas hacia el frente | Estrellas concentradas frente al escudo de la nave | Stars concentrated ahead of the spacecraft’s shield | [imagen+prompt](../05-viaje-interestelar/065-relativistic-propulsion/elegida/13.md) |
| [v16.webp](../../../public/illustrations/selected/relativistic-propulsion/v16.webp) | Una nave como aguja entre galaxias | Nave de casco alargado ante las estrellas | Ship with an elongated hull against the stars | [imagen+prompt](../05-viaje-interestelar/065-relativistic-propulsion/elegida/17.md) |

## interstellar-braking · Frenado interestelar

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v01.webp](../../../public/illustrations/selected/interstellar-braking/v01.webp) | El aro abierto ante la estrella roja | Bobina de frenado desplegada frente a una estrella roja | Braking coil deployed in front of a red star | [imagen+prompt](../05-viaje-interestelar/066-interstellar-braking/elegida/01.md) |
| [v20.webp](../../../public/illustrations/selected/interstellar-braking/v20.webp) | El chorro apunta hacia el planeta | Motor de frenado orientado hacia el planeta de destino | Braking engine facing the destination planet | [imagen+prompt](../05-viaje-interestelar/066-interstellar-braking/elegida/20.md) |
| [v13.webp](../../../public/illustrations/selected/interstellar-braking/v13.webp) | Vela brillante y aro | Vela reflectante y bobina de frenado junto al planeta | Reflective sail and braking coil beside the planet | [imagen+prompt](../05-viaje-interestelar/066-interstellar-braking/elegida/13.md) |

## worldship · Naves generacionales

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v06.webp](../../../public/illustrations/selected/worldship/v06.webp) | Anillos iluminados entre fragmentos de hielo | Anillos habitables de la nave entre fragmentos de hielo | Ship’s inhabited rings among drifting ice fragments | [imagen+prompt](../05-viaje-interestelar/067-worldship/elegida/05.md) |
| [v07.webp](../../../public/illustrations/selected/worldship/v07.webp) | Manzanas caídas sobre el valle interior | Huerto y ferrocarril en el interior de la nave | Orchard and railway inside the ship | [imagen+prompt](../05-viaje-interestelar/067-worldship/elegida/07.md) |
| [v01.webp](../../../public/illustrations/selected/worldship/v01.webp) | El gran tambor y sus lanzaderas | Tambor habitable con lanzaderas acopladas | Habitat drum with docked shuttles | [imagen+prompt](../05-viaje-interestelar/067-worldship/elegida/01.md) |
| [v18.webp](../../../public/illustrations/selected/worldship/v18.webp) | Un río por el interior curvo | Río entre los campos del cilindro habitable | River among the inhabited cylinder’s fields | [imagen+prompt](../05-viaje-interestelar/067-worldship/elegida/18.md) |

## alcubierre · Propulsión de Alcubierre

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v04.webp](../../../public/illustrations/selected/alcubierre/v04.webp) | Una nave dentro de su burbuja | Una nave dentro de su burbuja | A ship inside its bubble | [imagen+prompt](../05-viaje-interestelar/068-alcubierre/elegida/02.md) |
| [v21.webp](../../../public/illustrations/selected/alcubierre/v21.webp) | El horizonte curvado junto a la nave | Nave junto al horizonte deformado del planeta | Ship beside the planet’s distorted horizon | [imagen+prompt](../05-viaje-interestelar/068-alcubierre/elegida/20.md) |
| [v07.webp](../../../public/illustrations/selected/alcubierre/v07.webp) | Estrellas arremolinadas alrededor de la nave | Estrellas distorsionadas alrededor de la nave | Distorted stars around the ship | [imagen+prompt](../05-viaje-interestelar/068-alcubierre/elegida/05.md) |
| [v04-e02.webp](../../../public/illustrations/selected/alcubierre/v04-e02.webp) | La burbuja de deformación entre las estrellas | Estrellas desviadas en el borde de la burbuja | Stars deflected along the bubble’s edge | solo imagen |
| [v21-e20.webp](../../../public/illustrations/selected/alcubierre/v21-e20.webp) | La nave de anillos deja la órbita | Casco ovalado y anillo de la nave en órbita | Oval hull and ring of the orbiting ship | solo imagen |

## wormholes · Agujeros de gusano

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v07.webp](../../../public/illustrations/selected/wormholes/v07.webp) | Una antena frente a la boca | Sonda ante una esfera con una nebulosa roja | Probe facing a sphere containing a red nebula | [imagen+prompt](../05-viaje-interestelar/069-wormholes/elegida/08.md) |
| [v14.webp](../../../public/illustrations/selected/wormholes/v14.webp) | Una esfera sobre el salar helado | Esfera con un planeta sobre el salar | Sphere containing a planet above the salt flat | [imagen+prompt](../05-viaje-interestelar/069-wormholes/elegida/15.md) |
| [v09.webp](../../../public/illustrations/selected/wormholes/v09.webp) | Un atardecer dentro de la esfera | Rover ante una esfera con un océano al amanecer | Rover facing a sphere showing an ocean at sunrise | [imagen+prompt](../05-viaje-interestelar/069-wormholes/elegida/10.md) |

## reactionless · Motores sin reacción

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v10.webp](../../../public/illustrations/selected/reactionless/v10.webp) | Una balanza de torsión en la penumbra | Una balanza de torsión en la penumbra | A torsion balance in the half-light | [imagen+prompt](../05-viaje-interestelar/070-reactionless/elegida/11.md) |
| [v07.webp](../../../public/illustrations/selected/reactionless/v07.webp) | Un láser cruza el dispositivo suspendido | Motor experimental suspendido frente al interferómetro láser | Experimental engine suspended before the laser interferometer | [imagen+prompt](../05-viaje-interestelar/070-reactionless/elegida/08.md) |

## stellar-physics · Estrellas como sistemas físicos

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v03.webp](../../../public/illustrations/selected/stellar-physics/v03.webp) | Una gigante roja domina el horizonte | Una gigante roja domina el horizonte | A red giant fills the horizon | solo imagen |
| [v06.webp](../../../public/illustrations/selected/stellar-physics/v06.webp) | Una sonda ante la corona eclipsada | Una sonda ante la corona eclipsada | A probe in front of the eclipsed corona | [imagen+prompt](../06-ingenieria-estelar/071-stellar-physics/elegida/04.md) |
| [v18.webp](../../../public/illustrations/selected/stellar-physics/v18.webp) | Gas que fluye hacia su compañera | Plasma fluyendo entre dos estrellas de distinto tamaño | Plasma flowing between two stars of different sizes | [imagen+prompt](../06-ingenieria-estelar/071-stellar-physics/elegida/16.md) |
| [v16.webp](../../../public/illustrations/selected/stellar-physics/v16.webp) | Un prisma descompone la luz | Prisma separando la luz de una estrella | Prism splitting the light from a star | [imagen+prompt](../06-ingenieria-estelar/071-stellar-physics/elegida/14.md) |

## stellar-engines · Motores estelares

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v19.webp](../../../public/illustrations/selected/stellar-engines/v19.webp) | Escudos curvos y un chorro azul | Tres palas curvas alrededor de la estrella | Three curved vanes surrounding the star | [imagen+prompt](../06-ingenieria-estelar/072-stellar-engines/elegida/19.md) |
| [v18.webp](../../../public/illustrations/selected/stellar-engines/v18.webp) | Mirando por el conducto del chorro | Canal de escape entre las palas del motor | Exhaust channel between the engine vanes | [imagen+prompt](../06-ingenieria-estelar/072-stellar-engines/elegida/18.md) |
| [v08.webp](../../../public/illustrations/selected/stellar-engines/v08.webp) | Una flota frente a la estrella | Reflector segmentado junto a la estrella | Segmented reflector beside the star | [imagen+prompt](../06-ingenieria-estelar/072-stellar-engines/elegida/08.md) |
| [v09.webp](../../../public/illustrations/selected/stellar-engines/v09.webp) | Muralla de hielo bajo una vela gigante | Glaciar bajo el espejo de propulsión estelar | Glacier beneath the stellar propulsion mirror | [imagen+prompt](../06-ingenieria-estelar/072-stellar-engines/elegida/09.md) |
| [v08b.webp](../../../public/illustrations/selected/stellar-engines/v08b.webp) | Una estrella empujada por su motor | Plataformas alineadas junto al borde de la estrella | Platforms aligned along the star’s edge | solo imagen |

## shkadov · Motor de Shkadov

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v03.webp](../../../public/illustrations/selected/shkadov/v03.webp) | Un observatorio frente al espejo curvo | Un observatorio frente al espejo curvo | An observatory facing the curved mirror | solo imagen |
| [v18-e17.webp](../../../public/illustrations/selected/shkadov/v18-e17.webp) | Un arco inmenso sobre las nubes | Espejo cóncavo suspendido sobre las nubes | Concave mirror suspended above the clouds | [imagen+prompt](../06-ingenieria-estelar/073-shkadov/elegida/17.md) |
| [v16.webp](../../../public/illustrations/selected/shkadov/v16.webp) | Un chorro estelar junto al espejo | Estrella reflejada en el borde del espejo | Star reflected along the mirror’s edge | [imagen+prompt](../06-ingenieria-estelar/073-shkadov/elegida/15.md) |
| [v14.webp](../../../public/illustrations/selected/shkadov/v14.webp) | Una muralla de espejos sobre las nubes | Una muralla de espejos sobre las nubes | A wall of mirrors above the clouds | [imagen+prompt](../06-ingenieria-estelar/073-shkadov/elegida/13.md) |

## caplan · Motor de Caplan

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v09.webp](../../../public/illustrations/selected/caplan/v09.webp) | Una red recoge plasma del sol | Red de colectores extrayendo plasma de la estrella | Collector network extracting plasma from the star | [imagen+prompt](../06-ingenieria-estelar/074-caplan/elegida/07.md) |
| [v17.webp](../../../public/illustrations/selected/caplan/v17.webp) | El chorro azul visto desde dentro | Conducto magnético emitiendo el chorro de plasma | Magnetic channel emitting the plasma jet | [imagen+prompt](../06-ingenieria-estelar/074-caplan/elegida/15.md) |
| [v13.webp](../../../public/illustrations/selected/caplan/v13.webp) | El escudo y el núcleo encendido | Colector estelar conectado al motor de plasma | Stellar collector connected to the plasma engine | [imagen+prompt](../06-ingenieria-estelar/074-caplan/elegida/11.md) |

## stellar-navigation · Navegación estelar

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v10.webp](../../../public/illustrations/selected/stellar-navigation/v10.webp) | Una sonda entre dos estrellas | Baliza de navegación desplegada a ambos lados del asteroide | Navigation beacon deployed on both sides of the asteroid | [imagen+prompt](../06-ingenieria-estelar/075-stellar-navigation/elegida/09.md) |
| [v07.webp](../../../public/illustrations/selected/stellar-navigation/v07.webp) | Sensores apuntando a las estrellas | Sensores apuntando a las estrellas | Sensors aimed at the stars | [imagen+prompt](../06-ingenieria-estelar/075-stellar-navigation/elegida/06.md) |
| [v01.webp](../../../public/illustrations/selected/stellar-navigation/v01.webp) | Una estela curva junto a la galaxia | Sistema planetario junto a una estela curva | Planetary system beside a curved wake | [imagen+prompt](../06-ingenieria-estelar/075-stellar-navigation/elegida/01.md) |
| [v20.webp](../../../public/illustrations/selected/stellar-navigation/v20.webp) | Arcos sobre un lago helado | Pilares de navegación sobre un mar helado | Navigation pylons above a frozen sea | [imagen+prompt](../06-ingenieria-estelar/075-stellar-navigation/elegida/19.md) |

## star-lifting · Extracción de materia estelar (star lifting)

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v18.webp](../../../public/illustrations/selected/star-lifting/v18.webp) | Espirales que elevan plasma de la estrella | Conducto helicoidal extrayendo plasma de la estrella | Helical channel extracting plasma from the star | [imagen+prompt](../06-ingenieria-estelar/076-star-lifting/elegida/15.md) |
| [v10.webp](../../../public/illustrations/selected/star-lifting/v10.webp) | Satélites encauzan una nube de plasma | Satélites encauzan una nube de plasma | Satellites channelling a plasma cloud | [imagen+prompt](../06-ingenieria-estelar/076-star-lifting/elegida/07.md) |
| [v19.webp](../../../public/illustrations/selected/star-lifting/v19.webp) | Arcos de plasma entre las torres curvas | Colector magnético rodeando un arco de plasma | Magnetic collector surrounding an arc of plasma | [imagen+prompt](../06-ingenieria-estelar/076-star-lifting/elegida/16.md) |

## plasma-processing · Procesamiento de plasma estelar

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v19.webp](../../../public/illustrations/selected/plasma-processing/v19.webp) | Una gota cae bajo el plasma | Separador magnético de plasma formando gotas de material | Magnetic plasma separator forming droplets of material | [imagen+prompt](../06-ingenieria-estelar/077-plasma-processing/elegida/18.md) |
| [v11.webp](../../../public/illustrations/selected/plasma-processing/v11.webp) | Una lámina incandescente sale de la prensa | Lámina de metal saliendo de la boquilla de refinado | Metal ribbon emerging from the refining nozzle | [imagen+prompt](../06-ingenieria-estelar/077-plasma-processing/elegida/10.md) |
| [v17.webp](../../../public/illustrations/selected/plasma-processing/v17.webp) | Gotas incandescentes sobre un estanque oscuro | Recipientes de cerámica vertiendo gotas al baño de refinado | Ceramic vessels releasing droplets into the refining bath | [imagen+prompt](../06-ingenieria-estelar/077-plasma-processing/elegida/16.md) |

## stellar-husbandry · Gestión de la evolución estelar

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v13.webp](../../../public/illustrations/selected/stellar-husbandry/v13.webp) | Una red tendida ante la estrella roja | Estaciones de extracción alrededor de una estrella roja | Extraction stations surrounding a red star | [imagen+prompt](../06-ingenieria-estelar/078-stellar-husbandry/elegida/12.md) |
| [v16.webp](../../../public/illustrations/selected/stellar-husbandry/v16.webp) | Esferas alineadas frente al sol rojo | Depósitos esféricos frente a la estrella roja | Spherical reservoirs facing the red star | [imagen+prompt](../06-ingenieria-estelar/078-stellar-husbandry/elegida/15.md) |
| [v08.webp](../../../public/illustrations/selected/stellar-husbandry/v08.webp) | Tanques esféricos bajo la llamarada | Depósitos de gas en la superficie de una luna | Gas reservoirs on the surface of a moon | [imagen+prompt](../06-ingenieria-estelar/078-stellar-husbandry/elegida/07.md) |

## black-hole-engineering · Ingeniería con agujeros negros

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v12.webp](../../../public/illustrations/selected/black-hole-engineering/v12.webp) | Velas oscuras ante el disco brillante | Velas colectoras frente al disco del agujero negro | Collector sails facing the black hole’s disk | [imagen+prompt](../06-ingenieria-estelar/079-black-hole-engineering/elegida/11.md) |
| [v09.webp](../../../public/illustrations/selected/black-hole-engineering/v09.webp) | Paneles frente a un chorro luminoso | Radiadores junto al chorro polar del agujero negro | Radiators beside the black hole’s polar jet | [imagen+prompt](../06-ingenieria-estelar/079-black-hole-engineering/elegida/08.md) |

## kardashev · Escala de Kardashev

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v18.webp](../../../public/illustrations/selected/kardashev/v18.webp) | Un camino curvo bajo una galaxia | Terraza con vistas al planeta, la estrella y la galaxia | Terrace overlooking the planet, star and galaxy | [imagen+prompt](../07-civilizaciones-cosmicas/080-kardashev/elegida/15.md) |
| [v01.webp](../../../public/illustrations/selected/kardashev/v01.webp) | La Tierra, el sol y la galaxia | Planeta, estrella y galaxia en una misma vista | Planet, star and galaxy in a single view | [imagen+prompt](../07-civilizaciones-cosmicas/080-kardashev/elegida/01.md) |
| [v16-e13.webp](../../../public/illustrations/selected/kardashev/v16-e13.webp) | Una pared curva ante la estrella anillada | Monumento energético frente al planeta y la estrella | Energy monument facing the planet and the star | [imagen+prompt](../07-civilizaciones-cosmicas/080-kardashev/elegida/13.md) |

## tipo-i · Civilización Tipo I

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [081-type-i-v01.webp](../../../public/illustrations/selected/tipo-i/081-type-i-v01.webp) | Luces nocturnas vistas desde la órbita | Ciudades iluminadas en la cara nocturna del planeta | Illuminated cities on the planet’s night side | [imagen+prompt](../07-civilizaciones-cosmicas/081-tipo-i/elegida/01.md) |
| [081-type-i-v20.webp](../../../public/illustrations/selected/tipo-i/081-type-i-v20.webp) | Una represa curva frente al oleaje | Compuerta mareomotriz en un océano tormentoso | Tidal power gate in a stormy ocean | [imagen+prompt](../07-civilizaciones-cosmicas/081-tipo-i/elegida/19.md) |
| [081-type-i-v16.webp](../../../public/illustrations/selected/tipo-i/081-type-i-v16.webp) | Cúpulas bajo la aurora | Colectores de energía conectados bajo la aurora | Connected energy collectors beneath the aurora | [imagen+prompt](../07-civilizaciones-cosmicas/081-tipo-i/elegida/15.md) |
| [081-type-i-v19.webp](../../../public/illustrations/selected/tipo-i/081-type-i-v19.webp) | Un hábitat entre muros de hielo | Central geotérmica suspendida en una grieta del glaciar | Geothermal power plant suspended inside a glacier fissure | [imagen+prompt](../07-civilizaciones-cosmicas/081-tipo-i/elegida/18.md) |

## tipo-ii · Civilización Tipo II

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [082-type-ii-v14.webp](../../../public/illustrations/selected/tipo-ii/082-type-ii-v14.webp) | La estrella entre láminas curvas | Colectores curvos alrededor de la estrella | Curved collectors surrounding the star | [imagen+prompt](../07-civilizaciones-cosmicas/082-tipo-ii/elegida/13.md) |
| [082-type-ii-v16.webp](../../../public/illustrations/selected/tipo-ii/082-type-ii-v16.webp) | Una cúpula perforada de luz | Membrana colectora perforada junto a la estrella | Perforated collector membrane beside the star | [imagen+prompt](../07-civilizaciones-cosmicas/082-tipo-ii/elegida/15.md) |
| [082-type-ii-v06.webp](../../../public/illustrations/selected/tipo-ii/082-type-ii-v06.webp) | Mantenimiento bajo un eclipse | Robot reemplazando un radiador bajo el eclipse | Robot replacing a radiator during the eclipse | [imagen+prompt](../07-civilizaciones-cosmicas/082-tipo-ii/elegida/05.md) |

## tipo-iii · Civilización Tipo III

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [083-type-iii-v18.webp](../../../public/illustrations/selected/tipo-iii/083-type-iii-v18.webp) | Ramales que atraviesan la galaxia | Conductos de energía atravesando la galaxia | Energy conduits crossing the galaxy | [imagen+prompt](../07-civilizaciones-cosmicas/083-tipo-iii/elegida/17.md) |
| [083-type-iii-v13.webp](../../../public/illustrations/selected/tipo-iii/083-type-iii-v13.webp) | Una nave entre armazón y galaxia | Entramado recolector frente al núcleo de la galaxia | Collector lattice facing the galaxy’s core | [imagen+prompt](../07-civilizaciones-cosmicas/083-tipo-iii/elegida/12.md) |
| [083-type-iii-v20.webp](../../../public/illustrations/selected/tipo-iii/083-type-iii-v20.webp) | Arcos que abrazan la galaxia | Galaxia atravesada por megastructuras en arco | Galaxy crossed by arched megastructures | [imagen+prompt](../07-civilizaciones-cosmicas/083-tipo-iii/elegida/19.md) |

## computronium · Computronium

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v06.webp](../../../public/illustrations/selected/computronium/v06.webp) | Filas de bloques negros sobre el acantilado | Red de computación recubriendo un acantilado lunar | Computing lattice covering a lunar cliff | [imagen+prompt](../07-civilizaciones-cosmicas/084-computronium/elegida/04.md) |
| [v16-e14.webp](../../../public/illustrations/selected/computronium/v16-e14.webp) | Un arco oscuro que brota del suelo | Materia programable formando una lámina arqueada | Programmable matter forming an arched sheet | [imagen+prompt](../07-civilizaciones-cosmicas/084-computronium/elegida/14.md) |
| [v15.webp](../../../public/illustrations/selected/computronium/v15.webp) | Roca que se vuelve cinta perforada | Bloque de materia programable desplegado en lámina | Block of programmable matter unfolded into a sheet | [imagen+prompt](../07-civilizaciones-cosmicas/084-computronium/elegida/13.md) |
| [v11.webp](../../../public/illustrations/selected/computronium/v11.webp) | Un asteroide convertido en placas hexagonales | Robot transformando la roca en placas de computación | Robot turning rock into computing panels | [imagen+prompt](../07-civilizaciones-cosmicas/084-computronium/elegida/09.md) |

## jupiter-brain · Cerebro Júpiter

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v06.webp](../../../public/illustrations/selected/jupiter-brain/v06.webp) | Una nave entre anillos de roca | Planeta computacional visto entre los anillos de hielo | Computing planet seen among the icy rings | [imagen+prompt](../07-civilizaciones-cosmicas/085-jupiter-brain/elegida/04.md) |
| [v17.webp](../../../public/illustrations/selected/jupiter-brain/v17.webp) | Cascos inmensos sobre nubes cobrizas | Lóbulos de computación sobre las nubes de Júpiter | Computing lobes above Jupiter’s clouds | [imagen+prompt](../07-civilizaciones-cosmicas/085-jupiter-brain/elegida/15.md) |
| [v16-e14.webp](../../../public/illustrations/selected/jupiter-brain/v16-e14.webp) | Una concha estriada sobre la tormenta | Envoltura de refrigeración alrededor de un módulo de computación | Cooling shroud around a computing module | [imagen+prompt](../07-civilizaciones-cosmicas/085-jupiter-brain/elegida/14.md) |

## matrioshka-brain · Cerebro Matrioshka

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v15.webp](../../../public/illustrations/selected/matrioshka-brain/v15.webp) | Capas en espiral hacia el núcleo | Capas térmicas abiertas alrededor de una estrella | Open thermal shells surrounding a star | [imagen+prompt](../07-civilizaciones-cosmicas/086-matrioshka-brain/elegida/14.md) |
| [v02.webp](../../../public/illustrations/selected/matrioshka-brain/v02.webp) | Hacia la estrella entre capas inacabadas | Capas concéntricas en construcción alrededor de la estrella | Concentric shells under construction around the star | solo imagen |
| [v01.webp](../../../public/illustrations/selected/matrioshka-brain/v01.webp) | Cascarones concéntricos alrededor del sol | Capas de paneles concéntricos alrededor de la estrella | Concentric layers of panels surrounding the star | [imagen+prompt](../07-civilizaciones-cosmicas/086-matrioshka-brain/elegida/01.md) |
| [v16.webp](../../../public/illustrations/selected/matrioshka-brain/v16.webp) | Un resplandor entre las capas curvas | Estrella visible entre las capas de computación | Star visible between the computing shells | [imagen+prompt](../07-civilizaciones-cosmicas/086-matrioshka-brain/elegida/15.md) |

## civilizaciones-digitales · Civilizaciones digitales

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [087-digital-civilizations-v19.webp](../../../public/illustrations/selected/civilizaciones-digitales/087-digital-civilizations-v19.webp) | Cápsulas luminosas colgando en espiral | Cápsulas de memoria suspendidas en la caverna | Memory capsules suspended inside the cavern | [imagen+prompt](../07-civilizaciones-cosmicas/087-civilizaciones-digitales/elegida/17.md) |
| [087-digital-civilizations-v09.webp](../../../public/illustrations/selected/civilizaciones-digitales/087-digital-civilizations-v09.webp) | Radiadores humeantes hundidos en el hielo | Radiadores de un centro de cómputo enterrado en hielo | Radiators of a computing facility buried in ice | [imagen+prompt](../07-civilizaciones-cosmicas/087-civilizaciones-digitales/elegida/07.md) |
| [087-digital-civilizations-v18.webp](../../../public/illustrations/selected/civilizaciones-digitales/087-digital-civilizations-v18.webp) | Miles de discos sobre el agua | Discos de memoria flotando en un canal | Memory disks floating along a channel | [imagen+prompt](../07-civilizaciones-cosmicas/087-civilizaciones-digitales/elegida/16.md) |
| [087-digital-civilizations-v05.webp](../../../public/illustrations/selected/civilizaciones-digitales/087-digital-civilizations-v05.webp) | Torres de cómputo dentro de un asteroide | Torres de cómputo dentro de un asteroide | Computing towers inside an asteroid | solo imagen |
| [087-digital-civilizations-v21.webp](../../../public/illustrations/selected/civilizaciones-digitales/087-digital-civilizations-v21.webp) | Columnas de luz sobre el lago interior | Módulos de memoria suspendidos sobre el refrigerante | Memory modules suspended above the coolant | [imagen+prompt](../07-civilizaciones-cosmicas/087-civilizaciones-digitales/elegida/19.md) |

## postbiological · Civilizaciones postbiológicas

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v10.webp](../../../public/illustrations/selected/postbiological/v10.webp) | Antenas que emergen del mar al atardecer | Máquina articulada levantando un radiador desde el mar | Articulated machine lifting a radiator from the sea | [imagen+prompt](../07-civilizaciones-cosmicas/088-postbiological/elegida/09.md) |
| [v18.webp](../../../public/illustrations/selected/postbiological/v18.webp) | Una hoja translúcida sobre el salar | Máquina flotante con una lámina neuronal desplegada | Floating machine with a deployed neural sheet | [imagen+prompt](../07-civilizaciones-cosmicas/088-postbiological/elegida/17.md) |
| [v01.webp](../../../public/illustrations/selected/postbiological/v01.webp) | Robots que colocan placas sobre el hielo | Robot sustituyendo paneles del radiador sobre el hielo | Robot replacing radiator panels on the ice | [imagen+prompt](../07-civilizaciones-cosmicas/088-postbiological/elegida/01.md) |
| [v17.webp](../../../public/illustrations/selected/postbiological/v17.webp) | Una concha de vidrio sobre la nieve | Máquina de caparazón transparente sobre patas radiales | Machine with a transparent shell on radial stilts | [imagen+prompt](../07-civilizaciones-cosmicas/088-postbiological/elegida/16.md) |

## von-neumann · Sondas de von Neumann

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v17.webp](../../../public/illustrations/selected/von-neumann/v17.webp) | Una máquina procesa mineral en la orilla | Sonda ensamblando una copia de sí misma | Probe assembling a copy of itself | [imagen+prompt](../07-civilizaciones-cosmicas/089-von-neumann/elegida/16.md) |
| [v21.webp](../../../public/illustrations/selected/von-neumann/v21.webp) | Dos sondas gemelas dentro de la caverna | Dos sondas gemelas dentro de la caverna | Twin probes inside a cavern | [imagen+prompt](../07-civilizaciones-cosmicas/089-von-neumann/elegida/20.md) |
| [v16.webp](../../../public/illustrations/selected/von-neumann/v16.webp) | Una esfera entre dos cáscaras abiertas | Nueva sonda entre las mitades de la máquina | New probe between the machine’s halves | [imagen+prompt](../07-civilizaciones-cosmicas/089-von-neumann/elegida/15.md) |

## colonizacion-galactica · Colonización galáctica

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [090-galactic-colonization-v14.webp](../../../public/illustrations/selected/colonizacion-galactica/090-galactic-colonization-v14.webp) | Cápsulas que descienden hacia el mar | Hábitat semilla desplegando una ciudad sobre el océano | Seed habitat unfolding into a city above the ocean | [imagen+prompt](../07-civilizaciones-cosmicas/090-colonizacion-galactica/elegida/13.md) |
| [090-galactic-colonization-v17.webp](../../../public/illustrations/selected/colonizacion-galactica/090-galactic-colonization-v17.webp) | Viviendas talladas en los acantilados | Viviendas adosadas a los acantilados | Homes attached to the cliff faces | [imagen+prompt](../07-civilizaciones-cosmicas/090-colonizacion-galactica/elegida/16.md) |
| [090-galactic-colonization-v08.webp](../../../public/illustrations/selected/colonizacion-galactica/090-galactic-colonization-v08.webp) | Una flota zarpa hacia la Vía Láctea | Naves colonizadoras llegando a un nuevo sistema estelar | Colony ships arriving in a new star system | [imagen+prompt](../07-civilizaciones-cosmicas/090-colonizacion-galactica/elegida/07.md) |
| [090-galactic-colonization-v15.webp](../../../public/illustrations/selected/colonizacion-galactica/090-galactic-colonization-v15.webp) | Un puente con jardines sobre la niebla | Un puente con jardines sobre la niebla | A garden bridge above the mist | [imagen+prompt](../07-civilizaciones-cosmicas/090-colonizacion-galactica/elegida/14.md) |

## civilizaciones-y-luz · Civilizaciones y velocidad de la luz

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [091-civilizations-light-v21.webp](../../../public/illustrations/selected/civilizaciones-y-luz/091-civilizations-light-v21.webp) | Un haz cruza la noche helada | Antena receptora de señales láser sobre el hielo | Laser signal receiving antenna on the ice | [imagen+prompt](../07-civilizaciones-cosmicas/091-civilizaciones-y-luz/elegida/21.md) |
| [091-civilizations-light-v18.webp](../../../public/illustrations/selected/civilizaciones-y-luz/091-civilizations-light-v18.webp) | Una hilera de antenas en la llanura | Cápsulas de mensajes alineadas en la llanura | Message capsules aligned across the plain | [imagen+prompt](../07-civilizaciones-cosmicas/091-civilizaciones-y-luz/elegida/18.md) |
| [091-civilizations-light-v01.webp](../../../public/illustrations/selected/civilizaciones-y-luz/091-civilizations-light-v01.webp) | Dos mundos separados por el vacío | Estaciones de comunicación en dos sistemas estelares | Communications stations in two star systems | [imagen+prompt](../07-civilizaciones-cosmicas/091-civilizaciones-y-luz/elegida/01.md) |
| [091-civilizations-light-v01-e01.webp](../../../public/illustrations/selected/civilizaciones-y-luz/091-civilizations-light-v01-e01.webp) | Una gran sombra frente a una estrella lejana | Antenas en mundos separados por el vacío | Antennas on worlds separated by the void | solo imagen |

## deep-time · Tiempo profundo

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v09.webp](../../../public/illustrations/selected/deep-time/v09.webp) | Una nave ilumina una sonda olvidada | Una nave ilumina una sonda olvidada | A ship lighting a forgotten probe | [imagen+prompt](../07-civilizaciones-cosmicas/092-deep-time/elegida/08.md) |
| [v21-e20.webp](../../../public/illustrations/selected/deep-time/v21-e20.webp) | Una puerta sellada entre dunas | Compuerta de una estructura antigua semienterrada en dunas | Hatch of an ancient structure half buried in dunes | [imagen+prompt](../07-civilizaciones-cosmicas/092-deep-time/elegida/20.md) |
| [v15.webp](../../../public/illustrations/selected/deep-time/v15.webp) | Arcos gigantes cubiertos de polvo | Restos de una máquina colosal entre estratos de roca | Remains of a colossal machine among layers of rock | [imagen+prompt](../07-civilizaciones-cosmicas/092-deep-time/elegida/14.md) |
| [v13.webp](../../../public/illustrations/selected/deep-time/v13.webp) | Un rover junto a ruinas de sal | Rover descubriendo una antena enterrada en sal | Rover discovering an antenna buried in salt | [imagen+prompt](../07-civilizaciones-cosmicas/092-deep-time/elegida/12.md) |
| [v12.webp](../../../public/illustrations/selected/deep-time/v12.webp) | Descenso por un pozo de hielo | Taladro descendiendo hacia una máquina bajo el hielo | Drill descending toward a machine beneath the ice | [imagen+prompt](../07-civilizaciones-cosmicas/092-deep-time/elegida/11.md) |
| [v11.webp](../../../public/illustrations/selected/deep-time/v11.webp) | Una máquina incrustada en el cañón | Una máquina incrustada en el cañón | A machine embedded in the canyon wall | [imagen+prompt](../07-civilizaciones-cosmicas/092-deep-time/elegida/10.md) |
| [v08.webp](../../../public/illustrations/selected/deep-time/v08.webp) | Un rover en el hangar en ruinas | Un rover en el hangar en ruinas | A rover in a ruined hangar | [imagen+prompt](../07-civilizaciones-cosmicas/092-deep-time/elegida/07.md) |
| [v03.webp](../../../public/illustrations/selected/deep-time/v03.webp) | Un brazo robótico repara el casco | Brazo robótico sustituyendo el radiador de un archivo orbital | Robotic arm replacing an orbital archive’s radiator | [imagen+prompt](../07-civilizaciones-cosmicas/092-deep-time/elegida/02.md) |
| [v17.webp](../../../public/illustrations/selected/deep-time/v17.webp) | Una bóveda estriada junto al glaciar | Máquina antigua erosionada junto al glaciar | Ancient eroded machine beside the glacier | [imagen+prompt](../07-civilizaciones-cosmicas/092-deep-time/elegida/16.md) |
| [v04.webp](../../../public/illustrations/selected/deep-time/v04.webp) | Observatorios al borde del acantilado helado | Observatorios al borde del acantilado helado | Observatories on a frozen cliff edge | [imagen+prompt](../07-civilizaciones-cosmicas/092-deep-time/elegida/03.md) |

## future-universe · Futuro lejano del universo

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v21.webp](../../../public/illustrations/selected/future-universe/v21.webp) | Un ojo rojo sobre el mar helado | Hábitat con colector en espiral sobre el océano helado | Habitat with a spiral collector above the frozen ocean | [imagen+prompt](../07-civilizaciones-cosmicas/093-future-universe/elegida/20.md) |
| [v20-e19.webp](../../../public/illustrations/selected/future-universe/v20-e19.webp) | Un bosque iluminado bajo la nieve | Bosque preservado dentro de una nave cubierta de escarcha | Forest preserved inside a frost covered ship | [imagen+prompt](../07-civilizaciones-cosmicas/093-future-universe/elegida/19.md) |
| [v17.webp](../../../public/illustrations/selected/future-universe/v17.webp) | Escarcha sobre un casco en la oscuridad | Depósito de energía cubierto de escarcha en el vacío | Frost covered energy reservoir in the void | [imagen+prompt](../07-civilizaciones-cosmicas/093-future-universe/elegida/16.md) |
| [v16.webp](../../../public/illustrations/selected/future-universe/v16.webp) | Un sol rojo entre muros estriados | Muros protectores alrededor de un núcleo energético | Protective walls surrounding an energy core | [imagen+prompt](../07-civilizaciones-cosmicas/093-future-universe/elegida/15.md) |
| [v05.webp](../../../public/illustrations/selected/future-universe/v05.webp) | Un observatorio helado bajo un sol tenue | Observatorio helado bajo una enana roja | Frozen observatory beneath a red dwarf | [imagen+prompt](../07-civilizaciones-cosmicas/093-future-universe/elegida/04.md) |
| [v03.webp](../../../public/illustrations/selected/future-universe/v03.webp) | Una nave cruza ante la gigante roja | Colector energético junto a una enana roja | Energy collector beside a red dwarf | [imagen+prompt](../07-civilizaciones-cosmicas/093-future-universe/elegida/02.md) |
| [v21-e20.webp](../../../public/illustrations/selected/future-universe/v21-e20.webp) | Una estructura vigila un mar helado | Nave de alas curvas sobre el mar helado | Ship with curved wings above the frozen sea | solo imagen |
| [v05-e04.webp](../../../public/illustrations/selected/future-universe/v05-e04.webp) | Un observatorio bajo una estrella roja | Un observatorio bajo una estrella roja | An observatory beneath a red star | solo imagen |

## cosmic-ethics · Ética cósmica

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v06.webp](../../../public/illustrations/selected/cosmic-ethics/v06.webp) | Una sonda deja caer una gota | Sonda de muestreo sobre un arrecife alienígena | Sampling probe above an alien reef | [imagen+prompt](../07-civilizaciones-cosmicas/094-cosmic-ethics/elegida/05.md) |
| [v05.webp](../../../public/illustrations/selected/cosmic-ethics/v05.webp) | Una nave suspendida sobre la marisma | Una nave suspendida sobre la marisma | A craft hovering above the tidal flats | [imagen+prompt](../07-civilizaciones-cosmicas/094-cosmic-ethics/elegida/04.md) |
| [v07.webp](../../../public/illustrations/selected/cosmic-ethics/v07.webp) | Un taladro sobre las criaturas del hielo | Taladro detenido sobre criaturas bajo el hielo | Drill stopped above creatures beneath the ice | [imagen+prompt](../07-civilizaciones-cosmicas/094-cosmic-ethics/elegida/06.md) |
| [v14.webp](../../../public/illustrations/selected/cosmic-ethics/v14.webp) | Un jardín protegido bajo la cúpula | Un jardín protegido bajo la cúpula | A garden sheltered beneath the dome | [imagen+prompt](../07-civilizaciones-cosmicas/094-cosmic-ethics/elegida/13.md) |
| [v17.webp](../../../public/illustrations/selected/cosmic-ethics/v17.webp) | Vida resguardada en una vitrina | Semillas alienígenas protegidas tras el vidrio | Alien seeds protected behind glass | [imagen+prompt](../07-civilizaciones-cosmicas/094-cosmic-ethics/elegida/16.md) |
| [v20-e19.webp](../../../public/illustrations/selected/cosmic-ethics/v20-e19.webp) | Semillas flotantes bajo el puente | Semillas flotantes bajo el puente | Floating seeds beneath the bridge | [imagen+prompt](../07-civilizaciones-cosmicas/094-cosmic-ethics/elegida/19.md) |

## seti · SETI

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v20.webp](../../../public/illustrations/selected/seti/v20.webp) | Una antena entre hielo y aurora | Una antena entre hielo y aurora | A dish between ice and aurora | [imagen+prompt](../08-inteligencia-extraterrestre/095-seti/elegida/19.md) |
| [v16.webp](../../../public/illustrations/selected/seti/v16.webp) | Torres blancas en el desierto al atardecer | Antenas de escucha alineadas en el desierto | Listening antennas aligned across the desert | [imagen+prompt](../08-inteligencia-extraterrestre/095-seti/elegida/15.md) |
| [v18.webp](../../../public/illustrations/selected/seti/v18.webp) | Una antena reflejada en aguas quietas | Una antena reflejada en aguas quietas | A dish mirrored in still water | [imagen+prompt](../08-inteligencia-extraterrestre/095-seti/elegida/17.md) |
| [v15.webp](../../../public/illustrations/selected/seti/v15.webp) | Un gran reflector en una luna nevada | Un gran reflector en una luna nevada | A great reflector on a snowy moon | [imagen+prompt](../08-inteligencia-extraterrestre/095-seti/elegida/14.md) |

## technosignatures · Tecnofirmas

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v09.webp](../../../public/illustrations/selected/technosignatures/v09.webp) | Una línea recta a través del relieve | Conducto industrial atravesando la superficie del planeta | Industrial conduit crossing the planet’s surface | [imagen+prompt](../08-inteligencia-extraterrestre/096-technosignatures/elegida/09.md) |
| [v11.webp](../../../public/illustrations/selected/technosignatures/v11.webp) | Placas lisas entre los hielos del anillo | Colectores artificiales entre el hielo del anillo | Artificial collectors among the ring’s ice | [imagen+prompt](../08-inteligencia-extraterrestre/096-technosignatures/elegida/11.md) |
| [v18.webp](../../../public/illustrations/selected/technosignatures/v18.webp) | Un casco ovalado entre los asteroides | Asteroide remodelado en una estructura ovalada | Asteroid reshaped into an oval structure | [imagen+prompt](../08-inteligencia-extraterrestre/096-technosignatures/elegida/18.md) |
| [v16.webp](../../../public/illustrations/selected/technosignatures/v16.webp) | Un objeto semienterrado bajo esferas alineadas | Sensor semienterrado bajo una hilera de esferas | Half buried sensor beneath a row of spheres | [imagen+prompt](../08-inteligencia-extraterrestre/096-technosignatures/elegida/16.md) |

## radio-seti · SETI por radio

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v20.webp](../../../public/illustrations/selected/radio-seti/v20.webp) | Antenas reflejadas en el lago nocturno | Antenas reflejadas en el lago nocturno | Dishes reflected in a night lake | [imagen+prompt](../08-inteligencia-extraterrestre/097-radio-seti/elegida/19.md) |
| [v14.webp](../../../public/illustrations/selected/radio-seti/v14.webp) | Un gran reflector tendido sobre el hielo | Antena de malla tendida sobre el hielo | Mesh antenna stretched above the ice | [imagen+prompt](../08-inteligencia-extraterrestre/097-radio-seti/elegida/13.md) |
| [v12.webp](../../../public/illustrations/selected/radio-seti/v12.webp) | Un rover entre campos de antenas | Un rover entre campos de antenas | A rover among fields of antennas | [imagen+prompt](../08-inteligencia-extraterrestre/097-radio-seti/elegida/11.md) |
| [v10.webp](../../../public/illustrations/selected/radio-seti/v10.webp) | Mallas suspendidas sobre un cráter | Antenas de malla suspendidas sobre un cráter | Mesh antennas suspended above a crater | [imagen+prompt](../08-inteligencia-extraterrestre/097-radio-seti/elegida/09.md) |

## optical-seti · SETI óptico

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v19.webp](../../../public/illustrations/selected/optical-seti/v19.webp) | Un láser sobre el mar de nubes | Receptor óptico captando un pulso láser entre las nubes | Optical receiver catching a laser pulse among the clouds | [imagen+prompt](../08-inteligencia-extraterrestre/098-optical-seti/elegida/18.md) |
| [v15.webp](../../../public/illustrations/selected/optical-seti/v15.webp) | El gran espejo entre las montañas | Espejo de telescopio entre montañas nevadas | Telescope mirror among snowy mountains | [imagen+prompt](../08-inteligencia-extraterrestre/098-optical-seti/elegida/14.md) |
| [v18.webp](../../../public/illustrations/selected/optical-seti/v18.webp) | Un haz láser cruza el cielo al atardecer | Lámina receptora guiando un pulso láser al detector | Receiver blade guiding a laser pulse to the detector | [imagen+prompt](../08-inteligencia-extraterrestre/098-optical-seti/elegida/17.md) |
| [v11.webp](../../../public/illustrations/selected/optical-seti/v11.webp) | Un telescopio en el espacio frente a una estrella | Un telescopio en el espacio frente a una estrella | A space telescope facing a star | [imagen+prompt](../08-inteligencia-extraterrestre/098-optical-seti/elegida/10.md) |

## stellar-technosignatures · Tecnofirmas de ingeniería estelar

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v17.webp](../../../public/illustrations/selected/stellar-technosignatures/v17.webp) | Un módulo observa la estrella velada | Detector óptico ante las bandas que ocultan la estrella | Optical detector facing bands obscuring the star | [imagen+prompt](../08-inteligencia-extraterrestre/099-stellar-technosignatures/elegida/14.md) |
| [v09.webp](../../../public/illustrations/selected/stellar-technosignatures/v09.webp) | Antenas ante una estrella parcialmente cubierta | Interferómetro observando una estrella parcialmente cubierta | Interferometer observing a partially obscured star | [imagen+prompt](../08-inteligencia-extraterrestre/099-stellar-technosignatures/elegida/06.md) |
| [v16-e13.webp](../../../public/illustrations/selected/stellar-technosignatures/v16-e13.webp) | Bandas que cruzan el disco estelar | Red de filamentos ocultando parte de la estrella | Filament network obscuring part of the star | [imagen+prompt](../08-inteligencia-extraterrestre/099-stellar-technosignatures/elegida/13.md) |

## fermi · Paradoja de Fermi

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v06.webp](../../../public/illustrations/selected/fermi/v06.webp) | Una antena entre dos mundos azules | Una antena entre dos mundos azules | A dish between two blue worlds | [imagen+prompt](../08-inteligencia-extraterrestre/100-fermi/elegida/06.md) |
| [v16.webp](../../../public/illustrations/selected/fermi/v16.webp) | Una estructura reflejada en el salar | Estación receptora desierta reflejada en el salar | Deserted receiving station reflected in the salt flat | [imagen+prompt](../08-inteligencia-extraterrestre/100-fermi/elegida/16.md) |
| [v14.webp](../../../public/illustrations/selected/fermi/v14.webp) | Cápsulas blancas bajo la Vía Láctea | Cápsulas de llegada cerradas bajo la Vía Láctea | Sealed arrival capsules beneath the Milky Way | [imagen+prompt](../08-inteligencia-extraterrestre/100-fermi/elegida/14.md) |
| [v10.webp](../../../public/illustrations/selected/fermi/v10.webp) | Un vehículo ante la puerta colosal | Rover explorador ante una compuerta colosal | Exploration rover facing a colossal gateway | [imagen+prompt](../08-inteligencia-extraterrestre/100-fermi/elegida/10.md) |

## great-filter · Gran filtro

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v15.webp](../../../public/illustrations/selected/great-filter/v15.webp) | Un casco partido en la costa helada | Carcasa de lanzamiento petrificada junto al mar helado | Petrified launch shell beside the frozen sea | [imagen+prompt](../08-inteligencia-extraterrestre/101-great-filter/elegida/15.md) |
| [v03.webp](../../../public/illustrations/selected/great-filter/v03.webp) | Una máquina varada junto a los rieles | Máquina cilíndrica abandonada junto a las vías | Abandoned cylindrical machine beside the tracks | solo imagen |
| [v04.webp](../../../public/illustrations/selected/great-filter/v04.webp) | Torres oxidadas y una antena caída | Torres de combustible abandonadas y una antena caída | Abandoned fuel towers and a fallen antenna | [imagen+prompt](../08-inteligencia-extraterrestre/101-great-filter/elegida/04.md) |
| [v08.webp](../../../public/illustrations/selected/great-filter/v08.webp) | Cohetes abandonados bajo el andamio | Cohetes abandonados bajo el andamio | Abandoned rockets beneath the scaffolding | [imagen+prompt](../08-inteligencia-extraterrestre/101-great-filter/elegida/08.md) |
| [v16.webp](../../../public/illustrations/selected/great-filter/v16.webp) | Una esfera oscura frente a las ruinas | Máquina de extremidades incompletas junto a un módulo semilla | Machine with unfinished limbs beside a seed module | [imagen+prompt](../08-inteligencia-extraterrestre/101-great-filter/elegida/16.md) |
| [v19.webp](../../../public/illustrations/selected/great-filter/v19.webp) | Un puente roto sobre el abismo | Arco de lanzamiento roto sobre un abismo | Broken launch arc spanning a chasm | [imagen+prompt](../08-inteligencia-extraterrestre/101-great-filter/elegida/19.md) |
| [v17.webp](../../../public/illustrations/selected/great-filter/v17.webp) | Cascarones blancos entre rocas negras | Carcasas de vuelo parcialmente abiertas entre las rocas | Flight shells partly open among the rocks | [imagen+prompt](../08-inteligencia-extraterrestre/101-great-filter/elegida/17.md) |

## zoo-hypothesis · Hipótesis del zoológico

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v05.webp](../../../public/illustrations/selected/zoo-hypothesis/v05.webp) | La Tierra vista desde un escondite | Sensor oculto en una caverna con vistas a la Tierra | Hidden cave sensor overlooking Earth | [imagen+prompt](../08-inteligencia-extraterrestre/102-zoo-hypothesis/elegida/04.md) |
| [v15.webp](../../../public/illustrations/selected/zoo-hypothesis/v15.webp) | Un disco oscuro sobre las nubes | Estación de observación camuflada sobre las nubes | Camouflaged observation station above the clouds | [imagen+prompt](../08-inteligencia-extraterrestre/102-zoo-hypothesis/elegida/14.md) |

## dark-forest · Hipótesis del bosque oscuro

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v15.webp](../../../public/illustrations/selected/dark-forest/v15.webp) | Una cúpula oscura en el lago | Antena de retransmisión sumergiéndose en el lago | Relay antenna sinking beneath the lake | [imagen+prompt](../08-inteligencia-extraterrestre/103-dark-forest/elegida/15.md) |
| [v16.webp](../../../public/illustrations/selected/dark-forest/v16.webp) | Una cápsula oculta en el tronco | Sensor de escucha oculto en un tronco | Listening sensor hidden inside a tree trunk | [imagen+prompt](../08-inteligencia-extraterrestre/103-dark-forest/elegida/16.md) |
| [v13.webp](../../../public/illustrations/selected/dark-forest/v13.webp) | Una rendija de luz en el casco | Antena plegándose dentro de una carcasa estriada | Antenna folding into a ribbed shell | [imagen+prompt](../08-inteligencia-extraterrestre/103-dark-forest/elegida/13.md) |
| [v08.webp](../../../public/illustrations/selected/dark-forest/v08.webp) | Una antena entreabierta ante la nebulosa | Antena cerrando sus paneles ante la nebulosa | Antenna closing its panels in front of the nebula | [imagen+prompt](../08-inteligencia-extraterrestre/103-dark-forest/elegida/08.md) |
| [v17.webp](../../../public/illustrations/selected/dark-forest/v17.webp) | Una nave oscura al borde del planeta | Nave de comunicaciones ocultando su interior iluminado | Communications craft concealing its illuminated interior | [imagen+prompt](../08-inteligencia-extraterrestre/103-dark-forest/elegida/17.md) |

## grabby-aliens · Civilizaciones expansivas (grabby aliens)

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v16.webp](../../../public/illustrations/selected/grabby-aliens/v16.webp) | Cascos a medio construir en órbita | Colectores en construcción sobre el anillo planetario | Collectors under construction along the planetary ring | [imagen+prompt](../08-inteligencia-extraterrestre/104-grabby-aliens/elegida/15.md) |
| [v01.webp](../../../public/illustrations/selected/grabby-aliens/v01.webp) | Tres regiones teñidas de la red cósmica | Galaxias agrupadas en tres regiones de expansión | Galaxies grouped into three expanding regions | [imagen+prompt](../08-inteligencia-extraterrestre/104-grabby-aliens/elegida/01.md) |
| [v20-e19.webp](../../../public/illustrations/selected/grabby-aliens/v20-e19.webp) | Cápsulas que caen desde el anillo | Nave colonizadora liberando cápsulas habitables entre las nubes | Colony ship releasing habitat capsules among the clouds | [imagen+prompt](../08-inteligencia-extraterrestre/104-grabby-aliens/elegida/19.md) |
| [v17.webp](../../../public/illustrations/selected/grabby-aliens/v17.webp) | Terrazas concéntricas alrededor de la torre | Máquinas desplegando colectores alrededor de la torre | Machines deploying collectors around the tower | [imagen+prompt](../08-inteligencia-extraterrestre/104-grabby-aliens/elegida/16.md) |

## civilizaciones-silenciosas · Civilizaciones silenciosas

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [105-silent-civilizations-v18.webp](../../../public/illustrations/selected/civilizaciones-silenciosas/105-silent-civilizations-v18.webp) | Anillos sumergidos bajo el atardecer | Edificios sumergidos bajo el agua transparente | Buildings submerged beneath clear water | [imagen+prompt](../08-inteligencia-extraterrestre/105-civilizaciones-silenciosas/elegida/17.md) |
| [105-silent-civilizations-v19.webp](../../../public/illustrations/selected/civilizaciones-silenciosas/105-silent-civilizations-v19.webp) | Techos oscuros que imitan las dunas | Manta térmica ocultando una ciudad lunar | Thermal blanket concealing a lunar city | [imagen+prompt](../08-inteligencia-extraterrestre/105-civilizaciones-silenciosas/elegida/18.md) |
| [105-silent-civilizations-v17.webp](../../../public/illustrations/selected/civilizaciones-silenciosas/105-silent-civilizations-v17.webp) | Terrazas en una caverna rosada | Ciudad oculta dentro de una geoda | City hidden inside a geode | [imagen+prompt](../08-inteligencia-extraterrestre/105-civilizaciones-silenciosas/elegida/16.md) |
| [105-silent-civilizations-v16.webp](../../../public/illustrations/selected/civilizaciones-silenciosas/105-silent-civilizations-v16.webp) | Una curva plateada en el bosque | Techo de una ciudad camuflada entre el bosque | Roof of a city camouflaged within the forest | [imagen+prompt](../08-inteligencia-extraterrestre/105-civilizaciones-silenciosas/elegida/15.md) |
| [105-silent-civilizations-v14.webp](../../../public/illustrations/selected/civilizaciones-silenciosas/105-silent-civilizations-v14.webp) | Una entrada oculta bajo la escarcha | Techos de una ciudad ocultos bajo la escarcha | City roofs hidden beneath the frost | [imagen+prompt](../08-inteligencia-extraterrestre/105-civilizaciones-silenciosas/elegida/13.md) |
| [105-silent-civilizations-v11.webp](../../../public/illustrations/selected/civilizaciones-silenciosas/105-silent-civilizations-v11.webp) | Una estructura bajo el frente glaciar | Ciudad submarina revelada bajo el iceberg fracturado | Underwater city revealed beneath the fractured iceberg | [imagen+prompt](../08-inteligencia-extraterrestre/105-civilizaciones-silenciosas/elegida/10.md) |
| [105-silent-civilizations-v10.webp](../../../public/illustrations/selected/civilizaciones-silenciosas/105-silent-civilizations-v10.webp) | Una ciudad iluminada bajo la arena | Compuerta abierta sobre una ciudad enterrada en arena | Open hatch above a city buried in sand | [imagen+prompt](../08-inteligencia-extraterrestre/105-civilizaciones-silenciosas/elegida/09.md) |

## berserker · Sondas destructoras (berserker)

| Archivo | Título anterior (es) | Título nuevo (es) | Nuevo (en) | Fuente |
| --- | --- | --- | --- | --- |
| [v14.webp](../../../public/illustrations/selected/berserker/v14.webp) | Una esfera oscura desarma la estructura | Sonda desmontando las costillas de un hábitat | Probe dismantling the structural ribs of a habitat | [imagen+prompt](../08-inteligencia-extraterrestre/106-berserker/elegida/13.md) |
| [v20.webp](../../../public/illustrations/selected/berserker/v20.webp) | Un casco abierto en el cráter helado | Carcasa de una máquina abriéndose en el cráter | Machine shell opening inside the crater | [imagen+prompt](../08-inteligencia-extraterrestre/106-berserker/elegida/19.md) |
| [v18.webp](../../../public/illustrations/selected/berserker/v18.webp) | Una esfera negra dentro de la estación | Sonda cortando los soportes del hábitat orbital | Probe cutting the orbital habitat’s supports | [imagen+prompt](../08-inteligencia-extraterrestre/106-berserker/elegida/17.md) |
| [v09.webp](../../../public/illustrations/selected/berserker/v09.webp) | Una nave oscura entre los restos | Sonda autónoma atravesando un astillero destruido | Autonomous probe passing through a ruined shipyard | [imagen+prompt](../08-inteligencia-extraterrestre/106-berserker/elegida/08.md) |
| [v16.webp](../../../public/illustrations/selected/berserker/v16.webp) | Un bloque negro devora la estación | Máquina cúbica absorbiendo las piezas del hábitat | Cubic machine drawing in the habitat’s components | [imagen+prompt](../08-inteligencia-extraterrestre/106-berserker/elegida/15.md) |

## Imágenes sin prompt asociado

| Obra | Archivo | Motivo |
| --- | --- | --- |
| iss | v01.webp | El original o la copia web no tiene un .md contiguo |
| life-support | v01.webp | El original o la copia web no tiene un .md contiguo |
| life-support | v08.webp | El original o la copia web no tiene un .md contiguo |
| bernal-sphere | v14.webp | El original o la copia web no tiene un .md contiguo |
| stanford-torus | v11.webp | El original o la copia web no tiene un .md contiguo |
| stanford-torus | v12.webp | El original o la copia web no tiene un .md contiguo |
| oneill-cylinder | v10-reflejo.webp | El original o la copia web no tiene un .md contiguo |
| oneill-cylinder | v11.webp | El original o la copia web no tiene un .md contiguo |
| bishop-ring | v01.webp | El original o la copia web no tiene un .md contiguo |
| mckendree-cylinder | v01.webp | Sin correspondencia inequívoca con un original documentado |
| mckendree-cylinder | v14.webp | El original o la copia web no tiene un .md contiguo |
| mckendree-cylinder | interior-cinematic-v01.webp | El original o la copia web no tiene un .md contiguo |
| mckendree-cylinder | v15.webp | El original o la copia web no tiene un .md contiguo |
| ringworld | v11.webp | El original o la copia web no tiene un .md contiguo |
| reusable-launch | v7.webp | El original o la copia web no tiene un .md contiguo |
| space-elevator | v18.webp | Sin correspondencia inequívoca con un original documentado |
| project-orion | v02.webp | El original o la copia web no tiene un .md contiguo |
| bussard-ramjet | v01-e01.webp | Sin correspondencia inequívoca con un original documentado |
| alcubierre | v04-e02.webp | Sin correspondencia inequívoca con un original documentado |
| alcubierre | v21-e20.webp | Sin correspondencia inequívoca con un original documentado |
| stellar-physics | v03.webp | El original o la copia web no tiene un .md contiguo |
| stellar-engines | v08b.webp | El original o la copia web no tiene un .md contiguo |
| shkadov | v03.webp | El original o la copia web no tiene un .md contiguo |
| matrioshka-brain | v02.webp | El original o la copia web no tiene un .md contiguo |
| civilizaciones-digitales | 087-digital-civilizations-v05.webp | El original o la copia web no tiene un .md contiguo |
| civilizaciones-y-luz | 091-civilizations-light-v01-e01.webp | Sin correspondencia inequívoca con un original documentado |
| future-universe | v21-e20.webp | Sin correspondencia inequívoca con un original documentado |
| future-universe | v05-e04.webp | Sin correspondencia inequívoca con un original documentado |
| great-filter | v03.webp | El original o la copia web no tiene un .md contiguo |

## Validación

- Se conservaron todas las claves, su orden y el formato del archivo de títulos.
- Las 356 imágenes seleccionadas tienen título en español e inglés.
- Se verificaron las 374 entradas del catálogo y la ausencia de títulos duplicados dentro de cada obra.
- No se modificó `selectedStudyImages.ts` ni ningún otro archivo del sitio. Los cambios ajenos preexistentes se conservaron.
- `npx tsc --noEmit` terminó con código 0, sin errores. `git diff --check` no detectó problemas de espacios en el archivo de títulos.
- No se realizó commit ni publicación.
