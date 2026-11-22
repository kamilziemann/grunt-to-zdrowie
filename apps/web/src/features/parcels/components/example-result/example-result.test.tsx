import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithIntl } from '@/test/render-intl';

import { ExampleResult } from './example-result';

describe('ExampleResult', () => {
  it('pokazuje liczby z raportu przykladu i prowadzi do tego raportu', () => {
    renderWithIntl(<ExampleResult />);

    const card = screen.getByTestId('example-result');

    expect(card).toHaveAttribute(
      'href',
      '/raport?dzialki=080904_5.0001.349%2F1&uprawa=winter_wheat&data=2018-06-15',
    );
    expect(card).toHaveTextContent('Działka 349/1 · Chwalim');
    expect(card).toHaveTextContent('19,35 ha · zboża ozime · 15 czerwca 2018');
    expect(card).toHaveTextContent('brakuje ok. 105 l/m² wody, zbiornik w glebie pełny w 11%');
    expect(card).toHaveTextContent('wody brakowało w 9 z 10 sezonów');
    expect(card).toHaveTextContent('Punkt 1: zastawka na rowie w środku pola.');
  });

  it('po angielsku ma te same liczby', () => {
    renderWithIntl(<ExampleResult />, 'en');

    expect(screen.getByTestId('example-result')).toHaveTextContent('about 105 l/m² of water missing');
  });
});
