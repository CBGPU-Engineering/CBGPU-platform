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
  title = '삭제하시겠습니까?',
  description = '이 작업은 되돌릴 수 없습니다.',
  confirmLabel = '삭제',
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={o => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-black uppercase tracking-tight">{title}</DialogTitle>
          <DialogDescription className="text-sm">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 flex-row justify-end">
          <Button variant="outline" onClick={onCancel} className="font-black text-xs uppercase tracking-widest">
            취소
          </Button>
          <Button variant="destructive" onClick={onConfirm} className="font-black text-xs uppercase tracking-widest">
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
