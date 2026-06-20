"use client";

export default function MultiplayerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#0f172a,transparent_40%),#050509] p-6 text-white">
      <div className="mx-auto max-w-md rounded-[2rem] border border-red-400/20 bg-red-500/[0.06] p-8 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.35em] text-red-300">
          Race page error
        </p>
        <h1 className="mt-3 text-2xl font-black">Something went wrong</h1>
        <p className="mt-2 text-sm text-red-100/70">
          {error.message || "The multiplayer page could not load."}
        </p>
        <div className="mt-6 flex gap-3 justify-center">
          <button
            onClick={reset}
            className="rounded-full bg-lime-300 px-5 py-2.5 text-sm font-black text-black hover:bg-lime-200"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-full border border-white/10 px-5 py-2.5 text-sm font-bold text-white/70 hover:bg-white/10"
          >
            Back to home
          </a>
        </div>
      </div>
    </main>
  );
}
