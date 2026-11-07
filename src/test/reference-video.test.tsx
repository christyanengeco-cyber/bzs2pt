import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ReferenceVideo } from "@/components/ReferenceVideo";

afterEach(cleanup);

describe("vídeo no popup bíblico", () => {
  it("salta ao versículo no carregamento e não volta ao pausar e retomar", () => {
    const { container } = render(
      <ReferenceVideo
        video={{ titulo: "João 3", mp4: "https://example.org/john.mp4", inicio: 180.914 }}
      />,
    );
    const player = container.querySelector("video");
    if (!player) throw new Error("Player ausente");
    fireEvent.loadedMetadata(player);
    expect(player.currentTime).toBe(180.914);
    player.currentTime = 195;
    fireEvent.play(player);
    fireEvent.canPlay(player);
    expect(player.currentTime).toBe(195);
  });

  it("tenta novamente no primeiro play quando o celular ainda não aceita o salto", () => {
    const { container } = render(
      <ReferenceVideo
        video={{ titulo: "João 3", mp4: "https://example.org/john.mp4", inicio: 180.914 }}
      />,
    );
    const player = container.querySelector("video");
    if (!player) throw new Error("Player ausente");
    let tempo = 0;
    let pronto = false;
    Object.defineProperty(player, "currentTime", {
      get: () => tempo,
      set: (value: number) => {
        if (!pronto) throw new Error("Not ready");
        tempo = value;
      },
    });
    fireEvent.loadedMetadata(player);
    expect(player.currentTime).toBe(0);
    pronto = true;
    fireEvent.play(player);
    expect(player.currentTime).toBe(180.914);
  });
});
