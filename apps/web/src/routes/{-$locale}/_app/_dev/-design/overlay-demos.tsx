// Nakladki katalogu designu (Dialog, ConfirmDialog, Toast) otwierane przyciskami - do obejrzenia na zywo.
import { useCallback, useState } from 'react';
import { useTranslations } from 'use-intl';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';

/** Przyciski otwierajace nakladki (Dialog, ConfirmDialog, Toast), zeby obejrzec je na zywo. Na zrzutach zamkniete. */
export function OverlayDemos() {
  const t = useTranslations('design.overlays');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [destructiveOpen, setDestructiveOpen] = useState(false);

  const openConfirm = useCallback(() => setConfirmOpen(true), []);
  const openDestructive = useCallback(() => setDestructiveOpen(true), []);
  const closeConfirm = useCallback(() => setConfirmOpen(false), []);
  const closeDestructive = useCallback(() => setDestructiveOpen(false), []);
  const toastDefault = useCallback(
    () => toast({ title: t('toastDefaultTitle'), description: t('toastDefaultDescription') }),
    [toast, t],
  );
  const toastSuccess = useCallback(
    () =>
      toast({ title: t('toastSuccessTitle'), description: t('toastSuccessDescription'), variant: 'success' }),
    [toast, t],
  );
  const toastError = useCallback(
    () => toast({ title: t('toastErrorTitle'), description: t('toastErrorDescription'), variant: 'error' }),
    [toast, t],
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">{t('dialog')}</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dialogTitle')}</DialogTitle>
            <DialogDescription>{t('dialogDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button>{t('done')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Button variant="outline" onClick={openConfirm}>
        {t('confirm')}
      </Button>
      <Button variant="destructive" onClick={openDestructive}>
        {t('confirmDestructive')}
      </Button>
      <Button variant="secondary" onClick={toastDefault}>
        {t('toast')}
      </Button>
      <Button variant="secondary" onClick={toastSuccess}>
        {t('toastSuccess')}
      </Button>
      <Button variant="secondary" onClick={toastError}>
        {t('toastError')}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('confirmTitle')}
        description={t('confirmDescription')}
        onConfirm={closeConfirm}
      />
      <ConfirmDialog
        open={destructiveOpen}
        onOpenChange={setDestructiveOpen}
        title={t('destructiveTitle')}
        description={t('destructiveDescription')}
        confirmLabel={tCommon('delete')}
        destructive
        onConfirm={closeDestructive}
      />
    </div>
  );
}
