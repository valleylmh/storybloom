export type StoryCreationMode = "capture" | "minimal" | "full";

export const STORY_CREATION_FRAGMENT = "#story-creation?";
const CREATION_PARAMETERS = new Set(["mode", "idea", "personalize"]);

function fragmentParameters(url: URL) {
  return url.hash.startsWith(STORY_CREATION_FRAGMENT)
    ? new URLSearchParams(url.hash.slice(STORY_CREATION_FRAGMENT.length))
    : null;
}

/** Form presets live in the fragment so every preset shares the homepage URL. */
export function storyCreationHref({
  locale = "zh", idea, personalize,
}: {
  locale?: "zh" | "en";
  idea?: string;
  personalize?: string;
} = {}) {
  const parameters = new URLSearchParams({ mode: "minimal" });
  if (idea) parameters.set("idea", idea);
  if (personalize) parameters.set("personalize", personalize);
  return `${locale === "en" ? "/en" : "/"}${STORY_CREATION_FRAGMENT}${parameters}`;
}

/** Retain query-string compatibility, including existing story/task URLs. */
export function readStoryCreationParameters(url: URL) {
  const parameters = new URLSearchParams(url.search);
  fragmentParameters(url)?.forEach((value, key) => {
    if (!parameters.has(key)) parameters.set(key, value);
  });
  return parameters;
}

export function withStoryCreationMode(url: URL, mode: StoryCreationMode) {
  const next = new URL(url);
  const fragment = fragmentParameters(next);
  if (fragment) {
    next.searchParams.delete("mode");
    if (mode === "capture") fragment.delete("mode");
    else fragment.set("mode", mode);
    next.hash = fragment.size ? `${STORY_CREATION_FRAGMENT}${fragment}` : "#story-creation";
  } else if (mode === "capture") {
    next.searchParams.delete("mode");
  } else {
    next.searchParams.set("mode", mode);
  }
  return next;
}

/** Only merge public creation presets; never redirect saved books or auth state. */
export function legacyStoryCreationRedirect(url: URL) {
  if (url.pathname !== "/" && url.pathname !== "/en") return null;
  if (!url.searchParams.size) return null;
  if ([...url.searchParams.keys()].some((key) => !CREATION_PARAMETERS.has(key))) return null;
  const mode = url.searchParams.get("mode");
  if (mode !== null && mode !== "minimal") return null;

  const next = new URL(url);
  const parameters = new URLSearchParams(next.search);
  if (!parameters.has("mode")) parameters.set("mode", "minimal");
  next.search = "";
  next.hash = `${STORY_CREATION_FRAGMENT}${parameters}`;
  return next;
}
