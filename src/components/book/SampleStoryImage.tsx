"use client";

interface SampleStoryImageProps {
  placeholderSrc?: string;
  realSrc?: string;
  alt?: string;
  className?: string;
  realClassName?: string;
}

export default function SampleStoryImage({
  placeholderSrc,
  realSrc,
  alt = "",
  className = "",
  realClassName = "sample-story-image",
}: SampleStoryImageProps) {
  return (
    <div
      className={`sample-story-image-layer${className ? ` ${className}` : ""}`}
      style={{
        backgroundImage: placeholderSrc ? `url("${placeholderSrc}")` : undefined,
      }}
    >
      {realSrc ? (
        <img
          src={realSrc}
          alt={alt}
          className={realClassName}
        />
      ) : null}
    </div>
  );
}
