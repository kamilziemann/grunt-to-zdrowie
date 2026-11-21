import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithIntl } from '@/test/render-intl';

import { ImagerySwitch } from './imagery-switch';

const noop = () => undefined;

describe('ImagerySwitch', () => {
  it('bez działek nieaktywny z podpowiedzią, zaznaczone „Brak”', () => {
    renderWithIntl(
      <ImagerySwitch
        value="condition"
        onChange={noop}
        month={null}
        onMonthChange={noop}
        today="2026-11-22"
        enabled={false}
      />,
    );

    expect(screen.getByRole('radio', { name: 'Kondycja roślin' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Brak' })).toBeChecked();
    expect(screen.getByRole('group', { name: 'Zdjęcie z satelity' })).toHaveAccessibleDescription(
      /Najpierw wybierz działkę/,
    );
    expect(screen.queryByLabelText('Z kiedy')).toBeNull();
  });

  it('wybór warstwy i miesiąca (najnowsze = null)', () => {
    const onChange = vi.fn<(value: string) => void>();
    const onMonthChange = vi.fn<(month: string | null) => void>();

    renderWithIntl(
      <ImagerySwitch
        value="moisture"
        onChange={onChange}
        month="2018-06"
        onMonthChange={onMonthChange}
        today="2026-11-22"
        enabled
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Kondycja roślin' }));
    expect(onChange).toHaveBeenCalledWith('condition');

    const select = screen.getByLabelText('Z kiedy');

    expect(select).toHaveDisplayValue('czerwiec 2018');
    fireEvent.change(select, { target: { value: 'latest' } });
    expect(onMonthChange).toHaveBeenCalledWith(null);
    fireEvent.change(select, { target: { value: '2017-04' } });
    expect(onMonthChange).toHaveBeenLastCalledWith('2017-04');
  });
});
