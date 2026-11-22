import { fireEvent, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '@/components/ui/toast';
import { renderWithIntl as renderIntl, translator } from '@/test/render-intl';

import { AnalysisForm } from './analysis-form';

const mocks = vi.hoisted(() => ({ push: vi.fn<(href: string) => void>() }));

vi.mock('@/lib/navigation', async () => ({
  ...(await import('@/test/navigation-double')),
  useRouter: () => ({ push: mocks.push }),
}));

const t = translator('analysis');

// formularz zglasza blad tez powiadomieniem - jak w powloce aplikacji, dostawca powiadomien nad formularzem
function renderWithIntl(ui: ReactElement) {
  return renderIntl(<ToastProvider>{ui}</ToastProvider>);
}

const ID = '141201_1.0001.6509';
const IDS = [ID];

describe('AnalysisForm', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-01T10:00:00Z'));
    mocks.push.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('bez uprawy nie przechodzi dalej i mowi, czego brakuje', () => {
    renderWithIntl(<AnalysisForm parcelIds={IDS} />);
    fireEvent.click(screen.getByRole('button', { name: t('form.submit') }));

    expect(screen.getByText(t('form.cropMissing'))).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('bez uprawy: fokus w grupie upraw, komunikat powiazany z grupa i powiadomienie', () => {
    renderWithIntl(<AnalysisForm parcelIds={IDS} />);
    fireEvent.click(screen.getByRole('button', { name: t('form.submit') }));

    const group = screen.getByRole('group', { name: t('form.cropLegend') });
    const message = screen.getByText(t('form.cropMissing'));

    expect(group).toContainElement(
      document.activeElement instanceof HTMLElement ? document.activeElement : null,
    );
    expect(group).toHaveAttribute('aria-describedby', expect.stringContaining(message.id));
    expect(screen.getByText(t('form.cropMissingToast'))).toBeInTheDocument();
  });

  it('domyslnie dzis; uprawa + Analizuj prowadzi do raportu z parametrami w adresie', () => {
    renderWithIntl(<AnalysisForm parcelIds={IDS} />);

    expect(screen.getByLabelText(t('form.dateLabel'))).toHaveValue('2026-07-01');
    fireEvent.click(screen.getByRole('radio', { name: new RegExp(t('crops.winter_wheat.name')) }));
    fireEvent.click(screen.getByRole('button', { name: t('form.submit') }));

    expect(mocks.push).toHaveBeenCalledWith(`/raport?dzialki=${ID}&uprawa=winter_wheat&data=2026-07-01`);
  });

  it('data sprzed 10 lat = komunikat, bez przejscia', () => {
    renderWithIntl(<AnalysisForm parcelIds={IDS} initialCropId="potato" />);
    fireEvent.change(screen.getByLabelText(t('form.dateLabel')), { target: { value: '2015-06-01' } });
    fireEvent.click(screen.getByRole('button', { name: t('form.submit') }));

    expect(screen.getByLabelText(t('form.dateLabel'))).toHaveAttribute('aria-invalid', 'true');
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('bez JavaScriptu wysyla GET na /raport z polami o nazwach parametrow', () => {
    const { container } = renderWithIntl(<AnalysisForm parcelIds={IDS} />);
    const form = container.querySelector('form');

    expect(form).toHaveAttribute('action', '/raport');
    expect(form).toHaveAttribute('method', 'get');
    expect(container.querySelector('input[name="dzialki"]')).toHaveValue(ID);
    expect(container.querySelector('input[name="data"]')).not.toBeNull();
  });
});
