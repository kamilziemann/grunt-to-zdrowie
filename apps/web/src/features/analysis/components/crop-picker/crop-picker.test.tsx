import { CROP_IDS } from '@app/contracts';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithIntl, translator } from '@/test/render-intl';

import { CropPicker } from './crop-picker';

const t = translator('analysis');

describe('CropPicker', () => {
  it('pokazuje wszystkie 15 upraw z nazwami dla rolnika i zglasza wybor', () => {
    const onChange = vi.fn<(cropId: string) => void>();

    renderWithIntl(<CropPicker name="uprawa" value={null} onChange={onChange} />);

    const group = screen.getByRole('group', { name: t('form.cropLegend') });

    expect(group.querySelectorAll('input[type="radio"]')).toHaveLength(CROP_IDS.length);
    fireEvent.click(screen.getByRole('radio', { name: new RegExp(t('crops.potato.name')) }));
    expect(onChange).toHaveBeenCalledWith('potato');
  });

  it('zaznacza wybrana uprawe', () => {
    renderWithIntl(<CropPicker name="uprawa" value="hops" onChange={vi.fn<(cropId: string) => void>()} />);

    expect(screen.getByRole('radio', { name: new RegExp(t('crops.hops.name')) })).toBeChecked();
  });
});
