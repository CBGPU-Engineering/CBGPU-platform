'use client';
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type AlertType = 'success' | 'error' | 'info';

interface AlertState {
  open: boolean;
  title: string;
  message: string;
  type: AlertType;
}

interface AlertCtx {
  showAlert: (msg: string, type?: AlertType, title?: string) => void;
  showError: (msg: string, title?: string) => void;
  showSuccess: (msg: string, title?: string) => void;
}

const Ctx = createContext<AlertCtx | null>(null);

export function AlertProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<AlertState>({ open: false, title: '', message: '', type: 'info' });

  const showAlert = useCallback((msg: string, type: AlertType = 'info', title?: string) => {
    const titles = { success: '완료', error: '오류', info: '알림' };
    setS({ open: true, message: msg, type, title: title ?? titles[type] });
  }, []);

  const showError   = useCallback((msg: string, title = '오류')  => showAlert(msg, 'error',   title), [showAlert]);
  const showSuccess = useCallback((msg: string, title = '완료') => showAlert(msg, 'success', title), [showAlert]);

  return (
    <Ctx.Provider value={{ showAlert, showError, showSuccess }}>
      {children}
      <Dialog open={s.open} onOpenChange={o => !o && setS(p => ({ ...p, open: false }))}>
        <DialogContent className="max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className={`font-black uppercase tracking-tight ${
              s.type === 'error'   ? 'text-destructive' :
              s.type === 'success' ? 'text-green-600 dark:text-green-400' : ''
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
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}

export function useAlert() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAlert must be used within AlertProvider');
  return ctx;
}
