// Capas decorativas (gradiente escolhido a partir do id) para cursos e vídeos sem
// imagem de capa. Partilhado entre a app e as imagens de pré-visualização dos
// links (opengraph-image), para a capa ser a mesma nos dois sítios.
const COVERS = [
  "linear-gradient(135deg,#B8892F,#E8C878)",
  "linear-gradient(135deg,#2C1810,#8B5E34)",
  "linear-gradient(135deg,#3D5A80,#98C1D9)",
  "linear-gradient(135deg,#7B2D26,#D69F7E)",
  "linear-gradient(135deg,#2F4858,#86BBD8)",
  "linear-gradient(135deg,#4A4E69,#C9ADA7)",
];

export function thumbnailFor(idLike: number | string): string {
  const s = String(idLike);
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += s.charCodeAt(i);
  return COVERS[sum % COVERS.length];
}
