'use client';
import { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';

type AlertType = 'success' | 'error' | 'info';

interface AlertState {
  open: boolean;
  title: string;
  message: string;
  type: AlertType;
}

interface Toast {
  id: number;
  message: string;
}

interface AlertCtx {
  showAlert: (msg: string, type?: AlertType, title?: string) => void;
  showError: (msg: string, title?: string) => void;
  /** 가벼운 자동 닫힘 토스트로 뜬다 — 일상적인 성공 피드백은 "확인"을 누르게 막지 않는다 */
  showSuccess: (msg: string) => void;
}

const Ctx = createContext<AlertCtx | null>(null);

export function AlertProvider({ children, english = false }: { children: ReactNode; english?: boolean }) {
  const [s, setS] = useState<AlertState>({ open: false, title: '', message: '', type: 'info' });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const showAlert = useCallback((msg: string, type: AlertType = 'info', title?: string) => {
    const titles = english ? {success:'Done',error:'Error',info:'Notice'} : { success: '완료', error: '오류', info: '알림' };
    if (english && type === 'error' && /[가-힣]/.test(msg)) msg = 'The operation could not be completed. Refresh the page and try again.';
    if (english && title && /[가-힣]/.test(title)) title = titles[type];
    setS({ open: true, message: msg, type, title: title ?? titles[type] });
  }, [english]);

  const showError = useCallback((msg: string, title = '오류') => showAlert(msg, 'error', title), [showAlert]);

  const showSuccess = useCallback((msg: string) => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, message: msg }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2500);
  }, []);

  return (
    <Ctx.Provider value={{ showAlert, showError, showSuccess }}>
      {children}
      <Dialog open={s.open} onOpenChange={o => !o && setS(p => ({ ...p, open: false }))}>
        <DialogContent className="max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className={`font-black uppercase tracking-tight ${
              s.type === 'error'   ? 'text-destructive' :
              s.type === 'success' ? 'text-success' : ''
            }`}>
              {s.title}
            </DialogTitle>
            <DialogDescription className="text-sm">{s.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setS(p => ({ ...p, open: false }))}
              variant={s.type === 'error' ? 'destructive' : 'default'}
              className="font-black text-xs uppercase tracking-widest"
            >
              {english ? 'OK' : '확인'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="fixed bottom-4 left-0 right-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none sm:items-end sm:right-4 sm:left-auto">
        {toasts.map(t => (
          <div
            key={t.id}
            className="flex items-center gap-2 rounded-xl bg-foreground/90 backdrop-blur-xl saturate-150 text-background px-4 py-2.5 text-sm font-bold shadow-lg ring-1 ring-background/10 animate-in fade-in slide-in-from-bottom-4 duration-200 ease-[var(--ease-spring)]"
          >
            <CheckCircle2 className="size-4 text-success shrink-0" />
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useAlert() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAlert must be used within AlertProvider');
  return ctx;
}
