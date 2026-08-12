/** Dados da Biblioteca de Língua Gestual Angolana (LGA) — conteúdo demonstrativo. */

export type LgaMotion = "static" | "wave" | "tap" | "circle" | "updown" | "twist";

export type LgaLetter = {
  letter: string;
  glyph: string; // representação visual da configuração de mão
  hint: string; // descrição da configuração
  motion: LgaMotion;
};

export type LgaWord = {
  id: string;
  word: string;
  category: "Saudações" | "Emoções" | "Escola" | "Família" | "Quotidiano";
  glyph: string;
  description: string;
  motion: LgaMotion;
};

/** Alfabeto dactilológico — configuração de mão por letra. */
export const lgaAlphabet: LgaLetter[] = [
  { letter: "A", glyph: "✊", hint: "Mão fechada, polegar ao lado", motion: "static" },
  { letter: "B", glyph: "🤚", hint: "Mão aberta, polegar dobrado", motion: "static" },
  { letter: "C", glyph: "🤏", hint: "Mão em forma de C", motion: "static" },
  { letter: "D", glyph: "☝️", hint: "Indicador em pé, restantes em círculo", motion: "static" },
  { letter: "E", glyph: "🤞", hint: "Dedos dobrados sobre o polegar", motion: "static" },
  { letter: "F", glyph: "👌", hint: "Polegar e indicador unidos", motion: "static" },
  { letter: "G", glyph: "👉", hint: "Indicador na horizontal", motion: "static" },
  { letter: "H", glyph: "✌️", hint: "Indicador e médio na horizontal", motion: "static" },
  { letter: "I", glyph: "🤙", hint: "Mindinho levantado", motion: "static" },
  { letter: "J", glyph: "🤙", hint: "Mindinho a desenhar um J", motion: "circle" },
  { letter: "K", glyph: "🖖", hint: "Indicador e médio em V com polegar", motion: "static" },
  { letter: "L", glyph: "👆", hint: "Polegar e indicador em L", motion: "static" },
  { letter: "M", glyph: "✊", hint: "Polegar sob três dedos", motion: "static" },
  { letter: "N", glyph: "✊", hint: "Polegar sob dois dedos", motion: "static" },
  { letter: "O", glyph: "👌", hint: "Dedos em círculo fechado", motion: "static" },
  { letter: "P", glyph: "👇", hint: "K virado para baixo", motion: "static" },
  { letter: "Q", glyph: "👇", hint: "G virado para baixo", motion: "static" },
  { letter: "R", glyph: "🤞", hint: "Indicador e médio cruzados", motion: "static" },
  { letter: "S", glyph: "✊", hint: "Punho com polegar à frente", motion: "static" },
  { letter: "T", glyph: "👊", hint: "Polegar entre indicador e médio", motion: "static" },
  { letter: "U", glyph: "✌️", hint: "Indicador e médio juntos", motion: "static" },
  { letter: "V", glyph: "✌️", hint: "Indicador e médio afastados", motion: "static" },
  { letter: "W", glyph: "🖐️", hint: "Três dedos levantados", motion: "static" },
  { letter: "X", glyph: "☝️", hint: "Indicador dobrado em gancho", motion: "tap" },
  { letter: "Y", glyph: "🤙", hint: "Polegar e mindinho esticados", motion: "static" },
  { letter: "Z", glyph: "☝️", hint: "Indicador a desenhar um Z", motion: "wave" },
];

/** Palavras com gesto animado. */
export const lgaWords: LgaWord[] = [
  { id: "ola", word: "Olá", category: "Saudações", glyph: "👋", description: "Mão aberta junto à cabeça, acena para fora.", motion: "wave" },
  { id: "obrigado", word: "Obrigado", category: "Saudações", glyph: "🤲", description: "Mão do queixo para a frente, palma para cima.", motion: "updown" },
  { id: "bomdia", word: "Bom dia", category: "Saudações", glyph: "🌅", description: "Mão sobe como o sol a nascer.", motion: "updown" },
  { id: "gosto", word: "Gosto", category: "Emoções", glyph: "👍", description: "Polegar levantado, movimento curto para cima.", motion: "tap" },
  { id: "adoro", word: "Adoro", category: "Emoções", glyph: "🫶", description: "Mãos cruzadas sobre o peito, abraço suave.", motion: "circle" },
  { id: "feliz", word: "Feliz", category: "Emoções", glyph: "😊", description: "Mãos abertas sobem junto ao peito em círculos.", motion: "circle" },
  { id: "aprender", word: "Aprender", category: "Escola", glyph: "🧠", description: "Da palma até à testa, como quem guarda saber.", motion: "updown" },
  { id: "professor", word: "Professor", category: "Escola", glyph: "🧑‍🏫", description: "Mãos da cabeça para a frente, depois descem.", motion: "updown" },
  { id: "livro", word: "Livro", category: "Escola", glyph: "📖", description: "Mãos juntas que abrem como um livro.", motion: "twist" },
  { id: "amigo", word: "Amigo", category: "Família", glyph: "🤝", description: "Indicadores entrelaçados, troca de posição.", motion: "twist" },
  { id: "familia", word: "Família", category: "Família", glyph: "👨‍👩‍👧", description: "Mãos em F desenham um círculo.", motion: "circle" },
  { id: "casa", word: "Casa", category: "Quotidiano", glyph: "🏠", description: "Mãos formam o telhado e descem as paredes.", motion: "updown" },
  { id: "agua", word: "Água", category: "Quotidiano", glyph: "💧", description: "Mão em W toca no queixo duas vezes.", motion: "tap" },
  { id: "comer", word: "Comer", category: "Quotidiano", glyph: "🍽️", description: "Dedos juntos levados à boca, repetidamente.", motion: "tap" },
];

export const lgaCategories = [
  "Todas",
  "Alfabeto",
  "Saudações",
  "Emoções",
  "Escola",
  "Família",
  "Quotidiano",
] as const;

export type LgaSign = {
  id: string;
  term: string;
  category: (typeof lgaCategories)[number];
  glyph: string;
  motion: LgaMotion;
  description: string;
};

export const lgaSigns: LgaSign[] = [
  ...lgaAlphabet.map<LgaSign>((l) => ({
    id: `letter-${l.letter}`,
    term: `Letra ${l.letter}`,
    category: "Alfabeto",
    glyph: l.glyph,
    motion: l.motion,
    description: l.hint,
  })),
  ...lgaWords.map<LgaSign>((w) => ({
    id: w.id,
    term: w.word,
    category: w.category,
    glyph: w.glyph,
    motion: w.motion,
    description: w.description,
  })),
];

/** Reações em LGA usadas na comunidade. */
export type LgaReaction = {
  id: "gosto" | "adoro" | "parabens" | "aprendi";
  label: string;
  glyph: string;
  motion: LgaMotion;
};

export const lgaReactions: LgaReaction[] = [
  { id: "gosto", label: "Gosto (LGA)", glyph: "👍", motion: "tap" },
  { id: "adoro", label: "Adoro (LGA)", glyph: "🫶", motion: "circle" },
  { id: "parabens", label: "Parabéns (LGA)", glyph: "👏", motion: "wave" },
  { id: "aprendi", label: "Aprendi (LGA)", glyph: "🧠", motion: "updown" },
];