import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UserAvatar } from "./UserAvatar";

const av = (props: React.ComponentProps<typeof UserAvatar>) =>
  renderToStaticMarkup(React.createElement(UserAvatar, props));

describe("UserAvatar", () => {
  it("com nome mas sem id mostra essa pessoa, não a conta de quem vê", () => {
    const out = av({ name: "Ana Lopes", noLink: true });
    expect(out).toContain("AL");
    expect(out).not.toContain("animate-pulse");
  });

  it("só com a foto também mostra essa pessoa", () => {
    expect(av({ foto: "https://cdn.exemplo/ana.jpg" })).toContain('src="https://cdn.exemplo/ana.jpg"');
  });

  it("sem dados nenhuns espera pela conta de quem vê", () => {
    expect(av({})).toContain("animate-pulse");
  });

  it("as cores do className não são tapadas pelo dourado", () => {
    const out = av({ name: "Rui", noLink: true, className: "bg-secondary" });
    expect(out).toContain("bg-secondary");
    expect(out).not.toContain("bg-gradient-gold");
    expect(out).not.toContain("background-color");
  });

  it("com id leva ao perfil", () => {
    expect(av({ name: "Rui", userId: 7 })).toContain('href="/perfil/7"');
  });
});
