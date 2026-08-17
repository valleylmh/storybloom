const STYLE_LOCK =
  "premium polished 3D clay-like animated-film children's picture-book illustration, warm cinematic light, tactile handmade textures, expressive rounded characters, mythical ancient China setting, square 1:1 composition; no image text, letters, speech bubbles, logos, watermark, modern objects, weapons pointed at anyone, injury, blood, fear, or scary imagery.";

const WUKONG_BASE =
  "Sun Wukong is the same small lively monkey from the canonical early-series reference, with warm golden-brown fur, a bare tan face and chest, big bright amber eyes, round ears, a short pointed hair tuft, a long expressive tail, the same golden-yellow sleeveless tunic, vermilion sash, dark red trousers, and bare monkey feet; cheerful, quick-witted, never menacing, with child-friendly rounded animated-film proportions";

const PROMPT_LOCKS: Readonly<Record<string, string>> = {
  "[[WUKONG_NO_STAFF]]":
    `${WUKONG_BASE}; he has no shoes, crown, circlet, headband, armor, cape, or staff.`,
  "[[WUKONG_STAFF_NO_HEADBAND]]":
    `${WUKONG_BASE}; he has no shoes, crown, circlet, headband, armor, or cape; he carries the same slender straight Ruyi Jingu Bang with a solid vermilion-red center shaft and narrow engraved gold caps at both ends, upright like a walking stick or safely shrunk behind one ear, never swung or pointed at anyone; the staff is never wood, brown, all gold, thick, curved, or spear-like.`,
  "[[WUKONG_STAFF_HEADBAND]]":
    `${WUKONG_BASE}; he wears one simple narrow smooth plain golden headband centered above his eyebrows, with no jewels, spikes, dangling pieces, helmet, or crown, and has no armor, cape, or shoes; he carries the same slender straight Ruyi Jingu Bang with a solid vermilion-red center shaft and narrow engraved gold caps at both ends, upright like a walking stick or safely shrunk behind one ear, never swung or pointed at anyone; the staff is never wood, brown, all gold, thick, curved, or spear-like.`,
  "[[MASTER_PUTI]]":
    "Master Puti is the same serene elderly sage with a long flowing white beard and eyebrows, hair in a high topknot, layered cream-and-sage Taoist robes with wide sleeves, and a wooden staff resting safely nearby; kind, wise, and gently smiling.",
  "[[DRAGON_KING]]":
    "The East Sea Dragon King is the same stately friendly dragon king with a turquoise-and-gold scaled face, flowing white whiskers, sea-green court robes and pearl ornaments; dignified, warm, never frightening, with child-friendly rounded proportions.",
  "[[TANG_SENG]]":
    "Tang Seng is the same gentle young monk with a smooth round face, warm brown eyes, russet-and-gold kasaya over cream under-robes, a five-buddha crown and wooden prayer beads; calm, kind, softly smiling, with child-friendly rounded proportions.",
  "[[BAJIE]]":
    "Zhu Bajie is the same sturdy round-bodied pig-faced traveler with a soft rose-tan snout, rosy cheeks, large floppy ears, big warm brown eyes and a tiny black topknot; he wears a dark teal cross-collar tunic with cream inner collar, mustard-yellow sash, loose charcoal trousers and black cloth shoes; his rounded nine-tooth farm rake rests safely and is never raised or pointed at anyone.",
  "[[SHA_WUJING]]":
    "Sha Wujing is the same tall sturdy gentle river guardian with warm bronze skin, a round friendly face, thick dark-red beard, shaved head, calm dark eyes, slate-blue monk robe, sand-colored sash and large smooth dark wooden beads; his broad round-edged crescent spade rests upright like a walking staff and is never raised or pointed at anyone.",
  "[[WHITE_DRAGON_HORSE]]":
    "White Dragon Horse is the same graceful compact horse with a luminous pearl-white coat, pale sky-blue mane and tail, one small sky-blue diamond centered on the forehead, large gentle teal eyes, a simple russet saddle blanket and teal-and-gold bridle; no armor or unicorn horn.",
};

export function expandXiyoujiIllustrationPrompt(prompt: string): string {
  if (!prompt.includes("[[")) return prompt;

  const expanded = Object.entries(PROMPT_LOCKS).reduce(
    (value, [token, lock]) => value.replaceAll(token, lock),
    prompt,
  );

  return `${expanded} ${STYLE_LOCK}`;
}
