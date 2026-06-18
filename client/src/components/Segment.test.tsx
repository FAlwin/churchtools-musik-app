// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Segment } from './Segment';

afterEach(cleanup);

describe('Segment', () => {
  const options = [
    { value: 'a', label: 'Eins' },
    { value: 'b', label: 'Zwei' },
    { value: 'c', label: 'Drei' },
  ];

  it('rendert alle Optionen', () => {
    render(<Segment value="a" options={options} onChange={() => {}} />);
    expect(screen.getByText('Eins')).toBeTruthy();
    expect(screen.getByText('Zwei')).toBeTruthy();
    expect(screen.getByText('Drei')).toBeTruthy();
  });

  it('meldet die gewählte Option beim Klick', () => {
    const onChange = vi.fn();
    render(<Segment value="a" options={options} onChange={onChange} />);
    fireEvent.click(screen.getByText('Zwei'));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});
