'use client';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Props {
  open: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
}: Props) {
  const english = typeof window !== 'undefined' && ['admin.cbgpu.com','manufacturing.cbgpu.com','print.cbgpu.com','laser.cbgpu.com'].includes(window.location.hostname);
  return (
    <Dialog open={open} onOpenChange={o => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-black uppercase tracking-tight">{title ?? (english ? 'Delete this item?' : '삭제하시겠습니까?')}</DialogTitle>
          <DialogDescription className="text-sm">{description ?? (english ? 'This action cannot be undone.' : '이 작업은 되돌릴 수 없습니다.')}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 flex-row justify-end">
          <Button variant="outline" onClick={onCancel} className="font-black text-xs uppercase tracking-widest">
            {english ? 'Cancel' : '취소'}
          </Button>
          <Button variant="destructive" onClick={onConfirm} className="font-black text-xs uppercase tracking-widest">
            {confirmLabel ?? (english ? 'Delete' : '삭제')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
