import { afterEach, describe, expect, it, vi } from "vitest";
import { QUIZ_API_URL, imagemDoQuiz, porValidar, quizLga } from "./quiz-lga";

afterEach(() => vi.unstubAllGlobals());

describe("quiz LGA", () => {
  it("usa a API pública por omissão", () => {
    expect(QUIZ_API_URL).toBe("https://api-quiz-lga.onrender.com");
  });

  it("as imagens relativas ficam com o endereço da API", () => {
    expect(imagemDoQuiz("/static/quiz_sem_rotulo/A.png")).toBe(
      "https://api-quiz-lga.onrender.com/static/quiz_sem_rotulo/A.png",
    );
    expect(imagemDoQuiz("https://cdn.x/A.png")).toBe("https://cdn.x/A.png");
  });

  it("reconhece perguntas por validar", () => {
    expect(porValidar({ validation_status: "pendente_de_validacao_por_especialista_LGA" })).toBe(true);
    expect(porValidar({ validation_status: "validada" })).toBe(false);
    expect(porValidar({})).toBe(false);
  });

  it("responde com o corpo que a API espera", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ question_id: "a", is_correct: true, correct_answer: "A", explanation: "x" })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const r = await quizLga.responder("lga_alphabet_a", "A");
    expect(r.is_correct).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api-quiz-lga.onrender.com/api/v1/quiz/answer");
    expect(JSON.parse(init.body)).toEqual({ question_id: "lga_alphabet_a", answer: "A" });
  });

  it("mostra a mensagem dos erros de validação do FastAPI", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: [{ msg: "Field required" }] }), { status: 422 }),
    ));
    await expect(quizLga.perguntas()).rejects.toThrow("Field required");
  });

  it("sem rede dá uma mensagem clara", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(quizLga.categorias()).rejects.toThrow("Sem ligação ao serviço do quiz");
  });
});
