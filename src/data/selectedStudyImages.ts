// La primera imagen es la principal; las siguientes solo aparecen dentro del estudio.
const assetBase = `${import.meta.env.BASE_URL}illustrations/selected/`;

export const selectedStudyImages: Record<string, readonly string[]> = {
  astroingenieria: [
    `${assetBase}astroingenieria/v08.webp`,
    `${assetBase}astroingenieria/v07.webp`,
  ],
  iss: [
    `${assetBase}iss/v01.webp`,
  ],
  'artificial-gravity': [
    `${assetBase}artificial-gravity/v08.webp`,
    `${assetBase}artificial-gravity/v06.webp`,
  ],
  'life-support': [
    `${assetBase}life-support/v01.webp`,
    `${assetBase}life-support/v06.webp`,
  ],
  'bernal-sphere': [
    `${assetBase}bernal-sphere/v12.webp`,
    `${assetBase}bernal-sphere/v13.webp`,
    `${assetBase}bernal-sphere/v11.webp`,
    `${assetBase}bernal-sphere/v14.webp`,
  ],
  'stanford-torus': [
    `${assetBase}stanford-torus/v10.webp`,
    `${assetBase}stanford-torus/v11.webp`,
    `${assetBase}stanford-torus/v12.webp`,
  ],
  'oneill-cylinder': [
    `${assetBase}oneill-cylinder/v10-reflejo.webp`,
    `${assetBase}oneill-cylinder/v09.webp`,
    `${assetBase}oneill-cylinder/v11.webp`,
  ],
  'bishop-ring': [
    `${assetBase}bishop-ring/v01.webp`,
  ],
  'mckendree-cylinder': [
    `${assetBase}mckendree-cylinder/v01.webp`,
    `${assetBase}mckendree-cylinder/v14.webp`,
    `${assetBase}mckendree-cylinder/interior-cinematic-v01.webp`,
  ],
  ringworld: [
    `${assetBase}ringworld/v01.webp`,
  ],
  'asteroid-habitat': [
    `${assetBase}asteroid-habitat/v05.webp`,
    `${assetBase}asteroid-habitat/v06.webp`,
    `${assetBase}asteroid-habitat/v07.webp`,
  ],
};

export const selectedStudyImage = (conceptId: string) => selectedStudyImages[conceptId]?.[0];
