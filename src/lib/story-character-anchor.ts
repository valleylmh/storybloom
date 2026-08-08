import { generateCpaStoryCharacterAnchor } from "@/lib/image-generator";
import { cacheCharacterReference } from "@/lib/storage";
import type { FamilyCharacterInput, StoryVisualBible } from "@/types";

function decodeImageDataUri(imageDataUri: string) {
  const match = imageDataUri.match(
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/i,
  );
  if (!match) {
    throw new Error("CPA Nano Banana did not return a cacheable story anchor image.");
  }

  return {
    contentType: match[1].toLowerCase(),
    bytes: Buffer.from(match[2], "base64"),
  };
}

export async function createStoryCharacterAnchorToken(input: {
  character: FamilyCharacterInput;
  visualBible: StoryVisualBible;
  referenceCacheKey?: string;
}) {
  const imageDataUri = await generateCpaStoryCharacterAnchor(input);
  const image = decodeImageDataUri(imageDataUri);
  return cacheCharacterReference(image);
}
