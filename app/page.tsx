"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import { buildMetricsFromChatText } from "@/lib/chatMetrics";

type UploadStatus = "idle" | "uploading" | "done" | "error";

const primaryButton =
  "rounded-full bg-rose px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#d9576a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6a1b2b]";
const secondaryButton =
  "rounded-full border border-rose/30 bg-white/80 px-5 py-3 text-sm font-semibold text-ink transition-colors hover:border-rose/60 hover:bg-white";

const cardBase =
  "glass-card rounded-[32px] p-6 shadow-xl shadow-black/5";

function createFileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

async function requestUploadUrl(file: File, folder: string) {
  const response = await fetch("/api/s3", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      folder,
    }),
  });

  if (!response.ok) {
    throw new Error("S3 upload url request failed");
  }

  return (await response.json()) as { uploadUrl: string; key: string };
}

export default function Home() {
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [audioPreviews, setAudioPreviews] = useState<string[]>([]);
  const [chatFiles, setChatFiles] = useState<File[]>([]);
  const [metrics, setMetrics] = useState<
    ReturnType<typeof buildMetricsFromChatText> | null
  >(null);
  const [activeTrackIndex, setActiveTrackIndex] = useState(0);
  const [activeSlide, setActiveSlide] = useState(0);
  const [timelineReady, setTimelineReady] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<Record<string, UploadStatus>>(
    {}
  );
  const [isPending, startTransition] = useTransition();
  const audioRef = useRef<HTMLAudioElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const activeTrackUrl = audioPreviews[activeTrackIndex] ?? "";

  useEffect(() => {
    return () => {
      photoPreviews.forEach((url) => URL.revokeObjectURL(url));
      audioPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photoPreviews, audioPreviews]);

  useEffect(() => {
    if (!audioUnlocked || !activeTrackUrl) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = activeTrackUrl;
    audio.loop = true;
    audio.volume = 0.85;
    audio
      .play()
      .then(() => undefined)
      .catch(() => undefined);
  }, [activeTrackUrl, audioUnlocked, activeSlide]);

  useEffect(() => {
    const container = timelineRef.current;
    if (!container) return;

    const handleScroll = () => {
      const index = Math.round(container.scrollLeft / container.clientWidth);
      setActiveSlide(index);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const slides = useMemo(() => {
    const topWord = metrics?.topWords[0];
    const topEmoji = metrics?.topEmojis[0];
    const topSender = metrics
      ? Object.entries(metrics.senderMessageCounts).sort((a, b) => b[1] - a[1])[0]
      : null;
    const topWordSender = metrics
      ? Object.entries(metrics.senderWordCounts).sort((a, b) => b[1] - a[1])[0]
      : null;

    return [
      {
        title: "Tu historia, en modo wrapped",
        description: metrics?.firstMessageDate
          ? `Desde ${metrics.firstMessageDate} hasta ${metrics.lastMessageDate}`
          : "Sube tus chats para revelar tu linea de tiempo.",
        body: (
          <div className="space-y-4">
            <p className="text-base text-ink/70">
              Cada pantalla tiene un momento especial. Desliza o usa el boton
              de avanzar para seguir la historia.
            </p>
            <div className="rounded-3xl bg-white/80 p-4 text-sm text-ink/70">
              {metrics ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-ink/50">
                      Mensajes
                    </p>
                    <p className="text-2xl font-semibold text-ink">
                      {metrics.totalMessages}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-ink/50">
                      Palabras
                    </p>
                    <p className="text-2xl font-semibold text-ink">
                      {metrics.totalWords}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-ink/50">
                      Fotos
                    </p>
                    <p className="text-2xl font-semibold text-ink">
                      {photoPreviews.length}
                    </p>
                  </div>
                </div>
              ) : (
                "Listo para tu resumen?"
              )}
            </div>
          </div>
        ),
      },
      {
        title: "La palabra mas repetida",
        description: topWord
          ? `La mas mencionada fue: ${topWord.word}`
          : "Carga chats para ver el ranking.",
        body: (
          <div className="space-y-4">
            <div className="rounded-3xl bg-white/80 p-5">
              <p className="text-4xl font-semibold text-ink">
                {topWord ? topWord.word : "---"}
              </p>
              <p className="text-sm text-ink/60">
                {topWord ? `${topWord.count} veces` : ""}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {metrics?.topWords.slice(1, 5).map((word) => (
                <div
                  key={word.word}
                  className="rounded-2xl border border-rose/20 bg-white/70 px-4 py-3 text-sm"
                >
                  <span className="font-semibold text-ink">{word.word}</span>
                  <span className="text-ink/60"> · {word.count}</span>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        title: "Quien escribio mas",
        description: topSender
          ? `${topSender[0]} lidera con ${topSender[1]} mensajes.`
          : "Sube tus chats para esta estadistica.",
        body: (
          <div className="space-y-3">
            <div className="rounded-3xl bg-white/80 p-5">
              <p className="text-2xl font-semibold text-ink">
                {topSender ? topSender[0] : "---"}
              </p>
              <p className="text-sm text-ink/60">
                {topSender ? `${topSender[1]} mensajes` : ""}
              </p>
            </div>
            <div className="rounded-3xl border border-rose/20 bg-white/70 p-5">
              <p className="text-sm text-ink/60">Mas palabras escritas</p>
              <p className="text-xl font-semibold text-ink">
                {topWordSender ? topWordSender[0] : "---"}
              </p>
            </div>
          </div>
        ),
      },
      {
        title: "Emoji favorito",
        description: topEmoji
          ? `El mas usado fue ${topEmoji.emoji}`
          : "Carga chats para descubrirlo.",
        body: (
          <div className="space-y-4">
            <div className="rounded-3xl bg-white/80 p-5 text-center">
              <p className="text-5xl">{topEmoji?.emoji ?? ""}</p>
              <p className="text-sm text-ink/60">
                {topEmoji ? `${topEmoji.count} apariciones` : ""}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {metrics?.topEmojis.slice(1, 4).map((emoji) => (
                <div
                  key={emoji.emoji}
                  className="rounded-2xl border border-rose/20 bg-white/70 px-4 py-3 text-center text-sm"
                >
                  <p className="text-2xl">{emoji.emoji}</p>
                  <p className="text-ink/60">{emoji.count}</p>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        title: "Una frase para recordar",
        description: metrics?.loveQuote
          ? `Un momento del ${metrics.loveQuote.date}`
          : "Busca la primera frase con amor.",
        body: (
          <div className="rounded-3xl bg-white/80 p-6">
            <p className="text-sm text-ink/60">
              {metrics?.loveQuote
                ? `De ${metrics.loveQuote.sender}`
                : ""}
            </p>
            <p className="mt-3 text-lg text-ink">
              {metrics?.loveQuote?.text ??
                "Sube chats para descubrir tu frase."}
            </p>
          </div>
        ),
      },
      {
        title: "Galeria en pareja",
        description:
          photoPreviews.length > 0
            ? "Tus mejores recuerdos en imagenes."
            : "Sube fotos para ver tu galeria.",
        body: (
          <div className="grid gap-4 sm:grid-cols-2">
            {photoPreviews.slice(0, 6).map((photo, index) => (
              <div
                key={`${photo}-${index}`}
                className="overflow-hidden rounded-3xl border border-rose/20 bg-white/70"
              >
                <img
                  src={photo}
                  alt={`Foto ${index + 1}`}
                  className="h-48 w-full object-cover"
                />
              </div>
            ))}
          </div>
        ),
      },
      {
        title: "El dia mas intenso",
        description: metrics?.topDay
          ? `${metrics.topDay.date} con ${metrics.topDay.count} mensajes.`
          : "Sube chats para detectar el dia mas activo.",
        body: (
          <div className="rounded-3xl bg-white/80 p-6">
            <p className="text-sm text-ink/60">Mensaje mas largo</p>
            <p className="mt-3 text-lg text-ink">
              {metrics?.longestMessage?.text ?? ""}
            </p>
          </div>
        ),
      },
    ];
  }, [metrics, photoPreviews]);

  const canContinue = photoPreviews.length > 0 && audioPreviews.length > 0;

  const handlePhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setPhotoFiles(files);
    setPhotoPreviews(files.map((file) => URL.createObjectURL(file)));
  };

  const handleAudio = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setAudioFiles(files);
    setAudioPreviews(files.map((file) => URL.createObjectURL(file)));
    setActiveTrackIndex(0);
  };

  const handleChats = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setChatFiles(files);
  };

  const handleProcessChats = async () => {
    if (chatFiles.length === 0) return;
    const texts = await Promise.all(chatFiles.map((file) => file.text()));
    startTransition(() => {
      setMetrics(buildMetricsFromChatText(texts));
    });
  };

  const handleUnlockAudio = async () => {
    if (!activeTrackUrl) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = activeTrackUrl;
    audio.loop = true;
    audio.volume = 0.85;
    try {
      await audio.play();
      setAudioUnlocked(true);
    } catch {
      setAudioUnlocked(false);
    }
  };

  const scrollToSlide = (index: number) => {
    const container = timelineRef.current;
    if (!container) return;
    const next = Math.max(0, Math.min(slides.length - 1, index));
    container.scrollTo({
      left: container.clientWidth * next,
      behavior: "smooth",
    });
  };

  const uploadFilesToS3 = async (files: File[], folder: string) => {
    for (const file of files) {
      const key = createFileKey(file);
      setUploadStatus((prev) => ({ ...prev, [key]: "uploading" }));
      try {
        const { uploadUrl } = await requestUploadUrl(file, folder);
        await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        setUploadStatus((prev) => ({ ...prev, [key]: "done" }));
      } catch {
        setUploadStatus((prev) => ({ ...prev, [key]: "error" }));
      }
    }
  };

  return (
    <div className="min-h-screen text-ink">
      <audio ref={audioRef} />
      <div className="valentine-grid relative overflow-hidden">
        <div className="pointer-events-none absolute -right-24 top-20 h-64 w-64 rounded-full bg-rose/20 blur-3xl floaty" />
        <div className="pointer-events-none absolute -left-32 bottom-12 h-72 w-72 rounded-full bg-rose/10 blur-3xl floaty" />
        <header className="relative z-10 mx-auto flex max-w-6xl flex-col gap-6 px-6 pb-6 pt-10">
          <p className="text-xs uppercase tracking-[0.4em] text-ink/60">
            Valentines Wrapped
          </p>
          <h1 className="headline text-4xl font-semibold text-ink sm:text-5xl">
            Crea una linea de tiempo con tus mejores momentos.
          </h1>
          <p className="max-w-2xl text-base text-ink/70">
            Sube fotos, canciones y chats de WhatsApp. Nosotros armamos el
            recorrido con datos y recuerdos en pantallas para deslizar.
          </p>
        </header>

        <main className="relative z-10 mx-auto grid max-w-6xl gap-8 px-6 pb-16 lg:grid-cols-[1.1fr_0.9fr]">
          <section className={`${cardBase} fade-in`}>
            <div className="space-y-6">
              <div>
                <h2 className="headline text-2xl text-ink">Carga tus recuerdos</h2>
                <p className="text-sm text-ink/60">
                  Todo queda listo antes de entrar al wrapped.
                </p>
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-semibold text-ink" htmlFor="photos">
                  Fotos en pareja
                </label>
                <input
                  id="photos"
                  type="file"
                  accept="image/*"
                  multiple
                  className="w-full rounded-2xl border border-rose/20 bg-white/80 px-4 py-3 text-sm"
                  onChange={handlePhotos}
                />
                {photoPreviews.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {photoPreviews.slice(0, 6).map((preview, index) => (
                      <img
                        key={`${preview}-${index}`}
                        src={preview}
                        alt={`Preview ${index + 1}`}
                        className="h-24 w-full rounded-2xl object-cover"
                      />
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className={secondaryButton}
                    onClick={() => uploadFilesToS3(photoFiles, "photos")}
                  >
                    Subir fotos a S3
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-semibold text-ink" htmlFor="audio">
                  Canciones de fondo
                </label>
                <input
                  id="audio"
                  type="file"
                  accept="audio/*"
                  multiple
                  className="w-full rounded-2xl border border-rose/20 bg-white/80 px-4 py-3 text-sm"
                  onChange={handleAudio}
                />
                {audioFiles.length > 0 && (
                  <div className="space-y-2">
                    {audioFiles.map((file, index) => (
                      <button
                        key={createFileKey(file)}
                        type="button"
                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${index === activeTrackIndex
                            ? "border-rose/60 bg-rose/10 text-ink"
                            : "border-rose/20 bg-white/70 text-ink/70 hover:border-rose/40"
                          }`}
                        onClick={() => setActiveTrackIndex(index)}
                      >
                        <span className="font-semibold">{file.name}</span>
                        <span className="text-xs">Seleccionada</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className={secondaryButton}
                    onClick={() => uploadFilesToS3(audioFiles, "audio")}
                  >
                    Subir canciones a S3
                  </button>
                  <button
                    type="button"
                    className={primaryButton}
                    onClick={handleUnlockAudio}
                  >
                    Iniciar musica
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-semibold text-ink" htmlFor="chats">
                  Chats de WhatsApp (.txt)
                </label>
                <input
                  id="chats"
                  type="file"
                  accept=".txt"
                  multiple
                  className="w-full rounded-2xl border border-rose/20 bg-white/80 px-4 py-3 text-sm"
                  onChange={handleChats}
                />
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className={primaryButton}
                    onClick={handleProcessChats}
                    disabled={chatFiles.length === 0}
                  >
                    {isPending ? "Procesando..." : "Procesar chats"}
                  </button>
                  <button
                    type="button"
                    className={secondaryButton}
                    onClick={() => uploadFilesToS3(chatFiles, "chats")}
                  >
                    Subir chats a S3
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border border-rose/20 bg-white/70 p-4 text-sm text-ink/70">
                {Object.keys(uploadStatus).length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-ink/50">
                      Estado S3
                    </p>
                    {Object.entries(uploadStatus).map(([key, status]) => (
                      <div key={key} className="flex justify-between">
                        <span className="truncate">{key.split("-")[0]}</span>
                        <span className="font-semibold">{status}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  "Las cargas a S3 se muestran aqui."
                )}
              </div>
            </div>
          </section>

          <section className={`${cardBase} fade-in space-y-6`}>
            <div>
              <h2 className="headline text-2xl text-ink">
                Vista previa del wrapped
              </h2>
              <p className="text-sm text-ink/60">
                Lista de pantallas y musica en vivo.
              </p>
            </div>

            <div className="rounded-3xl border border-rose/20 bg-white/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-ink/50">
                Pantalla actual
              </p>
              <p className="text-lg font-semibold text-ink">
                {slides[activeSlide]?.title}
              </p>
              <p className="text-sm text-ink/60">Slide {activeSlide + 1}</p>
            </div>

            <div className="rounded-3xl border border-rose/20 bg-white/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-ink/50">
                Musica
              </p>
              <p className="text-lg font-semibold text-ink">
                {audioFiles[activeTrackIndex]?.name ?? "Sin cancion"}
              </p>
              <p className="text-sm text-ink/60">
                {audioUnlocked ? "Reproduciendo" : "Pausa"}
              </p>
            </div>

            <button
              type="button"
              className={primaryButton}
              onClick={() => setTimelineReady(true)}
              disabled={!canContinue}
            >
              {canContinue
                ? "Entrar al wrapped"
                : "Sube fotos y musica primero"}
            </button>
          </section>
        </main>
      </div>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="headline text-3xl text-ink">
              Linea de tiempo interactiva
            </h2>
            <p className="text-sm text-ink/60">
              Desliza para avanzar o usa los botones.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className={secondaryButton}
              onClick={() => scrollToSlide(activeSlide - 1)}
            >
              Anterior
            </button>
            <button
              type="button"
              className={primaryButton}
              onClick={() => scrollToSlide(activeSlide + 1)}
            >
              Avanzar
            </button>
          </div>
        </div>

        <div
          ref={timelineRef}
          className={`flex snap-x snap-mandatory overflow-x-auto scroll-smooth rounded-[36px] border border-rose/20 bg-white/50 ${timelineReady ? "" : "opacity-60"
            }`}
          style={{ scrollBehavior: "smooth" }}
        >
          {slides.map((slide, index) => (
            <article
              key={slide.title}
              className="min-w-full snap-center px-6 py-10"
            >
              <div className="grid gap-6 lg:grid-cols-[0.45fr_0.55fr]">
                <div className="space-y-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-ink/50">
                    Slide {index + 1}
                  </p>
                  <h3 className="headline text-3xl text-ink">{slide.title}</h3>
                  <p className="text-sm text-ink/60">{slide.description}</p>
                </div>
                <div className="rounded-[28px] border border-rose/20 bg-white/80 p-6">
                  {slide.body}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
