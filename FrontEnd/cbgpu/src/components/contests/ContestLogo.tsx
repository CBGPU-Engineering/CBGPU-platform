'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ImagePlus, Trophy, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAlert } from '@/lib/alert';
import { contestLogoUrl, logoFileError } from '@/lib/contestLogos';

export function ContestLogo({ path, title, className = '' }: { path: string | null; title: string; className?: string }) {
  const url = contestLogoUrl(path);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return <div className={`contest-logo ${className}`}>
    {url && failedUrl !== url
      // Uploaded logos are small raster images served directly from the public asset bucket.
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={url} alt={`${title} 로고`} onError={() => setFailedUrl(url)} />
      : <Trophy aria-hidden="true" strokeWidth={1.5} />}
  </div>;
}

export function ContestLogoPicker({ file, currentPath, onChange, onRemove, disabled = false }: {
  file: File | null; currentPath: string | null; onChange: (file: File) => void; onRemove: () => void; disabled?: boolean;
}) {
  const id = useId();
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selection = useRef(0);
  const { showError } = useAlert();
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const src = file ? preview : contestLogoUrl(currentPath);
  return <div className="contest-logo-picker">
    <div className="contest-logo contest-logo-preview">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="대회 로고 미리보기" /> : <ImagePlus aria-hidden="true" strokeWidth={1.5} />}
    </div>
    <div className="min-w-0 flex-1 space-y-2">
      <label htmlFor={id} className="block text-sm font-bold">대회 로고 <span className="font-normal text-muted-foreground">선택</span></label>
      <p className="text-xs leading-relaxed text-muted-foreground">목록과 제출 페이지에 표시돼요.<br />PNG, JPG, WebP · 최대 2MB</p>
      <input ref={inputRef} id={id} aria-label="대회 로고 파일" type="file" className="sr-only" accept="image/png,image/jpeg,image/webp" disabled={disabled} onChange={async event => {
        const picked = event.target.files?.[0];
        const version = ++selection.current;
        if (!picked) return;
        const invalid = logoFileError(picked);
        if (invalid) { showError(invalid); event.target.value = ''; return; }
        try {
          const bitmap = await createImageBitmap(picked);
          const valid = bitmap.width > 0 && bitmap.height > 0 && bitmap.width <= 8192 && bitmap.height <= 8192;
          bitmap.close();
          if (!valid) throw new Error('이미지는 가로·세로 8,192픽셀 이하로 올려 주세요.');
          if (version === selection.current) onChange(picked);
        } catch (error) { if (version === selection.current) showError(error instanceof Error && error.message.includes('픽셀') ? error.message : '이미지를 읽을 수 없어요. 다른 파일을 선택해 주세요.'); }
        finally { if (inputRef.current) inputRef.current.value = ''; }
      }} />
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => inputRef.current?.click()}>{file || currentPath ? '로고 변경' : '이미지 선택'}</Button>{(file || currentPath) && <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => { selection.current++; onRemove(); }}><X className="size-3" />제거</Button>}</div>
    </div>
  </div>;
}
