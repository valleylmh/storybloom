"use client";

import { useState, type CSSProperties } from "react";
import { ArrowCounterClockwise, Crop, SpinnerGap, X } from "@phosphor-icons/react";
import {
  DEFAULT_FAMILY_IMAGE_CROP,
  normalizeFamilyImageCrop,
  type FamilyImageCrop,
} from "@/lib/family-image-crop";

export function getFamilyImageCropStyle(cropValue: unknown): CSSProperties {
  const crop = normalizeFamilyImageCrop(cropValue);
  return {
    objectPosition: `${crop.x}% ${crop.y}%`,
    transform: `scale(${crop.zoom})`,
    transformOrigin: `${crop.x}% ${crop.y}%`,
  };
}

export default function CharacterImageCropDialog({
  imageUrl,
  imageName,
  initialCrop,
  busy,
  onClose,
  onSave,
}: {
  imageUrl: string;
  imageName: string;
  initialCrop: unknown;
  busy: boolean;
  onClose: () => void;
  onSave: (crop: FamilyImageCrop) => Promise<void>;
}) {
  const [crop, setCrop] = useState(() => normalizeFamilyImageCrop(initialCrop));
  const [error, setError] = useState("");

  function updateCrop(key: keyof FamilyImageCrop, value: number) {
    setCrop((current) => normalizeFamilyImageCrop({ ...current, [key]: value }));
  }

  async function save() {
    setError("");
    try {
      await onSave(crop);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "裁剪保存失败，请稍后重试");
    }
  }

  return (
    <div
      className="family-modal"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section className="family-dialog family-crop-dialog" aria-label={`裁剪${imageName}`}>
        <button type="button" className="family-close" disabled={busy} onClick={onClose}>
          <X />
        </button>
        <p className="family-kicker">IMAGE CROP</p>
        <h2>裁剪当前图片</h2>
        <p className="family-crop-hint">调整卡片中的取景范围，不会修改或覆盖原始照片。</p>

        <div className="family-crop-preview">
          <img src={imageUrl} alt={`${imageName}裁剪预览`} style={getFamilyImageCropStyle(crop)} />
          <span><Crop size={18} /> 卡片可见范围</span>
        </div>

        <div className="family-crop-controls">
          <label>
            <span>左右位置</span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={crop.x}
              onChange={(event) => updateCrop("x", Number(event.target.value))}
            />
          </label>
          <label>
            <span>上下位置</span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={crop.y}
              onChange={(event) => updateCrop("y", Number(event.target.value))}
            />
          </label>
          <label>
            <span>缩放 {crop.zoom.toFixed(2)}×</span>
            <input
              type="range"
              min="1"
              max="2"
              step="0.05"
              value={crop.zoom}
              onChange={(event) => updateCrop("zoom", Number(event.target.value))}
            />
          </label>
        </div>

        {error ? <p className="family-dialog-error" role="alert">{error}</p> : null}
        <div className="family-crop-footer">
          <button
            type="button"
            className="family-crop-reset"
            disabled={busy}
            onClick={() => setCrop({ ...DEFAULT_FAMILY_IMAGE_CROP })}
          >
            <ArrowCounterClockwise />重置
          </button>
          <button type="button" className="family-primary" disabled={busy} onClick={() => void save()}>
            {busy ? <><SpinnerGap className="spin" />正在保存</> : "保存裁剪"}
          </button>
        </div>
      </section>
    </div>
  );
}
