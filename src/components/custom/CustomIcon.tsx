"use client";

import {
  Baby,
  BookOpenText,
  Cards,
  ChatCircleText,
  CheckCircle,
  Clock,
  FilePdf,
  Gift,
  GraduationCap,
  HandHeart,
  Images,
  Package,
  Palette,
  PencilSimpleLine,
  Printer,
  SealCheck,
  ShieldCheck,
  Sparkle,
  Translate,
  UsersThree,
} from "@phosphor-icons/react";

const icons = {
  baby: Baby,
  book: BookOpenText,
  cards: Cards,
  chat: ChatCircleText,
  check: CheckCircle,
  clock: Clock,
  pdf: FilePdf,
  gift: Gift,
  graduation: GraduationCap,
  heart: HandHeart,
  images: Images,
  package: Package,
  palette: Palette,
  pencil: PencilSimpleLine,
  print: Printer,
  seal: SealCheck,
  shield: ShieldCheck,
  sparkle: Sparkle,
  translate: Translate,
  family: UsersThree,
} as const;

export type CustomIconName = keyof typeof icons;

interface CustomIconProps {
  name: CustomIconName;
  className?: string;
}

export default function CustomIcon({ name, className }: CustomIconProps) {
  const Icon = icons[name];

  return (
    <Icon
      aria-hidden="true"
      className={className}
      size={22}
      weight="duotone"
    />
  );
}
